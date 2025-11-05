import { NextRequest, NextResponse } from 'next/server'

// Импортируем типы и хранилище из webhook (в production лучше использовать общую БД)
// Здесь мы используем упрощенную версию для демонстрации

interface Emotion {
  primary: string
  secondary?: string
  intensity: number
  timestamp: string
}

interface EmotionDataPoint {
  date: string // YYYY-MM-DD
  emotion: string
  intensity: number
  count: number
}

// GET /api/emotions?chatId=xxx
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chatId = searchParams.get('chatId')

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId is required' },
        { status: 400 }
      )
    }

    // В production здесь должен быть запрос к БД
    // Для демонстрации используем временное решение
    // В реальности нужно импортировать userSessions или использовать БД
    
    // Получаем эмоции за последнюю неделю
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    // Здесь должен быть запрос к БД
    // const emotions = await db.getUserEmotions(chatId, weekAgo)
    
    // Временная заглушка - в production заменить на реальный запрос
    const emotions: Emotion[] = []
    
    // Агрегация по датам и эмоциям
    const emotionMap = new Map<string, EmotionDataPoint>()
    
    emotions.forEach(emotion => {
      const date = new Date(emotion.timestamp).toISOString().split('T')[0]
      const key = `${date}_${emotion.primary}`
      
      if (emotionMap.has(key)) {
        const existing = emotionMap.get(key)!
        existing.count++
        existing.intensity = (existing.intensity + emotion.intensity) / 2
      } else {
        emotionMap.set(key, {
          date,
          emotion: emotion.primary,
          intensity: emotion.intensity,
          count: 1
        })
      }
    })
    
    const aggregatedData = Array.from(emotionMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
    
    // Группировка по датам для графика
    const dailyEmotions: Record<string, { emotion: string; intensity: number }[]> = {}
    
    aggregatedData.forEach(item => {
      if (!dailyEmotions[item.date]) {
        dailyEmotions[item.date] = []
      }
      dailyEmotions[item.date].push({
        emotion: item.emotion,
        intensity: item.intensity
      })
    })
    
    return NextResponse.json({
      success: true,
      data: {
        dailyEmotions,
        aggregatedData,
        period: {
          from: weekAgo.toISOString(),
          to: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error fetching emotions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
