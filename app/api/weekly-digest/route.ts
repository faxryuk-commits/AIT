import { NextRequest, NextResponse } from 'next/server'

// Weekly дайджест - отправляется раз в неделю
// Этот endpoint можно вызывать через cron job или вручную

interface WeeklyDigestData {
  userId: string
  weekEmotions: {
    emotion: string
    count: number
    avgIntensity: number
  }[]
  totalMessages: number
  topEmotion: string
  practiceOfTheWeek: string
}

// POST /api/weekly-digest - генерация и отправка дайджеста
export async function POST(request: NextRequest) {
  try {
    const { chatId, telegramBotToken } = await request.json()

    if (!chatId || !telegramBotToken) {
      return NextResponse.json(
        { error: 'chatId and telegramBotToken are required' },
        { status: 400 }
      )
    }

    // В production здесь должен быть запрос к БД для получения данных пользователя
    // Для демонстрации используем упрощенную версию
    
    // Получаем эмоции за последнюю неделю
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    // Здесь должен быть запрос к БД
    // const session = await db.getUserSession(chatId)
    // const weekEmotions = session.messages.filter(...)
    
    // Временная заглушка
    const weekEmotions: WeeklyDigestData['weekEmotions'] = []
    const totalMessages = 0
    const topEmotion = 'neutral'
    
    // Практика недели (можно генерировать через AI или использовать готовые)
    const practices = [
      {
        title: 'Техника 4-7-8 для успокоения',
        description: 'Вдох на 4 счёта, задержка на 7, выдох на 8. Повтори 4 раза. Помогает быстро успокоиться.'
      },
      {
        title: 'Дневник благодарности',
        description: 'Каждый день записывай 3 вещи, за которые благодарен. Улучшает общее настроение.'
      },
      {
        title: 'Медитация осознанности',
        description: '5 минут в день: сядь удобно, дыши естественно, замечай мысли без оценки.'
      },
      {
        title: 'Техника "Якорь"',
        description: 'Вспомни момент полного спокойствия. Закрой глаза, представь детали, заякори ощущение.'
      },
      {
        title: 'Прогрессивная мышечная релаксация',
        description: 'Напрягай и расслабляй мышцы по порядку (ноги → руки → туловище). Снимает напряжение.'
      }
    ]
    
    const practiceOfTheWeek = practices[Math.floor(Math.random() * practices.length)]

    // Формируем дайджест
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

    const digest = `📊 *Еженедельный дайджест EmotiCare*\n\n` +
      `_Период: ${weekAgo.toLocaleDateString('ru-RU')} - ${new Date().toLocaleDateString('ru-RU')}_\n\n` +
      `💬 *Всего сообщений за неделю:* ${totalMessages}\n` +
      `🎭 *Основная эмоция:* ${emotionEmojis[topEmotion] || '📝'} ${topEmotion}\n\n` +
      (weekEmotions.length > 0
        ? `*Эмоциональный профиль недели:*\n` +
          weekEmotions
            .slice(0, 5)
            .map(e => `${emotionEmojis[e.emotion] || '📝'} ${e.emotion}: ${e.count} раз (интенсивность: ${e.avgIntensity.toFixed(1)}/10)`)
            .join('\n') + `\n\n`
        : '') +
      `🧘 *Практика недели:*\n` +
      `*${practiceOfTheWeek.title}*\n` +
      `${practiceOfTheWeek.description}\n\n` +
      `💙 Продолжай отслеживать свои эмоции и практиковать заботу о себе!`

    // Отправляем дайджест пользователю
    const response = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: digest,
          parse_mode: 'Markdown',
        }),
      }
    )

    const result = await response.json()

    if (!result.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(result)}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly digest sent successfully'
    })
  } catch (error) {
    console.error('Error sending weekly digest:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
