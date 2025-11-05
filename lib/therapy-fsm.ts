/**
 * Therapy Flow FSM (Finite State Machine)
 * 
 * Управляет терапевтическим потоком CBT:
 * Reflect emotion → Cognitive reframing → Behavioral suggestion → Summary
 */

export type TherapyState = 
  | 'idle'                    // Начальное состояние, ожидание
  | 'reflecting_emotion'      // Отражение и валидация эмоции
  | 'cognitive_reframing'      // Когнитивное переформулирование
  | 'behavioral_suggestion'    // Поведенческие предложения
  | 'summary'                 // Подведение итогов
  | 'crisis_support'          // Кризисная поддержка

export interface TherapyContext {
  state: TherapyState
  emotion?: string
  intensity?: number
  cognitiveDistortion?: string
  reframingAttempts: number
  suggestionsGiven: number
  lastStateChange: number // timestamp
  sessionStart: number
}

/**
 * Переходы между состояниями FSM
 */
export function transitionState(
  context: TherapyContext,
  currentEmotion?: string,
  intensity?: number,
  hasCrisis?: boolean
): TherapyState {
  const now = Date.now()
  const timeInState = now - context.lastStateChange
  
  // Кризис всегда имеет приоритет
  if (hasCrisis) {
    return 'crisis_support'
  }
  
  // Если кризис разрешен, возвращаемся к обычному потоку
  if (context.state === 'crisis_support' && !hasCrisis) {
    return 'idle'
  }
  
  switch (context.state) {
    case 'idle':
      // Переход к отражению эмоции, если она обнаружена
      if (currentEmotion && intensity && intensity >= 5) {
        return 'reflecting_emotion'
      }
      return 'idle'
      
    case 'reflecting_emotion':
      // После отражения эмоции переходим к когнитивному переформулированию
      // Минимум 2 сообщения в состоянии отражения
      if (context.reframingAttempts === 0 && timeInState > 2000) {
        return 'cognitive_reframing'
      }
      return 'reflecting_emotion'
      
    case 'cognitive_reframing':
      // После попытки переформулирования предлагаем поведенческие техники
      if (context.reframingAttempts >= 1) {
        return 'behavioral_suggestion'
      }
      return 'cognitive_reframing'
      
    case 'behavioral_suggestion':
      // После предложения техник подводим итоги
      if (context.suggestionsGiven >= 1) {
        return 'summary'
      }
      return 'behavioral_suggestion'
      
    case 'summary':
      // После подведения итогов возвращаемся к idle
      // Или продолжаем, если эмоция все еще сильная
      if (currentEmotion && intensity && intensity >= 7) {
        return 'reflecting_emotion' // Повторный цикл для сильных эмоций
      }
      return 'idle'
      
    default:
      return 'idle'
  }
}

/**
 * Получает промпт для текущего состояния
 */
export function getStatePrompt(
  state: TherapyState,
  emotion?: string,
  intensity?: number
): string {
  switch (state) {
    case 'reflecting_emotion':
      return `Сейчас ты в состоянии отражения эмоции. 
Важно: глубоко валидируй эмоцию пользователя, покажи, что понимаешь.
Не спеши с советами - сначала дай человеку почувствовать, что его слышат.
Эмоция: ${emotion || 'не определена'}, интенсивность: ${intensity || 0}/10`
      
    case 'cognitive_reframing':
      return `Сейчас ты в состоянии когнитивного переформулирования.
Важно: мягко помогай увидеть альтернативные перспективы.
Используй технику "А что если...?" или "Как еще можно посмотреть на это?"
Избегай прямых указаний - предлагай вопросы для размышления.`
      
    case 'behavioral_suggestion':
      return `Сейчас ты в состоянии поведенческих предложений.
Важно: предлагай конкретные, выполнимые техники.
Одна техника за раз. Используй CBT техники: дыхание, grounding, поведенческая активация.
Спроси, что человек готов попробовать прямо сейчас.`
      
    case 'summary':
      return `Сейчас ты подводишь итоги сессии.
Важно: кратко резюмируй ключевые моменты разговора.
Спроси, что человек вынес из разговора.
Предложи следующий шаг или практику на сегодня.`
      
    case 'crisis_support':
      return `КРИЗИСНАЯ СИТУАЦИЯ.
Важно: немедленно покажи контакты помощи.
Будь максимально поддерживающим и сострадательным.
Не давай советы - направляй к профессиональной помощи.`
      
    default:
      return `Обычное общение. Будь эмпатичным и поддерживающим.
Слушай внимательно и отвечай естественно.`
  }
}

/**
 * Обновляет контекст после перехода состояния
 */
export function updateContext(
  context: TherapyContext,
  newState: TherapyState
): TherapyContext {
  const now = Date.now()
  
  // Обновляем счетчики в зависимости от нового состояния
  if (newState === 'cognitive_reframing') {
    context.reframingAttempts++
  } else if (newState === 'behavioral_suggestion') {
    context.suggestionsGiven++
  }
  
  return {
    ...context,
    state: newState,
    lastStateChange: now
  }
}

/**
 * Создает новый контекст терапии
 */
export function createTherapyContext(): TherapyContext {
  return {
    state: 'idle',
    reframingAttempts: 0,
    suggestionsGiven: 0,
    lastStateChange: Date.now(),
    sessionStart: Date.now()
  }
}

/**
 * Проверяет, нужно ли сбросить состояние (например, после долгого перерыва)
 */
export function shouldResetContext(context: TherapyContext): boolean {
  const now = Date.now()
  const timeSinceLastChange = now - context.lastStateChange
  
  // Если прошло больше 10 минут без активности, сбрасываем
  if (timeSinceLastChange > 10 * 60 * 1000) {
    return true
  }
  
  // Если прошло больше 30 минут с начала сессии, сбрасываем
  if (now - context.sessionStart > 30 * 60 * 1000) {
    return true
  }
  
  return false
}

