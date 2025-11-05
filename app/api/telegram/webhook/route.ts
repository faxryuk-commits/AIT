import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { 
  EmotionalMemory, 
  createEmptyMemory, 
  getRelevantMemories, 
  updateEmotionalMemory 
} from '@/lib/emotional-memory'
import { 
  TherapyState, 
  TherapyContext, 
  createTherapyContext, 
  transitionState, 
  getStatePrompt, 
  updateContext, 
  shouldResetContext 
} from '@/lib/therapy-fsm'
import { 
  EmotionalState, 
  AdaptiveResponse, 
  adaptToEmotionalState, 
  updateEmotionalState, 
  getTonePrompt, 
  getEmpathyPrompt 
} from '@/lib/emotional-state-engine'
import { 
  analyzeEmotionTrends, 
  formatEmotionReport 
} from '@/lib/emotion-analytics'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Интерфейсы для данных
interface Emotion {
  primary: string // основная эмоция
  secondary?: string // вторичная эмоция
  intensity: number // интенсивность 1-10
  timestamp: string // ISO timestamp
}

interface MessageWithEmotion {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  emotions?: Emotion // только для user сообщений
}

interface UserSession {
  messages: MessageWithEmotion[]
  messageCount: number
  lastSummaryAt: number
  createdAt: string
  lastMessageAt: string // дата последнего сообщения (для подсчета активных пользователей)
  // Новые поля для расширенной функциональности
  emotionalMemory: EmotionalMemory
  therapyContext: TherapyContext
  emotionalState: EmotionalState | null
  personalization: {
    therapistName: string // имя AI-терапевта (по умолчанию "Emo")
    preferredTone: 'calm' | 'warm' | 'humorous' | 'gentle' | 'supportive'
  }
  lastCheckIn?: string // дата последнего утреннего чекина
  lastReflection?: string // дата последней вечерней рефлексии
}

// Хранилище контекста пользователей (в production лучше использовать БД)
const userSessions = new Map<string, UserSession>()

/**
 * Создает новую сессию пользователя с инициализацией всех полей
 */
function createNewSession(chatId: string): UserSession {
  const now = new Date().toISOString()
  return {
    messages: [],
    messageCount: 0,
    lastSummaryAt: 0,
    createdAt: now,
    lastMessageAt: now, // инициализируем текущим временем
    emotionalMemory: createEmptyMemory(),
    therapyContext: createTherapyContext(),
    emotionalState: null,
    personalization: {
      therapistName: 'Emo', // имя по умолчанию
      preferredTone: 'warm'
    }
  }
}

// Глобальные счетчики статистики
const uniqueUsersSet = new Set<string>() // Для отслеживания уникальных пользователей

// Объект статистики для хранения счетчиков (для явной доступности в TypeScript)
const stats = {
  totalUsers: 0 as number, // Текущее количество активных пользователей
  totalMessages: 0 as number,
  allTimeUsers: 0 as number, // Все пользователи с начала запуска (никогда не уменьшается)
}

// Алиасы для удобства
const totalUsers = () => stats.totalUsers
const totalMessages = () => stats.totalMessages
const allTimeUsers = () => stats.allTimeUsers
const setTotalUsers = (value: number) => { stats.totalUsers = value }
const setTotalMessages = (value: number) => { stats.totalMessages = value }
const incrementTotalMessages = () => { stats.totalMessages++ }
const incrementAllTimeUsers = () => { stats.allTimeUsers++ }

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

// Классификация эмоций в тексте через OpenAI
async function classifyEmotions(content: string): Promise<Emotion> {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback: простая эвристика
    return {
      primary: 'neutral',
      intensity: 5,
      timestamp: new Date().toISOString()
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ты анализируешь эмоции в тексте. Верни JSON с полями:
- primary: основная эмоция из списка (joy, sadness, anger, fear, surprise, disgust, neutral, anxiety, calm, excited, tired, overwhelmed)
- secondary: вторичная эмоция (опционально)
- intensity: интенсивность от 1 до 10 (1 = очень слабая, 10 = очень сильная)

Отвечай ТОЛЬКО JSON, без дополнительного текста.`
        },
        {
          role: 'user',
          content: `Проанализируй эмоции в этом тексте: "${content}"`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 100
    })

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}')
    
    return {
      primary: result.primary || 'neutral',
      secondary: result.secondary,
      intensity: Math.max(1, Math.min(10, parseInt(result.intensity) || 5)),
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Ошибка классификации эмоций:', error)
    return {
      primary: 'neutral',
      intensity: 5,
      timestamp: new Date().toISOString()
    }
  }
}

// Анализ изображения через OpenAI Vision API
async function analyzeImageWithVision(base64Image: string, userCaption?: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY не установлен')
  }

  const prompt = userCaption
    ? `Опиши это фото детально, учитывая, что пользователь написал: "${userCaption}". Будь эмпатичным и заметь эмоциональную составляющую, если она есть.`
    : `Опиши это фото детально. Обрати внимание на эмоциональную составляющую, настроение, контекст. Будь эмпатичным в описании.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // или 'gpt-4-vision-preview' для более продвинутого анализа
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 300,
  })

  return completion.choices[0]?.message?.content || 'Не удалось проанализировать фото.'
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
    const photo = message.photo
    const video = message.video
    const document = message.document
    const sticker = message.sticker
    const caption = message.caption || '' // Подпись к медиа
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN

    if (!telegramBotToken) {
      console.error('TELEGRAM_BOT_TOKEN не установлен')
      return NextResponse.json({ ok: false, error: 'Bot token not configured' }, { status: 500 })
    }

    // Админ-команды
    if (text.startsWith('/status') || text.startsWith('/health') || text.startsWith('/help') || text.startsWith('/users')) {
      return handleAdminCommand(text, chatId, telegramBotToken)
    }

    // Обработка фото (с поддержкой Vision API)
    if (photo && photo.length > 0) {
      try {
        await sendMessage(telegramBotToken, chatId, '📷 Анализирую фото...')
        
        // Берем фото максимального качества (последний элемент в массиве)
        const largestPhoto = photo[photo.length - 1]
        const imageBuffer = await downloadTelegramFile(largestPhoto.file_id, telegramBotToken)
        
        // Конвертируем в base64 для OpenAI Vision API
        const base64Image = imageBuffer.toString('base64')
        
        // Получаем описание фото через Vision API
        const imageDescription = await analyzeImageWithVision(base64Image, caption)
        
        console.log(`🖼️ Описание фото: ${imageDescription}`)
        
        // Сообщаем пользователю, что увидели
        if (caption) {
          await sendMessage(telegramBotToken, chatId, `📷 Вижу фото. Подпись: "${caption}"\n\n${imageDescription}`)
        } else {
          await sendMessage(telegramBotToken, chatId, `📷 Вижу фото: ${imageDescription}`)
        }
        
        // Обрабатываем как обычное сообщение с описанием фото
        const processedText = caption 
          ? `${caption}. На фото: ${imageDescription}`
          : `Пользователь отправил фото. Содержимое фото: ${imageDescription}`
        
        return await processMessage(telegramBotToken, chatId, processedText, false)
      } catch (error) {
        console.error('Ошибка обработки фото:', error)
        await sendMessage(
          telegramBotToken,
          chatId,
          '❌ Не удалось обработать фото. Попробуйте описать, что на фото, текстом.'
        )
        return NextResponse.json({ ok: true })
      }
    }

    // Обработка видео
    if (video) {
      try {
        // Увеличиваем счетчик сообщений для видео
        let session = userSessions.get(chatId)
        if (!session) {
          session = createNewSession(chatId)
          userSessions.set(chatId, session)
          if (!uniqueUsersSet.has(chatId)) {
            uniqueUsersSet.add(chatId)
            setTotalUsers(uniqueUsersSet.size)
          }
        }
        session.messageCount++
        session.lastMessageAt = new Date().toISOString()
        incrementTotalMessages()
        
        await sendMessage(telegramBotToken, chatId, '🎥 Вижу видео. К сожалению, пока не могу анализировать видео, только фото. Можете описать, что там происходит?')
        return NextResponse.json({ ok: true })
      } catch (error) {
        console.error('Ошибка обработки видео:', error)
        return NextResponse.json({ ok: true })
      }
    }

    // Обработка документов
    if (document) {
      try {
        // Увеличиваем счетчик сообщений для документов
        let session = userSessions.get(chatId)
        if (!session) {
          session = createNewSession(chatId)
          userSessions.set(chatId, session)
          if (!uniqueUsersSet.has(chatId)) {
            uniqueUsersSet.add(chatId)
            setTotalUsers(uniqueUsersSet.size)
          }
        }
        session.messageCount++
        session.lastMessageAt = new Date().toISOString()
        incrementTotalMessages()
        
        await sendMessage(telegramBotToken, chatId, '📄 Вижу документ. Я могу работать только с текстовыми сообщениями, голосовыми и фото. Можете отправить текст или описать содержимое?')
        return NextResponse.json({ ok: true })
      } catch (error) {
        console.error('Ошибка обработки документа:', error)
        return NextResponse.json({ ok: true })
      }
    }

    // Обработка стикеров
    if (sticker) {
      try {
        // Увеличиваем счетчик сообщений для стикеров
        let session = userSessions.get(chatId)
        if (!session) {
          session = createNewSession(chatId)
          userSessions.set(chatId, session)
          if (!uniqueUsersSet.has(chatId)) {
            uniqueUsersSet.add(chatId)
            setTotalUsers(uniqueUsersSet.size)
          }
        }
        session.messageCount++
        session.lastMessageAt = new Date().toISOString()
        incrementTotalMessages()
        
        // Можно просто игнорировать или ответить дружелюбно
        const stickerResponses = [
          '😊 Вижу стикер! Как дела?',
          '👋 Привет! О чём хочешь поговорить?',
          '💬 Напиши мне, что на душе.'
        ]
        const randomResponse = stickerResponses[Math.floor(Math.random() * stickerResponses.length)]
        await sendMessage(telegramBotToken, chatId, randomResponse)
        return NextResponse.json({ ok: true })
      } catch (error) {
        console.error('Ошибка обработки стикера:', error)
        return NextResponse.json({ ok: true })
      }
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
      let session = userSessions.get(chatId)
      const isNewUser = !session
      
      if (!session) {
        // Создаем новую сессию
        session = createNewSession(chatId)
        userSessions.set(chatId, session)
        
        // Обновляем счетчик уникальных пользователей
        if (!uniqueUsersSet.has(chatId)) {
          uniqueUsersSet.add(chatId)
          setTotalUsers(uniqueUsersSet.size)
          incrementAllTimeUsers() // Увеличиваем счетчик всех пользователей с начала запуска
        }
        
        // Отправляем/обновляем статистику в группе при новом пользователе
        const statsGroupId = process.env.TELEGRAM_STATS_GROUP_ID
        if (statsGroupId) {
          await sendStatsToGroup(telegramBotToken, statsGroupId)
        }
        
        // Приветственное сообщение для нового пользователя
        await sendMessage(telegramBotToken, chatId, 
          `👋 Привет! Я EmotiCare — твой друг для эмоциональной поддержки.\n\n` +
          `Я здесь, чтобы выслушать и поддержать тебя. Мы можем поговорить о чём угодно: о том, что тебя тревожит, радует, беспокоит или просто о жизни.\n\n` +
          `💬 Можешь писать мне текстом, отправлять голосовые или фото — как удобнее.\n\n` +
          `*Доступные команды:*\n` +
          `/emotions - Дневник эмоций за неделю\n` +
          `/mood_card - Ежедневная карточка настроения\n` +
          `/referral - Пригласить друга\n\n` +
          `Итак, как дела? Что у тебя на душе? 💙`
        )
        return NextResponse.json({ ok: true })
      } else {
        // Если сессия уже есть - просто приветствуем
        await sendMessage(telegramBotToken, chatId, 
          `Привет! 👋 Мы уже знакомы. Как дела? Что у тебя на душе? 💙`
        )
        return NextResponse.json({ ok: true })
      }
    }

    // Команда удаления данных
    if (text.startsWith('/delete_data')) {
      userSessions.delete(chatId)
      uniqueUsersSet.delete(chatId)
      setTotalUsers(uniqueUsersSet.size)
      
      await sendMessage(telegramBotToken, chatId, 
        `✅ Все твои данные удалены.\n\n` +
        `Если захочешь вернуться, просто напиши /start 💙`
      )
      return NextResponse.json({ ok: true })
    }

    // Команда для получения дневника эмоций с улучшенной аналитикой
    if (text.startsWith('/emotions') || text.startsWith('/дневник')) {
      const session = userSessions.get(chatId)
      if (!session) {
        await sendMessage(telegramBotToken, chatId, 'Для начала отправь /start')
        return NextResponse.json({ ok: true })
      }

      // Используем новую аналитику эмоций
      const report = analyzeEmotionTrends(session.emotionalMemory, 2)
      
      if (report.dominantEmotions.length === 0) {
        await sendMessage(telegramBotToken, chatId, 
          `📊 За последнюю неделю пока нет записей эмоций.\n\n` +
          `Продолжай общаться, и я буду отслеживать твои эмоции! 💙`
        )
        return NextResponse.json({ ok: true })
      }

      const formattedReport = formatEmotionReport(report)
      await sendMessage(telegramBotToken, chatId, formattedReport)
      return NextResponse.json({ ok: true })
    }

    // Команда для ежедневной карточки настроения
    if (text.startsWith('/mood_card') || text.startsWith('/карточка')) {
      const session = userSessions.get(chatId)
      if (!session) {
        await sendMessage(telegramBotToken, chatId, 'Для начала отправь /start')
        return NextResponse.json({ ok: true })
      }

      // Получаем эмоции за сегодня
      const today = new Date().toISOString().split('T')[0]
      const todayEmotions = session.messages
        .filter(msg => {
          if (msg.role !== 'user' || !msg.emotions) return false
          const msgDate = new Date(msg.timestamp).toISOString().split('T')[0]
          return msgDate === today
        })
        .map(msg => msg.emotions!)

      if (todayEmotions.length === 0) {
        await sendMessage(telegramBotToken, chatId, 
          `📅 *Карточка настроения за сегодня*\n\n` +
          `Пока нет записей за сегодня. Поделись, как дела! 💙\n\n` +
          `Можешь поделиться этой карточкой в сторис или чате — просто сделай скриншот!`
        )
        return NextResponse.json({ ok: true })
      }

      // Анализируем эмоции за день
      const emotionCounts: Record<string, number> = {}
      let totalIntensity = 0
      const emotionHistory = todayEmotions.map(e => `${e.primary} (${e.intensity}/10)`).join(', ')

      todayEmotions.forEach(emotion => {
        emotionCounts[emotion.primary] = (emotionCounts[emotion.primary] || 0) + 1
        totalIntensity += emotion.intensity
      })

      const avgIntensity = (totalIntensity / todayEmotions.length).toFixed(1)
      const topEmotion = Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])[0]

      const emotionEmojis: Record<string, string> = {
        joy: '😊',
        sadness: '😢',
        anger: '😠',
        fear: '😨',
        anxiety: '😰',
        calm: '😌',
        excited: '🤩',
        tired: '😴',
        overwhelmed: '😵',
        neutral: '😐'
      }

      const moodCard = `📅 *Карточка настроения*\n` +
        `_${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}_\n\n` +
        `🎭 *Основное настроение:* ${emotionEmojis[topEmotion[0]] || '📝'} ${topEmotion[0]}\n` +
        `📊 *Интенсивность:* ${avgIntensity}/10\n` +
        `💬 *Записей за день:* ${todayEmotions.length}\n\n` +
        `*Эмоциональный путь:*\n${emotionHistory}\n\n` +
        `💙 *Спасибо, что делишься своими эмоциями!*\n\n` +
        `📸 Можешь поделиться этой карточкой в сторис или чате — сделай скриншот!`

      await sendMessage(telegramBotToken, chatId, moodCard)
      return NextResponse.json({ ok: true })
    }

    // Команда для реферальной программы
    if (text.startsWith('/referral') || text.startsWith('/реферал') || text.startsWith('/пригласить')) {
      const session = userSessions.get(chatId)
      if (!session) {
        await sendMessage(telegramBotToken, chatId, 'Для начала отправь /start')
        return NextResponse.json({ ok: true })
      }

      // Генерируем реферальную ссылку
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'ваш_бот'
      const referralCode = Buffer.from(chatId).toString('base64').substring(0, 8)
      const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`

      await sendMessage(telegramBotToken, chatId, 
        `🎁 *Пригласи друга — получи +7 дней Pro!*\n\n` +
        `Поделись этой ссылкой с друзьями:\n` +
        `\`${referralLink}\`\n\n` +
        `Когда твой друг зарегистрируется по этой ссылке:\n` +
        `✅ Он получит приветственный бонус\n` +
        `✅ Ты получишь +7 дней Pro функций\n\n` +
        `💙 Спасибо за поддержку EmotiCare!`
      )
      return NextResponse.json({ ok: true })
    }

    // Обработка реферальных ссылок при /start
    if (text.startsWith('/start ref_')) {
      const referralCode = text.split('ref_')[1]
      // В production здесь можно обработать реферальный код
      // Пока просто приветствуем пользователя
    }

    // Ежедневные ритуалы
    if (text.startsWith('/morning_checkin') || text.startsWith('/утро') || text.startsWith('/доброе_утро')) {
      return await handleMorningCheckIn(telegramBotToken, chatId)
    }

    if (text.startsWith('/evening_reflection') || text.startsWith('/вечер') || text.startsWith('/рефлексия')) {
      return await handleEveningReflection(telegramBotToken, chatId)
    }

    // Персонализация
    if (text.startsWith('/set_name') || text.startsWith('/имя')) {
      const nameMatch = text.match(/(?:set_name|имя)\s+(.+)/i)
      if (nameMatch) {
        return await handleSetTherapistName(telegramBotToken, chatId, nameMatch[1].trim())
      } else {
        await sendMessage(telegramBotToken, chatId, 
          '💬 Использование: /set_name [имя]\n\nНапример: /set_name Эмо\n\nИли: /имя Эмо'
        )
        return NextResponse.json({ ok: true })
      }
    }

    if (text.startsWith('/set_tone') || text.startsWith('/тон')) {
      const toneMatch = text.match(/(?:set_tone|тон)\s+(calm|warm|humorous|gentle|supportive)/i)
      if (toneMatch) {
        return await handleSetTone(telegramBotToken, chatId, toneMatch[1].toLowerCase() as any)
      } else {
        await sendMessage(telegramBotToken, chatId, 
          '💬 Использование: /set_tone [calm|warm|humorous|gentle|supportive]\n\n' +
          '• calm - спокойный, размеренный\n' +
          '• warm - теплый, дружелюбный\n' +
          '• humorous - с легким юмором\n' +
          '• gentle - очень мягкий, бережный\n' +
          '• supportive - максимально поддерживающий\n\n' +
          'Или: /тон warm'
        )
        return NextResponse.json({ ok: true })
      }
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
  
  // Создаем сессию, если её нет
  if (!session) {
    session = createNewSession(chatId)
    userSessions.set(chatId, session)
    
    // Обновляем счетчик уникальных пользователей
    if (!uniqueUsersSet.has(chatId)) {
      uniqueUsersSet.add(chatId)
      setTotalUsers(uniqueUsersSet.size)
      incrementAllTimeUsers() // Увеличиваем счетчик всех пользователей с начала запуска
    }
  }

  // Проверяем, нужно ли сбросить контекст терапии
  if (shouldResetContext(session.therapyContext)) {
    session.therapyContext = createTherapyContext()
  }
  
  // Классификация эмоций в сообщении пользователя
  const emotions = await classifyEmotions(text)
  
  // Обновляем эмоциональное состояние
  session.emotionalState = updateEmotionalState(
    session.emotionalState,
    emotions.primary,
    emotions.intensity,
    emotions.intensity // используем интенсивность как уровень стресса
  )
  
  // Обновляем эмоциональную память
  session.emotionalMemory = updateEmotionalMemory(
    session.emotionalMemory,
    emotions.primary,
    emotions.intensity,
    text.substring(0, 100), // контекст ограничиваем
    text
  )
  
  // Сохранение user-сообщения с эмоциями
  const userMessage: MessageWithEmotion = {
    role: 'user',
    content: text,
    timestamp: new Date().toISOString(),
    emotions: emotions
  }
  session.messages.push(userMessage)
  session.messageCount++
  session.lastMessageAt = new Date().toISOString() // Обновляем время последнего сообщения
  incrementTotalMessages() // Увеличиваем общий счетчик сообщений
  
  // Проверка на кризисные сигналы (расширенный список)
  const crisisKeywords = [
    'убить', 'суицид', 'покончить', 'не хочу жить', 'конец', 'всё бесполезно',
    'хочу причинить себе вред', 'самоубийство', 'покончу с собой', 'не хочу больше жить',
    'лучше бы я не родился', 'жизнь не имеет смысла'
  ]
  const hasCrisisSignal = crisisKeywords.some(keyword => text.toLowerCase().includes(keyword))
  
  // Обновляем FSM состояние
  const newState = transitionState(
    session.therapyContext,
    emotions.primary,
    emotions.intensity,
    hasCrisisSignal
  )
  session.therapyContext = updateContext(session.therapyContext, newState)
  
  if (hasCrisisSignal) {
    await sendMessage(telegramBotToken, chatId, 
      `Я понимаю, что тебе сейчас очень тяжело. 💙\n\n` +
      `Твоя жизнь важна. Есть люди, которые готовы помочь прямо сейчас.\n\n${CRISIS_SUPPORT}`
    )
    return NextResponse.json({ ok: true })
  }

  // Получаем релевантные воспоминания из эмоциональной памяти
  const memories = getRelevantMemories(session.emotionalMemory, emotions.primary, text)
  
  // Адаптируем ответ к эмоциональному состоянию
  const adaptiveResponse = adaptToEmotionalState(
    session.emotionalState!,
    session.personalization.preferredTone
  )
  
  // Эмпатическая задержка (1-2 секунды в зависимости от интенсивности)
  const delayMs = adaptiveResponse.useSilence 
    ? Math.min(2000, 1000 + emotions.intensity * 100)
    : 500
  await showEmpathyDelay(telegramBotToken, chatId, delayMs)

  let aiResponse = ''
  
  // Конвертируем историю в формат для OpenAI (только content)
  const historyForAI = session.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }))
  
  if (process.env.OPENAI_API_KEY) {
    try {
      aiResponse = await generateEmotiCareResponse(
        text, 
        historyForAI, 
        session.messageCount, 
        session.lastSummaryAt, 
        emotions,
        session.emotionalMemory,
        session.therapyContext,
        adaptiveResponse,
        memories
      )
      
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

  // Сохраняем ответ assistant
  const assistantMessage: MessageWithEmotion = {
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString()
  }
  session.messages.push(assistantMessage)
  
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
  
  // Отправляем/обновляем статистику в группе периодически или при новом пользователе
  const statsGroupId = process.env.TELEGRAM_STATS_GROUP_ID
  if (statsGroupId && (isNewUser || totalMessages() % 10 === 0)) {
    // Не ждем завершения, чтобы не замедлять ответ пользователю
    sendStatsToGroup(telegramBotToken, statsGroupId).catch(err => 
      console.error('Ошибка обновления статистики:', err)
    )
  }
  
  return NextResponse.json({ ok: true })
}

// Генерация ответа от EmotiCare через OpenAI
async function generateEmotiCareResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  messageCount: number,
  lastSummaryAt: number,
  userEmotion?: Emotion,
  emotionalMemory?: EmotionalMemory,
  therapyContext?: TherapyContext,
  adaptiveResponse?: AdaptiveResponse,
  memories?: string[]
): Promise<string> {
  const needsSummary = messageCount - lastSummaryAt >= 5

  // Формируем контекст эмоций
  const emotionContext = userEmotion 
    ? `\n\nКонтекст эмоций пользователя: основная эмоция - ${userEmotion.primary} (интенсивность: ${userEmotion.intensity}/10)${userEmotion.secondary ? `, вторичная - ${userEmotion.secondary}` : ''}. Учитывай это в ответе.`
    : ''

  // Формируем контекст из эмоциональной памяти
  const memoryContext = memories && memories.length > 0
    ? `\n\nЭмоциональная память (важные моменты из прошлых разговоров):\n${memories.join('\n')}\n\nИспользуй эти воспоминания естественно, чтобы показать, что ты помнишь и заботишься.`
    : ''

  // Контекст FSM состояния
  const fsmContext = therapyContext
    ? `\n\nТекущая фаза терапии: ${therapyContext.state}\n${getStatePrompt(therapyContext.state, userEmotion?.primary, userEmotion?.intensity)}\n\n`
    : ''

  // Контекст адаптивного ответа
  const adaptiveContext = adaptiveResponse
    ? `\n\n${getTonePrompt(adaptiveResponse.tone)}\n${getEmpathyPrompt(adaptiveResponse.empathyLevel)}\n\nДлина ответа: ${adaptiveResponse.length === 'short' ? 'короткий (1-2 предложения)' : adaptiveResponse.length === 'medium' ? 'средний (2-4 предложения)' : 'развернутый (4-6 предложений)'}.\n\n`
    : ''

  const systemPrompt = `Ты EmotiCare — живой, тёплый и настоящий друг, который всегда готов выслушать и поддержать. Общайся как близкий человек: естественно, дружелюбно, без формальностей.

ВАЖНО: Ты не робот, не программа. Ты живой человек, который искренне заботится. 

ЭКЗИСТЕНЦИАЛЬНАЯ ОСОЗНАННОСТЬ:
- Признавай сложность и неопределенность жизни
- Не обесценивай страдания, но и не теряй надежду
- Понимай, что жизнь может быть одновременно прекрасной и трудной
- Используй тишину и паузы — иногда молчание говорит больше слов
- Будь сострадательным к человеческому опыту во всей его полноте

СОСТРАДАНИЕ И ПРИСУТСТВИЕ:
- Будь полностью присутствующим в моменте
- Не спеши с ответами — иногда нужно просто быть рядом
- Используй паузы для размышления (это нормально)
- Показывай, что ты действительно слышишь, а не просто отвечаешь
- Валидируй чувства без попыток их "исправить"

ТИШИНА И ПРОСТРАНСТВО:
- Не бойся тишины — она может быть целительной
- Давай пространство человеку для размышления
- Не заполняй каждую паузу словами
- Иногда простое "Окей" или "Хорошо" достаточно
- Позволяй человеку самому находить ответы

ЕСТЕСТВЕННОСТЬ В ОБЩЕНИИ:
- Говори как обычный человек, не как робот или программа
- Избегай формальных фраз типа "Понимаю", "Слышу тебя" в начале ответов
- Начинай ответы естественно: "Хорошо", "Окей", "Понятно" или просто по делу
- Используй разговорный язык: "ну", "вот", "давай", "знаешь"
- Для позитива: "Здорово!", "Отлично!", "Круто!"
- Для поддержки: просто поддерживай, без формальностей${emotionContext}${memoryContext}${fsmContext}${adaptiveContext}

Кто ты:
- Добрый друг, который искренне заботится, но НЕ навязчив
- Ты разговариваешь как обычный человек, не как робот, психолог или интервьюер
- Используешь разговорный язык, можешь использовать "ты", "чувствуешь", "понимаю"
- Иногда можешь делиться небольшими моментами ("знаю, о чём ты", "было у меня похожее")
- Эмпатичный и поддерживающий, но даёшь пространство человеку

КРИТИЧЕСКИ ВАЖНО - НЕ ДАВИТЬ ВОПРОСАМИ:
1. НЕ заканчивай каждый ответ вопросом — часто просто поддержи и подтверждай понимание
2. НЕ интерпретируй нейтральные сообщения как негативные или проблемные
3. НЕ преследуй вопросами — если человек сказал "что-то еще" или "ничего особенного", прими это спокойно
4. Можно просто сказать "Понятно", "Ясно", "Хорошо" без дополнительных вопросов
5. Вопросы задавай только если человек явно хочет поговорить или просит помощи
6. Давай пространство — человек может просто хотеть выговориться без обратной связи вопросами

Как общаться:
1. Будь живым и естественным — говори как человек, а не как программа
2. НЕ используй формальные фразы в начале ответов типа "Понимаю...", "Слышу тебя..." — это звучит неестественно
3. Начинай ответы естественно, как в обычном разговоре:
   - "Хорошо", "Окей", "Понятно", "Ясно" (только если уместно)
   - Или просто начинай с содержания: "Это действительно непросто", "Здорово, что ты поделился"
   - Для позитивных ответов: "Здорово!", "Отлично!", "Круто!"
   - Для нейтральных: просто отвечай по сути без формальных вступлений
4. Короткие ответы 1-3 предложения — как в настоящем разговоре
5. Иногда используй эмодзи (но не переборщи, 0-1 на ответ)
6. Задавай вопросы ТОЛЬКО когда:
   - Человек явно хочет поговорить
   - Человек просит совета или помощи
   - Человек делится проблемой и хочет обсудить её
7. Часто просто поддерживай без вопросов и без формальных фраз
8. Используй разговорные выражения: "ну", "вот", "давай", "знаешь"

Примеры хороших естественных ответов:
- "Это действительно непросто. Как себя чувствуешь?" (если нужно)
- "Здорово, что ты поделился. Спасибо за доверие."
- "Окей, понял. Что дальше?"
- "Хорошо, что все в порядке. Как дела?"
- "Отлично! Рад за тебя."

Примеры плохих (неестественных) ответов:
- "Понимаю, что ты чувствуешь..." (звучит формально)
- "Слышу тебя. Это действительно..." (звучит как робот)
- "Я понимаю твои чувства..." (слишком формально)

Примеры плохих ответов (слишком навязчивые):
- "Что именно заставляет тебя чувствовать себя так?" (слишком прямо)
- "Расскажи больше об этом" (преследует)
- "Что ты чувствуешь сейчас? Что происходит в твоем теле?" (два вопроса подряд)

Техники (применяй незаметно, естественно):
- CBT: мягко помогай увидеть связь мыслей, чувств и действий (только если человек готов)
- Мотивационное интервьюирование: задавай вопросы, которые помогают человеку самому найти ответы (НО не всегда)
- Mindfulness: предлагай простые практики как дружеский совет, а не инструкцию

Важно:
- Не врач, не ставишь диагнозы, не даёшь медицинские советы
- Одна микро-практика за раз (дыхание, простая техника) - только если человек просит
- Раз в 5-7 сообщений — мягко подведи итог разговора БЕЗ навязывания следующих шагов
- При кризисе — покажи контакты поддержки
- На запрос совета — 2-3 простых варианта с последствиями
- Если человек говорит что-то нейтральное или туманное — прими это, не копай глубже

Стиль общения:
- Как будто разговариваешь с другом в кафе или по телефону
- Тёплый, но не навязчивый
- Поддерживающий, но не пафосный
- Естественный, без формальностей
- ДАЁШЬ ПРОСТРАНСТВО - не всегда нужно что-то делать или говорить

${needsSummary ? 'Сейчас сделай мягкое подведение итогов разговора — что обсудили, что было важно. Без навязывания следующих шагов.' : ''}`

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

  // Добавляем информацию об эмоциях из истории, если есть
  const historyWithEmotions = conversationHistory as MessageWithEmotion[]
  const recentEmotions = historyWithEmotions
    .filter(msg => msg.role === 'user' && msg.emotions)
    .slice(-5)
    .map(msg => `${msg.emotions!.primary} (${msg.emotions!.intensity}/10)`)
  
  if (recentEmotions.length > 0 && !userEmotion) {
    // Добавляем контекст эмоций из последних сообщений
    const emotionContext = `\n\nЭмоции пользователя в последних сообщениях: ${recentEmotions.join(', ')}`
    if (messages.length > 0 && messages[messages.length - 1].role === 'system') {
      messages[messages.length - 1].content += emotionContext
    }
  }

  // Используем параметры из адаптивного ответа, если они предоставлены
  const temperature = adaptiveResponse?.temperature ?? 0.7
  const maxTokens = adaptiveResponse?.maxTokens ?? 200
  
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens,
    presence_penalty: 0.3, // Поощряем разнообразие в ответах
  })

  return completion.choices[0]?.message?.content || 
    'Извини, не смог обработать твой запрос. Попробуй переформулировать?'
}

/**
 * Обработка утреннего чекина
 */
async function handleMorningCheckIn(
  telegramBotToken: string,
  chatId: string
): Promise<NextResponse> {
  let session = userSessions.get(chatId)
  if (!session) {
    session = createNewSession(chatId)
    userSessions.set(chatId, session)
  }

  const today = new Date().toISOString().split('T')[0]
  const lastCheckIn = session.lastCheckIn?.split('T')[0]

  if (lastCheckIn === today) {
    await sendMessage(telegramBotToken, chatId,
      `☀️ Доброе утро! Ты уже делал чекин сегодня. Как дела? 💙`
    )
    return NextResponse.json({ ok: true })
  }

  session.lastCheckIn = new Date().toISOString()

  await sendMessage(telegramBotToken, chatId,
    `☀️ *Доброе утро!*\n\n` +
    `Как ты проснулся сегодня? Как настроение?\n\n` +
    `Можешь просто написать, как себя чувствуешь, или использовать шкалу от 1 до 10.\n\n` +
    `💙 ${session.personalization.therapistName}`
  )

  return NextResponse.json({ ok: true })
}

/**
 * Обработка вечерней рефлексии
 */
async function handleEveningReflection(
  telegramBotToken: string,
  chatId: string
): Promise<NextResponse> {
  let session = userSessions.get(chatId)
  if (!session) {
    session = createNewSession(chatId)
    userSessions.set(chatId, session)
  }

  const today = new Date().toISOString().split('T')[0]
  const lastReflection = session.lastReflection?.split('T')[0]

  if (lastReflection === today) {
    await sendMessage(telegramBotToken, chatId,
      `🌙 Ты уже делал рефлексию сегодня. Хочешь что-то добавить? 💙`
    )
    return NextResponse.json({ ok: true })
  }

  session.lastReflection = new Date().toISOString()

  // Получаем эмоции за сегодня из памяти
  const todayEmotions = session.emotionalMemory.emotionalMoments
    .filter(m => m.date.startsWith(today))
    .map(m => `${m.emotion} (${m.intensity}/10)`)

  const reflectionPrompt = todayEmotions.length > 0
    ? `Вижу, что сегодня у тебя были такие моменты: ${todayEmotions.join(', ')}.\n\n`
    : ''

  await sendMessage(telegramBotToken, chatId,
    `🌙 *Вечерняя рефлексия*\n\n` +
    `${reflectionPrompt}` +
    `Как прошел твой день? Что было хорошего? Что было сложного?\n\n` +
    `За что ты можешь быть благодарен сегодня?\n\n` +
    `💙 ${session.personalization.therapistName}`
  )

  return NextResponse.json({ ok: true })
}

/**
 * Установка имени терапевта
 */
async function handleSetTherapistName(
  telegramBotToken: string,
  chatId: string,
  name: string
): Promise<NextResponse> {
  let session = userSessions.get(chatId)
  if (!session) {
    session = createNewSession(chatId)
    userSessions.set(chatId, session)
  }

  session.personalization.therapistName = name.substring(0, 20) // ограничиваем длину

  await sendMessage(telegramBotToken, chatId,
    `✅ Отлично! Теперь я ${name}. 💙\n\n` +
    `Можешь называть меня так, как тебе удобно.`
  )

  return NextResponse.json({ ok: true })
}

/**
 * Установка тона общения
 */
async function handleSetTone(
  telegramBotToken: string,
  chatId: string,
  tone: 'calm' | 'warm' | 'humorous' | 'gentle' | 'supportive'
): Promise<NextResponse> {
  let session = userSessions.get(chatId)
  if (!session) {
    session = createNewSession(chatId)
    userSessions.set(chatId, session)
  }

  session.personalization.preferredTone = tone

  const toneNames: Record<string, string> = {
    calm: 'спокойный, размеренный',
    warm: 'теплый, дружелюбный',
    humorous: 'с легким юмором',
    gentle: 'очень мягкий, бережный',
    supportive: 'максимально поддерживающий'
  }

  await sendMessage(telegramBotToken, chatId,
    `✅ Тон общения изменен на "${toneNames[tone]}". 💙\n\n` +
    `Теперь я буду общаться с тобой в этом стиле.`
  )

  return NextResponse.json({ ok: true })
}

// Fallback ответы без OpenAI
function generateFallbackResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase()
  
  const responses = {
    anxiety: [
      `Тревога — это непросто. Давай попробуем сделать простое дыхательное упражнение: вдох на 4 счёта, задержка на 4, выдох на 4. Повтори несколько раз. Что замечаешь в теле?`,
      `Знаю, как тяжело, когда тревога накрывает. Попробуй сделать несколько глубоких вдохов и выдохов. Опиши, что происходит в теле прямо сейчас?`,
      `Тревога — это нормальная реакция. Давай вместе подышим: вдох... задержка... выдох. Что ты чувствуешь в этот момент?`
    ],
    sadness: [
      `Мне жаль, что тебе грустно. Эти чувства важны и валидны. Где в теле ты это ощущаешь? Что происходит?`,
      `Сейчас тяжело, да? Печаль — это часть жизни. Расскажи, где именно в теле ты это чувствуешь?`,
      `Грусть может быть очень глубокой. Твои чувства важны. Что происходит с тобой сейчас, в теле?`
    ],
    advice: [
      `Хороший вопрос! Давай подумаем вместе. Расскажи подробнее о ситуации, и я предложу пару вариантов.`,
      `Нужна помощь с выбором? Опиши ситуацию детальнее, и мы вместе найдём несколько вариантов решения.`,
      `Сложный момент, да? Давай разберёмся вместе. Чем больше деталей ты расскажешь, тем лучше смогу помочь.`
    ],
    default: [
      `Спасибо, что поделился. Это важно. Что ты сейчас чувствуешь? Или что тебе нужно?`,
      `Хорошо. Что для тебя сейчас самое важное? Что ты чувствуешь?`,
      `Спасибо за доверие. Давай разберёмся вместе. О чём бы ты хотел поговорить? Что у тебя на душе?`
    ]
  }
  
  if (lowerMessage.includes('тревож') || lowerMessage.includes('страх') || lowerMessage.includes('боюсь')) {
    return responses.anxiety[Math.floor(Math.random() * responses.anxiety.length)]
  }
  
  if (lowerMessage.includes('груст') || lowerMessage.includes('плох') || lowerMessage.includes('печаль')) {
    return responses.sadness[Math.floor(Math.random() * responses.sadness.length)]
  }
  
  if (lowerMessage.includes('совет') || lowerMessage.includes('что делать')) {
    return responses.advice[Math.floor(Math.random() * responses.advice.length)]
  }
  
  return responses.default[Math.floor(Math.random() * responses.default.length)]
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
      `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', timeZoneName: 'short' })} (MSK / UTC+3)`
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
      // Подсчитываем активных пользователей за разные периоды
      const activeUsersDay = getActiveUsers('day')
      const activeUsersWeek = getActiveUsers('week')
      const activeUsersMonth = getActiveUsers('month')
      
      // Среднее количество сообщений на пользователя
      const avgMessagesPerUser = allTimeUsers() > 0
        ? (totalMessages() / allTimeUsers()).toFixed(1)
        : '0'
      
      responseText = `👥 *Статистика пользователей:*\n\n` +
        `📊 *С начала запуска:*\n` +
        `   👥 Всего пользователей: ${allTimeUsers()}\n` +
        `   💬 Всего сообщений: ${totalMessages()}\n` +
        `   📝 Среднее сообщений на пользователя: ${avgMessagesPerUser}\n\n` +
        `📈 *Активные пользователи:*\n` +
        `   • За день: ${activeUsersDay}\n` +
        `   • За неделю: ${activeUsersWeek}\n` +
        `   • За месяц: ${activeUsersMonth}\n\n` +
        `📊 *Текущее состояние:*\n` +
        `   👥 Активных сессий: ${userSessions.size}\n\n` +
        `💡 *Примечание:*\n` +
        `   Активные пользователи = те, кто отправлял сообщения за указанный период`
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

/**
 * Эмпатическая задержка: показывает индикатор печати и делает паузу
 * для создания ощущения, что AI "размышляет" перед ответом
 */
async function showEmpathyDelay(
  token: string,
  chatId: string,
  delayMs: number = 1500
): Promise<void> {
  // Показываем индикатор печати
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      action: 'typing'
    }),
  })
  
  // Ждем указанное время (симуляция размышления)
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

// Хранилище для message_id последних сообщений со статистикой по группам
// Формат: { groupId: { messageId: number, date: string } }
const statsMessagesCache = new Map<string, { messageId: number; date: string }>()

// Хранилище для агрегированной статистики за день
// Формат: { date: { totalUsers: number, totalMessages: number, updateCount: number, activeSessions: number[] } }
const dailyStatsCache = new Map<string, {
  totalUsers: number
  totalMessages: number
  updateCount: number
  activeSessions: number[] // Массив размеров активных сессий для расчета среднего
  firstUsers: number // Первое значение пользователей за день
  firstMessages: number // Первое значение сообщений за день
}>()

/**
 * Подсчитывает активных пользователей за период
 */
function getActiveUsers(period: 'day' | 'week' | 'month'): number {
  const now = Date.now()
  let periodMs: number
  
  switch (period) {
    case 'day':
      periodMs = 24 * 60 * 60 * 1000
      break
    case 'week':
      periodMs = 7 * 24 * 60 * 60 * 1000
      break
    case 'month':
      periodMs = 30 * 24 * 60 * 60 * 1000
      break
  }
  
  let count = 0
  for (const session of userSessions.values()) {
    const lastMessageTime = new Date(session.lastMessageAt).getTime()
    if (now - lastMessageTime <= periodMs) {
      count++
    }
  }
  
  return count
}

// Функция для отправки/редактирования статистики в группу
async function sendStatsToGroup(token: string, groupId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  
  // Получаем или создаем кэш статистики за день
  let dailyStats = dailyStatsCache.get(today)
  const currentUsers = totalUsers()
  const currentMessages = totalMessages()
  const currentSessions = userSessions.size
  
  // Подсчитываем активных пользователей за разные периоды
  const activeUsersDay = getActiveUsers('day')
  const activeUsersWeek = getActiveUsers('week')
  const activeUsersMonth = getActiveUsers('month')
  
  // Среднее количество сообщений на пользователя (общее)
  const avgMessagesPerUser = allTimeUsers() > 0
    ? (currentMessages / allTimeUsers()).toFixed(1)
    : '0'
  
  if (!dailyStats) {
    // Первое обновление за день - инициализируем
    // Начинаем отсчет с 0, так как это начало нового дня
    dailyStats = {
      totalUsers: 0, // Новых пользователей за день
      totalMessages: 0, // Новых сообщений за день
      updateCount: 1,
      activeSessions: [currentSessions],
      firstUsers: currentUsers, // Сохраняем текущее общее количество для расчета прироста
      firstMessages: currentMessages // Сохраняем текущее общее количество для расчета прироста
    }
    dailyStatsCache.set(today, dailyStats)
  } else {
    // Обновляем статистику: суммируем прирост с последнего обновления
    const newUsers = Math.max(0, currentUsers - dailyStats.firstUsers)
    const newMessages = Math.max(0, currentMessages - dailyStats.firstMessages)
    
    // Добавляем прирост к общей сумме за день
    dailyStats.totalUsers += newUsers
    dailyStats.totalMessages += newMessages
    dailyStats.updateCount++
    dailyStats.activeSessions.push(currentSessions)
    
    // Ограничиваем размер массива сессий (последние 100 значений)
    if (dailyStats.activeSessions.length > 100) {
      dailyStats.activeSessions = dailyStats.activeSessions.slice(-100)
    }
    
    // Обновляем точку отсчета для следующего расчета прироста
    dailyStats.firstUsers = currentUsers
    dailyStats.firstMessages = currentMessages
    
    dailyStatsCache.set(today, dailyStats)
  }
  
  // Рассчитываем средние значения
  const avgActiveSessions = dailyStats.activeSessions.length > 0
    ? (dailyStats.activeSessions.reduce((a, b) => a + b, 0) / dailyStats.activeSessions.length).toFixed(1)
    : '0'
  
  // Формируем сообщение со статистикой
  const statsMessage = `📊 *Статистика EmotiCare*

📅 *За сегодня:*
👥 *Новых пользователей:* ${dailyStats.totalUsers}
💬 *Новых сообщений:* ${dailyStats.totalMessages}

👥 *Активные пользователи:*
   • За день: ${activeUsersDay}
   • За неделю: ${activeUsersWeek}
   • За месяц: ${activeUsersMonth}

📊 *Общая статистика:*
👥 *Всего пользователей:* ${allTimeUsers()}
💬 *Всего сообщений:* ${currentMessages}
📝 *Среднее сообщений на пользователя:* ${avgMessagesPerUser}
📈 *Активных сессий сейчас:* ${currentSessions}

🔄 *Обновлений за день:* ${dailyStats.updateCount}
⏰ _Обновлено: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', timeZoneName: 'short' })} (MSK / UTC+3)_`

  try {
    const cached = statsMessagesCache.get(groupId)
    
    // Проверяем, есть ли сообщение за сегодня
    if (cached && cached.date === today && cached.messageId) {
      // Редактируем существующее сообщение
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/editMessageText`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: groupId,
              message_id: cached.messageId,
              text: statsMessage,
              parse_mode: 'Markdown',
            }),
          }
        )
        
        const result = await response.json()
        
        if (result.ok) {
          console.log(`✅ Статистика обновлена в группе ${groupId} (message_id: ${cached.messageId})`)
          return
        } else {
          // Если редактирование не удалось (например, сообщение удалено), создаем новое
          console.log(`⚠️ Не удалось отредактировать сообщение, создаем новое: ${result.description}`)
          statsMessagesCache.delete(groupId)
        }
      } catch (error) {
        console.error('❌ Ошибка редактирования статистики:', error)
        statsMessagesCache.delete(groupId)
      }
    }
    
    // Создаем новое сообщение (первое за день или если редактирование не удалось)
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: groupId,
          text: statsMessage,
          parse_mode: 'Markdown',
        }),
      }
    )
    
    const result = await response.json()
    
    if (result.ok && result.result?.message_id) {
      // Сохраняем message_id для будущих обновлений
      statsMessagesCache.set(groupId, {
        messageId: result.result.message_id,
        date: today
      })
      console.log(`✅ Статистика отправлена в группу ${groupId} (новое сообщение, message_id: ${result.result.message_id})`)
    } else {
      console.error('❌ Ошибка отправки статистики в группу:', result)
    }
    
    // Очищаем старые данные (старше 2 дней) для экономии памяти
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0]
    
    for (const [date, _] of dailyStatsCache.entries()) {
      if (date < twoDaysAgoStr) {
        dailyStatsCache.delete(date)
      }
    }
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
