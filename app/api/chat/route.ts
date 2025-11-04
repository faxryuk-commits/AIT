import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory, userContext } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      // Fallback на простую логику, если OpenAI не настроен
      return NextResponse.json({
        response: 'Извините, AI-сервис временно недоступен. Пожалуйста, используйте простые команды или обратитесь позже.',
        usingAI: false
      })
    }

    // Формируем системный промпт для CBT-терапевта
    const systemPrompt = `Ты - профессиональный психотерапевт, специализирующийся на когнитивно-поведенческой терапии (CBT). 

Твоя задача:
1. Быть эмпатичным, поддерживающим и профессиональным
2. Выявлять когнитивные искажения в мыслях клиента
3. Помогать переформулировать негативные мысли в более сбалансированные
4. Предлагать конкретные CBT-техники и упражнения
5. Не давать медицинские диагнозы или заменять профессиональную терапию

Контекст клиента:
${userContext || 'Информация о клиенте пока отсутствует'}

Важно:
- Отвечай кратко, но информативно (до 200 слов)
- Используй принципы CBT
- Будь теплым и понимающим
- Задавай открытые вопросы для лучшего понимания ситуации`

    // Формируем историю диалога для контекста
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ]

    // Добавляем историю диалога (последние 10 сообщений для контекста)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10)
      recentHistory.forEach((msg: { role: string; content: string }) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })
      })
    }

    // Добавляем текущее сообщение
    messages.push({
      role: 'user',
      content: message,
    })

    // Вызываем OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Используем более дешевую модель по умолчанию
      messages: messages,
      temperature: 0.7, // Баланс между креативностью и консистентностью
      max_tokens: 500,
    })

    const aiResponse = completion.choices[0]?.message?.content || 
      'Извините, не удалось получить ответ. Попробуйте еще раз.'

    return NextResponse.json({
      response: aiResponse,
      usingAI: true,
    })
  } catch (error) {
    console.error('OpenAI API Error:', error)
    
    // Fallback на простую логику при ошибке
    return NextResponse.json({
      response: 'Извините, произошла ошибка при обработке запроса. Попробуйте переформулировать вопрос или обратитесь позже.',
      usingAI: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
