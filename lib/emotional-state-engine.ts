/**
 * Emotional State Engine
 * 
 * Адаптирует тон, длину ответов и стиль общения
 * в зависимости от эмоционального состояния пользователя
 */

export interface EmotionalState {
  primaryEmotion: string
  intensity: number // 1-10
  stressLevel: number // 1-10
  trend: 'improving' | 'stable' | 'declining'
  lastIntensity: number // для определения тренда
}

export type Tone = 'calm' | 'warm' | 'humorous' | 'gentle' | 'supportive'
export type ResponseLength = 'short' | 'medium' | 'long'

export interface AdaptiveResponse {
  tone: Tone
  length: ResponseLength
  maxTokens: number
  temperature: number
  useSilence: boolean // использовать ли паузы и тишину
  empathyLevel: 'low' | 'medium' | 'high'
}

/**
 * Определяет адаптивный ответ на основе эмоционального состояния
 */
export function adaptToEmotionalState(
  state: EmotionalState,
  userTonePreference?: Tone
): AdaptiveResponse {
  // Базовый тон из предпочтений пользователя или по умолчанию
  const baseTone = userTonePreference || 'warm'
  
  // Адаптация тона в зависимости от интенсивности
  let tone: Tone = baseTone
  if (state.intensity >= 8) {
    // Высокая интенсивность - более спокойный и поддерживающий тон
    tone = 'gentle'
  } else if (state.intensity >= 6) {
    // Средняя-высокая - теплый и поддерживающий
    tone = 'supportive'
  } else if (state.intensity <= 3) {
    // Низкая интенсивность - можно использовать более легкий тон
    if (baseTone === 'humorous') {
      tone = 'humorous'
    } else {
      tone = 'warm'
    }
  }
  
  // Длина ответа в зависимости от интенсивности и стресса
  let length: ResponseLength = 'medium'
  let maxTokens = 200
  
  if (state.intensity >= 8 || state.stressLevel >= 8) {
    // Высокая интенсивность - короткие, четкие ответы
    length = 'short'
    maxTokens = 100
  } else if (state.intensity <= 3) {
    // Низкая интенсивность - можно более развернутые ответы
    length = 'medium'
    maxTokens = 250
  } else {
    length = 'medium'
    maxTokens = 200
  }
  
  // Temperature для креативности
  let temperature = 0.7
  if (state.intensity >= 8) {
    // Высокая интенсивность - более консервативные ответы
    temperature = 0.5
  } else if (state.intensity <= 3) {
    // Низкая интенсивность - можно более креативные
    temperature = 0.8
  }
  
  // Использование тишины и пауз
  const useSilence = state.intensity >= 6 || state.stressLevel >= 6
  
  // Уровень эмпатии
  let empathyLevel: 'low' | 'medium' | 'high' = 'medium'
  if (state.intensity >= 7) {
    empathyLevel = 'high'
  } else if (state.intensity <= 3) {
    empathyLevel = 'low'
  }
  
  return {
    tone,
    length,
    maxTokens,
    temperature,
    useSilence,
    empathyLevel
  }
}

/**
 * Обновляет эмоциональное состояние на основе новой эмоции
 */
export function updateEmotionalState(
  currentState: EmotionalState | null,
  newEmotion: string,
  newIntensity: number,
  stressLevel?: number
): EmotionalState {
  const lastIntensity = currentState?.intensity || newIntensity
  
  // Определяем тренд
  let trend: 'improving' | 'stable' | 'declining' = 'stable'
  if (newIntensity < lastIntensity - 1) {
    trend = 'improving'
  } else if (newIntensity > lastIntensity + 1) {
    trend = 'declining'
  }
  
  return {
    primaryEmotion: newEmotion,
    intensity: newIntensity,
    stressLevel: stressLevel || currentState?.stressLevel || newIntensity,
    trend,
    lastIntensity
  }
}

/**
 * Получает промпт для тона общения
 */
export function getTonePrompt(tone: Tone): string {
  const tonePrompts: Record<Tone, string> = {
    calm: 'Говори спокойно, размеренно. Используй мягкие формулировки. Создавай ощущение стабильности и безопасности.',
    warm: 'Говори тепло и дружелюбно. Используй "ты", будь близким другом. Показывай искреннюю заботу.',
    humorous: 'Можешь использовать легкий юмор, но очень аккуратно. Не шути над серьезными темами. Юмор должен быть поддерживающим, не обесценивающим.',
    gentle: 'Говори очень мягко и бережно. Каждое слово должно быть продуманным. Создавай максимально безопасное пространство.',
    supportive: 'Будь максимально поддерживающим. Валидируй чувства. Показывай, что человек не один.'
  }
  
  return tonePrompts[tone] || tonePrompts.warm
}

/**
 * Получает инструкции для уровня эмпатии
 */
export function getEmpathyPrompt(level: 'low' | 'medium' | 'high'): string {
  const empathyPrompts = {
    low: 'Будь легким и дружелюбным. Не нужно глубоко погружаться в эмоции.',
    medium: 'Показывай понимание и сочувствие. Валидируй чувства, но не перегружай.',
    high: 'Максимальная эмпатия. Глубоко валидируй эмоции. Покажи, что полностью понимаешь и принимаешь чувства человека. Используй техники активного слушания.'
  }
  
  return empathyPrompts[level]
}

