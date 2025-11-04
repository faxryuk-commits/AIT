'use client'

import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { therapist } from '@/lib/ai-therapist'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function ChatInterface() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, moodEntries, sleepEntries, goals, addMessage } = useStore()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Приветственное сообщение при первом запуске
    if (messages.length === 0) {
      addMessage({
        role: 'assistant',
        content: 'Привет! Я ваш AI-терапевт, специализирующийся на когнитивно-поведенческой терапии. Я здесь, чтобы помочь вам лучше понять себя, справиться со стрессом и улучшить ваше эмоциональное состояние.\n\nКак дела сегодня? Что бы вы хотели обсудить?'
      })
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    
    // Добавляем сообщение пользователя
    addMessage({
      role: 'user',
      content: userMessage
    })

    setIsLoading(true)

    try {
      // Формируем историю диалога для контекста
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      // Генерируем ответ от AI-терапевта с историей диалога
      const response = await therapist.generateResponse(
        userMessage,
        moodEntries,
        sleepEntries,
        goals,
        conversationHistory
      )

      // Добавляем ответ ассистента
      addMessage({
        role: 'assistant',
        content: response
      })
    } catch (error) {
      console.error('Error generating response:', error)
      addMessage({
        role: 'assistant',
        content: 'Извините, произошла ошибка. Пожалуйста, попробуйте еще раз.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl mx-auto">
      <div className="card flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-primary-500'
                    : 'bg-purple-500'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>
              <div
                className={`flex-1 rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary-50 text-primary-900'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs mt-2 opacity-60">
                  {format(message.timestamp, 'HH:mm', { locale: ru })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 rounded-lg p-4 bg-gray-100">
                <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex space-x-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Напишите сообщение..."
              className="flex-1 input-field resize-none min-h-[60px] max-h-32"
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="btn-primary self-end disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
