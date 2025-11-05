import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Хранилище контекста пользователей (в production лучше использовать БД)
const userSessions = new Map<string, {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  messageCount: number
  lastSummaryAt: number
}>()

// Глобальные счетчики статистики
const uniqueUsersSet = new Set<string>() // Для отслеживания уникальных пользователей

// Объявляем счетчики на уровне модуля для доступа из всех функций
let totalUsers = 0 // Уникальные пользователи
let totalMessages = 0 // Общее количество сообщений

// Блок поддержки при кризисе
const CRISIS_SUPPORT = `
🚨 Если вам нужна срочная помощь:

🇷🇺 Россия:
• Телефон доверия: 8-800-2000-122 (круглосуточно)
• МЧС: 112
• Психологическая помощь: 8-800-333-44-34

💚 Помните: обращаться за помощью — это нормально и важно.
`

// Функция для загрузки файла из Telegram
async function downloadTelegramFile(fileId: string, token: string): Promise<Buffer> {
  // Получаем информацию о файле
  const fileInfoResponse = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  )
  const fileInfo = await fileInfoResponse.json()
  
  if (!fileInfo.ok) {
    throw new Error('Не удалось получить информацию о файле')
  }
  
  // Скачиваем файл
  const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`
  const fileResponse = await fetch(fileUrl)
  
  if (!fileResponse.ok) {
    throw new Error('Не удалось скачать файл')
  }
  
  const arrayBuffer = await fileResponse.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Распознавание речи через OpenAI Whisper
async function transcribeVoice(audioBuffer: Buffer, filename: string = 'voice.ogg'): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY не установлен')
  }

  // Используем прямой HTTP запрос, так как File API в Node.js может работать неправильно
  const formData = new FormData()
  
  // Конвертируем Buffer в Blob для FormData
  const uint8Array = new Uint8Array(audioBuffer)
  const audioBlob = new Blob([uint8Array], { type: 'audio/ogg' })
  
  // Добавляем файл в FormData
  formData.append('file', audioBlob, filename)
  formData.append('model', 'whisper-1')
  formData.append('language', 'ru')

  // Отправляем запрос напрямую в OpenAI API
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${JSON.stringify(error)}`)
  }

  const result = await response.json()
  return result.text
}

// Генерация голосового ответа через OpenAI TTS
async function textToSpeech(text: string): Promise<Buffer> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY не установлен')
  }

  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova', // Дружелюбный женский голос (можно выбрать: alloy, echo, fable, onyx, nova, shimmer)
    input: text,
  })

  const arrayBuffer = await mp3.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Отправка голосового сообщения в Telegram
async function sendVoiceMessage(
  token: string,
  chatId: string,
  audioBuffer: Buffer,
  text?: string
): Promise<void> {
  // Конвертируем Buffer в Uint8Array для создания Blob
  const uint8Array = new Uint8Array(audioBuffer)
  const audioBlob = new Blob([uint8Array], { type: 'audio/mpeg' })
  
  // Пробуем сначала sendAudio (более универсальный метод)
  // Он работает с разными форматами и может отправляться как голосовое сообщение
  const formDataAudio = new FormData()
  formDataAudio.append('audio', audioBlob, 'response.mp3')
  formDataAudio.append('chat_id', chatId)
  formDataAudio.append('title', 'Ответ от EmotiCare')
  formDataAudio.append('performer', 'EmotiCare')
  
  if (text) {
    formDataAudio.append('caption', text.substring(0, 1024)) // sendAudio поддерживает до 1024 символов
  }

  try {
    // Пробуем sendAudio - более универсальный метод
    const audioResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendAudio`,
      {
        method: 'POST',
        body: formDataAudio,
      }
    )

    if (audioResponse.ok) {
      console.log('✅ Голосовое сообщение отправлено через sendAudio')
      return
    }

    // Если sendAudio не сработал, пробуем sendVoice
    console.log('⚠️ sendAudio не сработал, пробуем sendVoice...')
    const formDataVoice = new FormData()
    formDataVoice.append('voice', audioBlob, 'response.mp3')
    formDataVoice.append('chat_id', chatId)
    
    if (text) {
      formDataVoice.append('caption', text.substring(0, 200))
    }

    const voiceResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendVoice`,
      {
        method: 'POST',
        body: formDataVoice,
      }
    )

    if (!voiceResponse.ok) {
      const errorText = await voiceResponse.text()
      let error
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { description: errorText }
      }
      throw new Error(`Ошибка отправки голосового сообщения: ${error.description || 'Unknown error'}`)
    }
    
    console.log('✅ Голосовое сообщение отправлено через sendVoice')
  } catch (error) {
    console.error('❌ Ошибка отправки голосового сообщения:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Получаем сообщение из Telegram
    const message = body.message
    if (!message) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id.toString()
    const text = message.text || ''
    const voice = message.voice
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN

    if (!telegramBotToken) {
      console.error('TELEGRAM_BOT_TOKEN не установлен')
      return NextResponse.json({ ok: false, error: 'Bot token not configured' }, { status: 500 })
    }

    // Админ-команды
    if (text.startsWith('/status') || text.startsWith('/health') || text.startsWith('/help') || text.startsWith('/users')) {
      return handleAdminCommand(text, chatId, telegramBotToken)
    }

    // Обработка голосовых сообщений
    if (voice) {
      try {
        // Отправляем сообщение о том, что обрабатываем голос
        await sendMessage(telegramBotToken, chatId, '🎤 Обрабатываю ваше голосовое сообщение...')

        // Скачиваем голосовой файл
        const audioBuffer = await downloadTelegramFile(voice.file_id, telegramBotToken)
        
        // Распознаем речь
        const transcribedText = await transcribeVoice(audioBuffer, 'voice.ogg')
        
        console.log(`📝 Распознанный текст: ${transcribedText}`)

        // Отправляем распознанный текст пользователю (опционально)
        await sendMessage(telegramBotToken, chatId, `📝 Услышал: "${transcribedText}"`)

        // Обрабатываем как обычное текстовое сообщение
        const processedText = transcribedText
        // Продолжаем обработку как обычное сообщение ниже...
        
        // Используем распознанный текст как обычное сообщение
        return await processMessage(telegramBotToken, chatId, processedText, true) // true = голосовое сообщение
      } catch (error) {
        console.error('Ошибка обработки голосового сообщения:', error)
        await sendMessage(
          telegramBotToken,
          chatId,
          '❌ Не удалось обработать голосовое сообщение. Попробуйте написать текстом, пожалуйста.'
        )
        return NextResponse.json({ ok: true })
      }
    }

    // Основное общение через EmotiCare
    if (text.startsWith('/start')) {
      // Инициализация сессии
      const isNewUser = !userSessions.has(chatId)
      userSessions.set(chatId, {
        messages: [],
        messageCount: 0,
        lastSummaryAt: 0
      })
      
      // Обновляем счетчик уникальных пользователей
      if (isNewUser && !uniqueUsersSet.has(chatId)) {
        uniqueUsersSet.add(chatId)
        totalUsers = uniqueUsersSet.size
      }
      
      await sendMessage(telegramBotToken, chatId, 
        `Привет! 👋 Я EmotiCare — твой тёплый и бережный AI‑терапевт.\n\n` +
        `Моя цель — помочь тебе осознать чувства, потребности и выбор. ` +
        `Я использую техники CBT, мотивационного интервьюирования и mindfulness.\n\n` +
        `Я не врач и не ставлю диагнозы. Мы вместе исследуем твои переживания.\n\n` +
        `💬 Можешь писать мне текстом или отправлять голосовые сообщения!\n\n` +
        `Как дела? Что у тебя на душе? 💙`
      )
      
      // Отправляем статистику в группу при новом пользователе
      const statsGroupId = process.env.TELEGRAM_STATS_GROUP_ID
      if (statsGroupId && isNewUser) {
        await sendStatsToGroup(telegramBotToken, statsGroupId)
      }
      
      return NextResponse.json({ ok: true })
    }

    // Обработка текстового сообщения
    return await processMessage(telegramBotToken, chatId, text, false)
  } catch (error) {
    console.error('Ошибка обработки webhook:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Обработка сообщения (текстового или распознанного из голоса)
async function processMessage(
  telegramBotToken: string,
  chatId: string,
  text: string,
  isVoice: boolean = false
): Promise<NextResponse> {
  // Получение или создание сессии пользователя
  let session = userSessions.get(chatId)
  const isNewUser = !session
  
  if (!session) {
    session = {
      messages: [],
      messageCount: 0,
      lastSummaryAt: 0
    }
    userSessions.set(chatId, session)
    
    // Обновляем счетчик уникальных пользователей
    if (!uniqueUsersSet.has(chatId)) {
      uniqueUsersSet.add(chatId)
      totalUsers = uniqueUsersSet.size
    }
  }

  // Проверка на кризисные сигналы
  const crisisKeywords = ['убить', 'суицид', 'покончить', 'не хочу жить', 'конец', 'всё бесполезно']
  const hasCrisisSignal = crisisKeywords.some(keyword => text.toLowerCase().includes(keyword))
  
  if (hasCrisisSignal) {
    await sendMessage(telegramBotToken, chatId, 
      `Я понимаю, что тебе сейчас очень тяжело. 💙\n\n` +
      `Твоя жизнь важна. Есть люди, которые готовы помочь прямо сейчас.\n\n${CRISIS_SUPPORT}`
    )
    return NextResponse.json({ ok: true })
  }

  // Генерация ответа от EmotiCare
  session.messages.push({ role: 'user', content: text })
  session.messageCount++
  totalMessages++ // Увеличиваем общий счетчик сообщений

  let aiResponse = ''
  
  if (process.env.OPENAI_API_KEY) {
    try {
      aiResponse = await generateEmotiCareResponse(text, session.messages, session.messageCount, session.lastSummaryAt)
      
      if (session.messageCount - session.lastSummaryAt >= 5) {
        session.lastSummaryAt = session.messageCount
      }
    } catch (error) {
      console.error('OpenAI Error:', error)
      aiResponse = generateFallbackResponse(text)
    }
  } else {
    aiResponse = generateFallbackResponse(text)
  }

  // Сохраняем ответ
  session.messages.push({ role: 'assistant', content: aiResponse })
  
  // Ограничиваем историю
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20)
  }

  // Отправляем ответ
  // Если сообщение было голосовым и OpenAI доступен - отвечаем голосом
  const sendVoiceResponse = isVoice && process.env.OPENAI_API_KEY

  if (sendVoiceResponse) {
    try {
      console.log('🎤 Генерирую голосовой ответ...')
      
      // Генерируем голосовой ответ
      const voiceBuffer = await textToSpeech(aiResponse)
      console.log(`✅ Голосовой ответ сгенерирован (${voiceBuffer.length} байт)`)
      
      // Отправляем голосовое сообщение
      await sendVoiceMessage(telegramBotToken, chatId, voiceBuffer, aiResponse)
      console.log('✅ Голосовое сообщение отправлено')
    } catch (error) {
      console.error('❌ Ошибка генерации/отправки голосового ответа:', error)
      // Fallback на текстовый ответ
      await sendMessage(telegramBotToken, chatId, aiResponse)
      await sendMessage(
        telegramBotToken,
        chatId,
        '💬 (Не удалось отправить голосовой ответ, отправляю текстом)'
      )
    }
  } else {
    // Отправляем текстовый ответ
    await sendMessage(telegramBotToken, chatId, aiResponse)
  }
  
  // Отправляем статистику в группу периодически или при новом пользователе
  const statsGroupId = process.env.TELEGRAM_STATS_GROUP_ID
  if (statsGroupId && (isNewUser || totalMessages % 10 === 0)) {
    await sendStatsToGroup(telegramBotToken, statsGroupId)
  }
  
  return NextResponse.json({ ok: true })
}

// Генерация ответа от EmotiCare через OpenAI
async function generateEmotiCareResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  messageCount: number,
  lastSummaryAt: number
): Promise<string> {
  const needsSummary = messageCount - lastSummaryAt >= 5

  const systemPrompt = `Ты EmotiCare — тёплый и бережный AI‑терапевт. Твоя цель — помочь человеку осознать чувства, потребности и выбор.

Рамки: ты не врач, не ставишь диагнозы, не даёшь медсоветы. Избегай категоричности.

Техники: CBT (мысли‑эмоции‑поведение), мотивационное интервьюирование (открытые вопросы, рефрейминг, отражение), mindfulness.

Правила:

1) Короткие, ясные ответы (2–5 предложений).

2) Одна микро‑практика за раз (дыхание 1 мин, записи триггеров, «если‑то» план).

3) Тон — эмпатичный, без осуждения.

4) Раз в 5–7 сообщений — gentle summary и согласование следующего шага.

5) Не обсуждай тему самоповреждения детально; при явном риске — покажи блок поддержки (контакты помощи по стране).

6) На запрос «совет» — 3 варианта + последствия каждого.

${needsSummary ? '⚠️ ВАЖНО: Сейчас нужно сделать gentle summary (краткое подведение итогов) и согласовать следующий шаг.' : ''}`

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ]

  // Добавляем последние 10 сообщений для контекста
  const recentHistory = conversationHistory.slice(-10)
  recentHistory.forEach(msg => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    })
  })

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: messages,
    temperature: 0.7,
    max_tokens: 200, // Ограничиваем длину ответа
  })

  return completion.choices[0]?.message?.content || 
    'Извини, не смог обработать твой запрос. Попробуй переформулировать?'
}

// Fallback ответы без OpenAI
function generateFallbackResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase()
  
  if (lowerMessage.includes('тревож') || lowerMessage.includes('страх') || lowerMessage.includes('боюсь')) {
    return `Понимаю, что тревога сейчас с тобой. 💙\n\n` +
      `Попробуем дышать вместе? Сделай вдох на 4 счёта, задержку на 4, выдох на 4. Повтори 3–4 раза.\n\n` +
      `Что ты замечаешь в теле сейчас?`
  }
  
  if (lowerMessage.includes('груст') || lowerMessage.includes('плох') || lowerMessage.includes('печаль')) {
    return `Мне жаль, что тебе грустно. Эти чувства важны. 💙\n\n` +
      `Что происходит в твоём теле, когда ты это ощущаешь? Где именно?`
  }
  
  if (lowerMessage.includes('совет') || lowerMessage.includes('что делать')) {
    return `Хороший вопрос. Давай рассмотрим несколько вариантов:\n\n` +
      `1. Первый вариант: [опиши ситуацию подробнее, и я предложу варианты]\n\n` +
      `2. Второй вариант\n\n` +
      `3. Третий вариант\n\n` +
      `Расскажи больше о ситуации, и мы разберём каждый вариант.`
  }
  
  return `Спасибо, что поделился. 💙\n\n` +
    `Помогает ли тебе сейчас понять: что именно ты чувствуешь? Или что тебе нужно в этот момент?`
}

// Обработка админ-команд
async function handleAdminCommand(
  text: string,
  chatId: string,
  telegramBotToken: string
): Promise<NextResponse> {
  let responseText = ''

  if (text.startsWith('/status')) {
    const uptime = process.uptime()
    const memory = process.memoryUsage()
    responseText = `📊 Статус EmotiCare:\n\n` +
      `✅ Сервис работает\n` +
      `⏱ Uptime: ${Math.floor(uptime / 60)} минут\n` +
      `💾 Память: ${Math.round(memory.heapUsed / 1024 / 1024)} MB\n` +
      `👥 Активных сессий: ${userSessions.size}\n` +
      `🌐 URL: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'Не установлен'}`
  } else if (text.startsWith('/health')) {
    responseText = `❤️ Проверка здоровья:\n\n` +
      `✅ API работает\n` +
      `✅ Telegram webhook активен\n` +
      `✅ EmotiCare готов помочь\n\n` +
      `Время: ${new Date().toLocaleString('ru-RU')}`
  } else if (text.startsWith('/help')) {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminChatId && chatId === adminChatId) {
      responseText = `📖 Админ-команды:\n\n` +
        `/status - Статус сервиса\n` +
        `/health - Проверка здоровья\n` +
        `/users - Статистика пользователей`
    } else {
      responseText = `Привет! Я EmotiCare. 💙\n\n` +
        `Просто напиши мне о том, что у тебя на душе. Я здесь, чтобы выслушать и поддержать.\n\n` +
        `Начни с /start, чтобы начать сессию.`
    }
  } else if (text.startsWith('/users')) {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminChatId && chatId === adminChatId) {
      responseText = `👥 *Статистика:*\n\n` +
        `Уникальных пользователей: ${totalUsers}\n` +
        `Активных сессий: ${userSessions.size}\n` +
        `Всего сообщений: ${totalMessages}\n` +
        `Среднее сообщений на пользователя: ${totalUsers > 0 ? (totalMessages / totalUsers).toFixed(1) : 0}`
    } else {
      responseText = `❌ У вас нет доступа к этой команде`
    }
  }

  await sendMessage(telegramBotToken, chatId, responseText)
  return NextResponse.json({ ok: true })
}

// Вспомогательная функция для отправки сообщений
async function sendMessage(token: string, chatId: string, text: string): Promise<void> {
  const telegramApiUrl = `https://api.telegram.org/bot${token}/sendMessage`
  
  await fetch(telegramApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    }),
  })
}

// Функция для отправки статистики в группу
async function sendStatsToGroup(token: string, groupId: string): Promise<void> {
  const statsMessage = `📊 *Статистика EmotiCare*

👥 *Уникальных пользователей:* ${totalUsers}
💬 *Всего сообщений:* ${totalMessages}
📈 *Активных сессий:* ${userSessions.size}
📝 *Среднее сообщений на пользователя:* ${totalUsers > 0 ? (totalMessages / totalUsers).toFixed(1) : 0}

⏰ _Обновлено: ${new Date().toLocaleString('ru-RU')}_`

  try {
    await sendMessage(token, groupId, statsMessage)
    console.log(`✅ Статистика отправлена в группу ${groupId}`)
  } catch (error) {
    console.error('❌ Ошибка отправки статистики в группу:', error)
  }
}

// GET для верификации webhook
export async function GET() {
  return NextResponse.json({ 
    message: 'EmotiCare Telegram webhook endpoint',
    status: 'active',
    activeSessions: userSessions.size
  })
}
