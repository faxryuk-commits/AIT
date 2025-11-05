/**
 * Emotion Analytics
 * 
 * Анализ эмоциональных трендов и паттернов
 */

import { EmotionalMemory } from './emotional-memory'

export interface EmotionTrend {
  emotion: string
  frequency: number // сколько раз встречалась
  avgIntensity: number // средняя интенсивность
  trend: 'increasing' | 'stable' | 'decreasing' // тренд за период
  lastWeek: number // частота на прошлой неделе
  thisWeek: number // частота на этой неделе
}

export interface WeeklyEmotionReport {
  dominantEmotions: EmotionTrend[]
  overallTrend: 'improving' | 'stable' | 'declining'
  avgIntensity: number
  mostFrequentEmotion: string
  intensityTrend: 'increasing' | 'stable' | 'decreasing'
  recommendations: string[]
}

/**
 * Анализирует эмоциональные тренды за последние недели
 */
export function analyzeEmotionTrends(
  memory: EmotionalMemory,
  weeks: number = 2
): WeeklyEmotionReport {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  
  // Фильтруем моменты за последние недели
  const thisWeekMoments = memory.emotionalMoments.filter(
    m => new Date(m.date) >= weekAgo
  )
  const lastWeekMoments = memory.emotionalMoments.filter(
    m => {
      const date = new Date(m.date)
      return date >= twoWeeksAgo && date < weekAgo
    }
  )
  
  // Агрегируем эмоции
  const thisWeekEmotions: Record<string, { count: number; totalIntensity: number }> = {}
  const lastWeekEmotions: Record<string, { count: number; totalIntensity: number }> = {}
  
  thisWeekMoments.forEach(m => {
    if (!thisWeekEmotions[m.emotion]) {
      thisWeekEmotions[m.emotion] = { count: 0, totalIntensity: 0 }
    }
    thisWeekEmotions[m.emotion].count++
    thisWeekEmotions[m.emotion].totalIntensity += m.intensity
  })
  
  lastWeekMoments.forEach(m => {
    if (!lastWeekEmotions[m.emotion]) {
      lastWeekEmotions[m.emotion] = { count: 0, totalIntensity: 0 }
    }
    lastWeekEmotions[m.emotion].count++
    lastWeekEmotions[m.emotion].totalIntensity += m.intensity
  })
  
  // Создаем тренды
  const allEmotions = new Set([
    ...Object.keys(thisWeekEmotions),
    ...Object.keys(lastWeekEmotions)
  ])
  
  const trends: EmotionTrend[] = Array.from(allEmotions).map(emotion => {
    const thisWeek = thisWeekEmotions[emotion] || { count: 0, totalIntensity: 0 }
    const lastWeek = lastWeekEmotions[emotion] || { count: 0, totalIntensity: 0 }
    
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (thisWeek.count > lastWeek.count * 1.2) {
      trend = 'increasing'
    } else if (thisWeek.count < lastWeek.count * 0.8) {
      trend = 'decreasing'
    }
    
    return {
      emotion,
      frequency: thisWeek.count,
      avgIntensity: thisWeek.count > 0 
        ? thisWeek.totalIntensity / thisWeek.count 
        : 0,
      trend,
      lastWeek: lastWeek.count,
      thisWeek: thisWeek.count
    }
  })
  
  // Сортируем по частоте
  trends.sort((a, b) => b.frequency - a.frequency)
  
  // Определяем общий тренд
  const positiveEmotions = ['joy', 'calm', 'excited']
  const negativeEmotions = ['sadness', 'anger', 'fear', 'anxiety', 'overwhelmed']
  
  const positiveCount = trends
    .filter(t => positiveEmotions.includes(t.emotion))
    .reduce((sum, t) => sum + t.frequency, 0)
  const negativeCount = trends
    .filter(t => negativeEmotions.includes(t.emotion))
    .reduce((sum, t) => sum + t.frequency, 0)
  
  let overallTrend: 'improving' | 'stable' | 'declining' = 'stable'
  if (positiveCount > negativeCount * 1.5) {
    overallTrend = 'improving'
  } else if (negativeCount > positiveCount * 1.5) {
    overallTrend = 'declining'
  }
  
  // Средняя интенсивность
  const avgIntensity = thisWeekMoments.length > 0
    ? thisWeekMoments.reduce((sum, m) => sum + m.intensity, 0) / thisWeekMoments.length
    : 0
  
  // Самая частая эмоция
  const mostFrequent = trends.length > 0 ? trends[0].emotion : 'neutral'
  
  // Тренд интенсивности
  const lastWeekAvgIntensity = lastWeekMoments.length > 0
    ? lastWeekMoments.reduce((sum, m) => sum + m.intensity, 0) / lastWeekMoments.length
    : 0
  
  let intensityTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
  if (avgIntensity > lastWeekAvgIntensity + 1) {
    intensityTrend = 'increasing'
  } else if (avgIntensity < lastWeekAvgIntensity - 1) {
    intensityTrend = 'decreasing'
  }
  
  // Рекомендации
  const recommendations: string[] = []
  
  if (overallTrend === 'declining') {
    recommendations.push('Заметил, что в последнее время больше негативных эмоций. Может быть полезно добавить больше практик саморегуляции.')
  }
  
  if (intensityTrend === 'increasing' && avgIntensity > 7) {
    recommendations.push('Интенсивность эмоций довольно высокая. Важно находить способы снижения стресса.')
  }
  
  if (trends.some(t => t.emotion === 'anxiety' && t.trend === 'increasing')) {
    recommendations.push('Тревога стала появляться чаще. Может помочь практика заземления или дыхательные упражнения.')
  }
  
  if (trends.some(t => positiveEmotions.includes(t.emotion) && t.trend === 'increasing')) {
    recommendations.push('Заметил больше позитивных моментов — это отлично! Продолжай отслеживать, что помогает тебе чувствовать себя лучше.')
  }
  
  return {
    dominantEmotions: trends.slice(0, 5), // топ-5
    overallTrend,
    avgIntensity,
    mostFrequentEmotion: mostFrequent,
    intensityTrend,
    recommendations
  }
}

/**
 * Форматирует отчет для пользователя
 */
export function formatEmotionReport(report: WeeklyEmotionReport): string {
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
  
  const trendEmojis = {
    increasing: '📈',
    stable: '➡️',
    decreasing: '📉',
    improving: '✨',
    declining: '⚠️'
  }
  
  let text = `📊 *Эмоциональный анализ за неделю*\n\n`
  
  // Общий тренд
  text += `*Общая динамика:* ${trendEmojis[report.overallTrend]} ${report.overallTrend === 'improving' ? 'Улучшение' : report.overallTrend === 'declining' ? 'Снижение' : 'Стабильно'}\n`
  text += `*Средняя интенсивность:* ${report.avgIntensity.toFixed(1)}/10 ${trendEmojis[report.intensityTrend]}\n\n`
  
  // Доминирующие эмоции
  text += `*Топ эмоций:*\n`
  report.dominantEmotions.forEach((trend, index) => {
    const emoji = emotionEmojis[trend.emotion] || '📝'
    const trendEmoji = trendEmojis[trend.trend]
    text += `${index + 1}. ${emoji} ${trend.emotion}: ${trend.frequency} раз (интенсивность ${trend.avgIntensity.toFixed(1)}/10) ${trendEmoji}\n`
  })
  
  // Рекомендации
  if (report.recommendations.length > 0) {
    text += `\n*Рекомендации:*\n`
    report.recommendations.forEach((rec, index) => {
      text += `${index + 1}. ${rec}\n`
    })
  }
  
  return text
}

