/**
 * Emotional Memory System
 * 
 * Запоминает прошлые сессии и эмоции пользователя для создания
 * более глубокой связи и персонализированного опыта.
 */

export interface EmotionalMemory {
  // Ключевые эмоциональные моменты из прошлых сессий
  emotionalMoments: Array<{
    date: string // ISO date
    emotion: string
    intensity: number
    context: string // краткое описание ситуации
    keywords: string[] // ключевые слова для поиска
  }>
  
  // Долгосрочные паттерны
  patterns: {
    dominantEmotions: Record<string, number> // эмоция -> количество упоминаний
    weeklyTrends: Array<{
      week: string // YYYY-WW
      avgIntensity: number
      topEmotion: string
    }>
    triggers: string[] // триггеры негативных эмоций
  }
  
  // Личная информация (если пользователь поделился)
  personalInfo: {
    name?: string
    workContext?: string
    relationships?: string[]
    interests?: string[]
  }
  
  // Последние упоминания важных тем
  recentTopics: Array<{
    topic: string
    lastMentioned: string
    frequency: number
  }>
}

/**
 * Извлекает релевантные воспоминания для текущего контекста
 */
export function getRelevantMemories(
  memory: EmotionalMemory,
  currentEmotion: string,
  currentText: string
): string[] {
  const relevant: string[] = []
  const lowerText = currentText.toLowerCase()
  
  // Ищем упоминания прошлых тем
  memory.recentTopics.forEach(topic => {
    if (lowerText.includes(topic.topic.toLowerCase())) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(topic.lastMentioned).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysAgo <= 7) {
        relevant.push(`Недавно ты упоминал о "${topic.topic}" (${daysAgo} дней назад).`)
      }
    }
  })
  
  // Ищем похожие эмоциональные моменты
  const similarMoments = memory.emotionalMoments
    .filter(moment => 
      moment.emotion === currentEmotion && 
      moment.intensity >= 7 // только сильные эмоции
    )
    .slice(-3) // последние 3
    
  if (similarMoments.length > 0) {
    const lastMoment = similarMoments[similarMoments.length - 1]
    const daysAgo = Math.floor(
      (Date.now() - new Date(lastMoment.date).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysAgo > 0) {
      relevant.push(
        `Помню, ${daysAgo === 1 ? 'вчера' : `${daysAgo} дней назад`} ты тоже чувствовал ${lastMoment.emotion} (${lastMoment.context}).`
      )
    }
  }
  
  // Проверяем паттерны
  const topEmotion = Object.entries(memory.patterns.dominantEmotions)
    .sort((a, b) => b[1] - a[1])[0]
    
  if (topEmotion && topEmotion[1] >= 3 && topEmotion[0] === currentEmotion) {
    relevant.push(
      `Я замечаю, что ${topEmotion[0]} — это эмоция, которая часто появляется в наших разговорах.`
    )
  }
  
  return relevant
}

/**
 * Обновляет эмоциональную память новым опытом
 */
export function updateEmotionalMemory(
  memory: EmotionalMemory,
  emotion: string,
  intensity: number,
  context: string,
  text: string
): EmotionalMemory {
  const now = new Date().toISOString()
  
  // Добавляем новый эмоциональный момент (только если интенсивность >= 6)
  if (intensity >= 6) {
    memory.emotionalMoments.push({
      date: now,
      emotion,
      intensity,
      context: context.substring(0, 100), // ограничиваем длину
      keywords: extractKeywords(text)
    })
    
    // Ограничиваем размер (храним последние 50 моментов)
    if (memory.emotionalMoments.length > 50) {
      memory.emotionalMoments = memory.emotionalMoments.slice(-50)
    }
  }
  
  // Обновляем паттерны
  memory.patterns.dominantEmotions[emotion] = 
    (memory.patterns.dominantEmotions[emotion] || 0) + 1
  
  // Обновляем недельные тренды
  const week = getWeekString(now)
  const existingWeek = memory.patterns.weeklyTrends.find(w => w.week === week)
  if (existingWeek) {
    existingWeek.avgIntensity = (existingWeek.avgIntensity + intensity) / 2
  } else {
    memory.patterns.weeklyTrends.push({
      week,
      avgIntensity: intensity,
      topEmotion: emotion
    })
    // Храним последние 8 недель
    if (memory.patterns.weeklyTrends.length > 8) {
      memory.patterns.weeklyTrends = memory.patterns.weeklyTrends.slice(-8)
    }
  }
  
  // Обновляем темы
  const topics = extractTopics(text)
  topics.forEach(topic => {
    const existing = memory.recentTopics.find(t => t.topic === topic)
    if (existing) {
      existing.lastMentioned = now
      existing.frequency++
    } else {
      memory.recentTopics.push({
        topic,
        lastMentioned: now,
        frequency: 1
      })
    }
  })
  
  // Ограничиваем количество тем (храним последние 20)
  memory.recentTopics = memory.recentTopics
    .sort((a, b) => new Date(b.lastMentioned).getTime() - new Date(a.lastMentioned).getTime())
    .slice(0, 20)
  
  return memory
}

/**
 * Извлекает ключевые слова из текста
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['и', 'в', 'на', 'с', 'по', 'для', 'как', 'что', 'это', 'то', 'а', 'но', 'или'])
  const words = text.toLowerCase()
    .replace(/[^\p{L}\s]/gu, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
  
  // Возвращаем топ-5 уникальных слов
  const unique = Array.from(new Set(words))
  return unique.slice(0, 5)
}

/**
 * Извлекает темы из текста (упрощенная версия)
 */
function extractTopics(text: string): string[] {
  const topics: string[] = []
  const lowerText = text.toLowerCase()
  
  // Простые паттерны для определения тем
  const topicPatterns: Record<string, string> = {
    'работа|коллеги|начальник|проект|дедлайн': 'работа',
    'семья|родители|дети|родственники': 'семья',
    'друзья|друг|подруга|компания': 'друзья',
    'здоровье|болезнь|врач|лечение': 'здоровье',
    'отношения|партнер|любовь|расставание': 'отношения',
    'учеба|экзамен|университет|школа': 'учеба',
    'деньги|зарплата|покупки|финансы': 'финансы',
    'тревога|страх|беспокойство|паника': 'тревога',
    'грусть|печаль|тоска|одиночество': 'грусть'
  }
  
  Object.entries(topicPatterns).forEach(([pattern, topic]) => {
    if (new RegExp(pattern).test(lowerText) && !topics.includes(topic)) {
      topics.push(topic)
    }
  })
  
  return topics
}

/**
 * Получает строку недели в формате YYYY-WW
 */
function getWeekString(date: string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const start = new Date(year, 0, 1)
  const days = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.ceil((days + start.getDay() + 1) / 7)
  return `${year}-W${week.toString().padStart(2, '0')}`
}

/**
 * Создает пустую эмоциональную память
 */
export function createEmptyMemory(): EmotionalMemory {
  return {
    emotionalMoments: [],
    patterns: {
      dominantEmotions: {},
      weeklyTrends: [],
      triggers: []
    },
    personalInfo: {},
    recentTopics: []
  }
}

