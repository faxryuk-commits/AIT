import { MoodEntry, SleepEntry, Goal } from './store'

export interface CBTInsight {
  cognitiveDistortion?: string
  reframing?: string
  behavioralSuggestion?: string
}

export class AITherapist {
  private getContext(moodEntries: MoodEntry[], sleepEntries: SleepEntry[], goals: Goal[]): string {
    const recentMoods = moodEntries.slice(-7)
    const recentSleep = sleepEntries.slice(-7)
    
    const avgMood = recentMoods.length > 0
      ? recentMoods.reduce((sum, e) => sum + e.mood, 0) / recentMoods.length
      : null
    
    const avgStress = recentMoods.length > 0
      ? recentMoods.reduce((sum, e) => sum + e.stress, 0) / recentMoods.length
      : null
    
    const avgSleep = recentSleep.length > 0
      ? recentSleep.reduce((sum, e) => sum + e.hours, 0) / recentSleep.length
      : null
    
    const completedGoals = goals.filter(g => g.completed).length
    const totalGoals = goals.length
    
    let context = `Информация о клиенте:\n`
    
    if (avgMood !== null) {
      context += `- Среднее настроение за последние 7 дней: ${avgMood.toFixed(1)}/10\n`
    }
    if (avgStress !== null) {
      context += `- Средний уровень стресса: ${avgStress.toFixed(1)}/10\n`
    }
    if (avgSleep !== null) {
      context += `- Средний сон: ${avgSleep.toFixed(1)} часов\n`
    }
    if (totalGoals > 0) {
      context += `- Выполнено целей: ${completedGoals}/${totalGoals}\n`
    }
    
    if (moodEntries.length === 0 && sleepEntries.length === 0) {
      context += `- Клиент только начал использовать приложение`
    }
    
    return context
  }

  async generateResponse(
    userMessage: string,
    moodEntries: MoodEntry[],
    sleepEntries: SleepEntry[],
    goals: Goal[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const userContext = this.getContext(moodEntries, sleepEntries, goals)
    
    try {
      // Пытаемся использовать OpenAI API через наш endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversationHistory || [],
          userContext: userContext,
        }),
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const data = await response.json()

      if (data.usingAI && data.response) {
        // Используем ответ от OpenAI
        return data.response
      }
    } catch (error) {
      console.log('OpenAI не доступен, используем fallback логику:', error)
      // Fallback на простую логику при ошибке
    }

    // Fallback: простая CBT-логика без внешнего API
    return this.generateFallbackResponse(userMessage, moodEntries, sleepEntries, goals)
  }

  private generateFallbackResponse(
    userMessage: string,
    moodEntries: MoodEntry[],
    sleepEntries: SleepEntry[],
    goals: Goal[]
  ): string {
    const lowerMessage = userMessage.toLowerCase()
    
    // Анализ когнитивных искажений
    const distortions = this.detectCognitiveDistortions(lowerMessage)
    
    // Генерация ответа на основе CBT-принципов
    let response = ''
    
    if (distortions.length > 0) {
      response += `Я замечаю, что вы можете использовать когнитивное искажение "${distortions[0].type}". `
      response += `${distortions[0].explanation} `
      response += `Попробуем посмотреть на ситуацию по-другому: ${distortions[0].reframe}\n\n`
    }
    
    // Эмпатичный ответ с CBT-подходом
    if (lowerMessage.includes('тревож') || lowerMessage.includes('страх') || lowerMessage.includes('боюсь')) {
      response += `Понимаю, что вы испытываете тревогу. Это нормальная человеческая эмоция. `
      response += `Давайте попробуем технику "Трех вопросов":\n`
      response += `1. Что самое худшее может произойти?\n`
      response += `2. Какова вероятность, что это произойдет?\n`
      response += `3. Если это произойдет, как я справлюсь?\n\n`
      response += `Что вы думаете о первом вопросе?`
    } else if (lowerMessage.includes('груст') || lowerMessage.includes('плох') || lowerMessage.includes('депресс')) {
      response += `Мне жаль, что вы чувствуете себя плохо. Ваши чувства важны и обоснованы. `
      response += `Давайте попробуем технику "Переформулирования мыслей":\n\n`
      response += `Попробуйте переформулировать негативную мысль в более сбалансированную. `
      response += `Например, вместо "Все плохо" можно сказать "Сейчас сложно, но я могу найти решения".\n\n`
      response += `Что вас сейчас беспокоит больше всего?`
    } else if (lowerMessage.includes('цель') || lowerMessage.includes('задач')) {
      response += `Отличная тема для обсуждения! Постановка целей - важная часть CBT. `
      response += `Хорошая цель должна быть конкретной, измеримой, достижимой, релевантной и ограниченной по времени (SMART).\n\n`
      response += `Расскажите, какую цель вы хотите поставить?`
    } else {
      response += `Спасибо, что поделились. Это важный шаг в работе над собой. `
      response += `Давайте разберем это подробнее. Расскажите, как это влияет на вашу повседневную жизнь?\n\n`
      response += `Также полезно отслеживать свои эмоции и сон - это помогает лучше понять закономерности. `
      response += `Используете ли вы функции отслеживания настроения и сна?`
    }
    
    // Добавляем персонализацию на основе данных
    if (moodEntries.length > 0) {
      const latestMood = moodEntries[moodEntries.length - 1]
      if (latestMood.stress > 7) {
        response += `\n\nЯ вижу, что ваш уровень стресса довольно высок (${latestMood.stress}/10). `
        response += `Может быть, стоит попробовать техники релаксации или дыхательные упражнения?`
      }
    }
    
    return response
  }

  private detectCognitiveDistortions(message: string): Array<{
    type: string
    explanation: string
    reframe: string
  }> {
    const distortions: Array<{ type: string; explanation: string; reframe: string }> = []
    
    // Катастрофизация
    if (message.includes('всегда') || message.includes('никогда') || (message.includes('все') && message.includes('плохо'))) {
      distortions.push({
        type: 'Катастрофизация',
        explanation: 'Вы склонны видеть ситуацию хуже, чем она есть на самом деле.',
        reframe: 'Попробуйте подумать о более вероятных и менее катастрофических исходах.'
      })
    }
    
    // Чёрно-белое мышление
    if (message.includes('все') || message.includes('ничего') || message.includes('всегда') || message.includes('никогда')) {
      if (!distortions.find(d => d.type === 'Катастрофизация')) {
        distortions.push({
          type: 'Чёрно-белое мышление',
          explanation: 'Вы видите только крайности, не замечая промежуточных вариантов.',
          reframe: 'Попробуйте найти промежуточные варианты и нюансы в ситуации.'
        })
      }
    }
    
    // Чтение мыслей
    if (message.includes('думает') || message.includes('считает') || message.includes('думают')) {
      distortions.push({
        type: 'Чтение мыслей',
        explanation: 'Вы предполагаете, что знаете, что думают другие, без доказательств.',
        reframe: 'Попробуйте спросить напрямую или рассмотреть альтернативные объяснения их поведения.'
      })
    }
    
    return distortions
  }

  generateInsight(moodEntries: MoodEntry[], sleepEntries: SleepEntry[], goals: Goal[]): CBTInsight {
    if (moodEntries.length === 0) {
      return {
        behavioralSuggestion: 'Начните отслеживать свое настроение, чтобы лучше понять свои эмоциональные паттерны.'
      }
    }
    
    const recentMoods = moodEntries.slice(-7)
    const avgStress = recentMoods.reduce((sum, e) => sum + e.stress, 0) / recentMoods.length
    
    if (avgStress > 7) {
      return {
        cognitiveDistortion: 'Возможна катастрофизация',
        reframing: 'Высокий уровень стресса может быть связан с искаженным восприятием угроз.',
        behavioralSuggestion: 'Попробуйте техники глубокого дыхания (4-7-8) и физические упражнения для снижения стресса.'
      }
    }
    
    return {
      behavioralSuggestion: 'Продолжайте отслеживать свои эмоции и сон для лучшего понимания себя.'
    }
  }
}

export const therapist = new AITherapist()
