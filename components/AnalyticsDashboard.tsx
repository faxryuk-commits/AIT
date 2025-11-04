'use client'

import { useStore } from '@/lib/store'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, subDays, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { therapist } from '@/lib/ai-therapist'

export default function AnalyticsDashboard() {
  const { moodEntries, sleepEntries, goals } = useStore()

  // Подготовка данных для графиков
  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i))
  
  const moodChartData = last7Days.map((date) => {
    const entry = moodEntries.find(
      (e) => format(parseISO(e.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    )
    return {
      date: format(date, 'd MMM', { locale: ru }),
      Настроение: entry?.mood || null,
      Стресс: entry?.stress || null,
      Тревога: entry?.anxiety || null,
      Энергия: entry?.energy || null,
    }
  })

  const sleepChartData = last7Days.map((date) => {
    const entry = sleepEntries.find(
      (e) => format(parseISO(e.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    )
    return {
      date: format(date, 'd MMM', { locale: ru }),
      Часы: entry?.hours || null,
      Качество: entry?.quality || null,
    }
  })

  // Статистика
  const totalMoodEntries = moodEntries.length
  const avgMood = moodEntries.length > 0
    ? moodEntries.reduce((sum, e) => sum + e.mood, 0) / moodEntries.length
    : 0
  const avgStress = moodEntries.length > 0
    ? moodEntries.reduce((sum, e) => sum + e.stress, 0) / moodEntries.length
    : 0
  const avgSleep = sleepEntries.length > 0
    ? sleepEntries.reduce((sum, e) => sum + e.hours, 0) / sleepEntries.length
    : 0
  const completedGoals = goals.filter(g => g.completed).length
  const goalCompletionRate = goals.length > 0
    ? (completedGoals / goals.length) * 100
    : 0

  // Тренды (сравнение последних 7 дней с предыдущими 7 днями)
  const recent7Moods = moodEntries.slice(-7)
  const previous7Moods = moodEntries.slice(-14, -7)
  
  const recentAvgMood = recent7Moods.length > 0
    ? recent7Moods.reduce((sum, e) => sum + e.mood, 0) / recent7Moods.length
    : 0
  const previousAvgMood = previous7Moods.length > 0
    ? previous7Moods.reduce((sum, e) => sum + e.mood, 0) / previous7Moods.length
    : 0

  const moodTrend = recentAvgMood > previousAvgMood ? 'up' : recentAvgMood < previousAvgMood ? 'down' : 'stable'

  // CBT-инсайты
  const insight = therapist.generateInsight(moodEntries, sleepEntries, goals)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Аналитика и инсайты</h2>

      {/* Статистические карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Среднее настроение</p>
              <p className="text-2xl font-bold mt-1">{avgMood.toFixed(1)}/10</p>
            </div>
            {moodTrend === 'up' && <TrendingUp className="w-8 h-8 text-green-500" />}
            {moodTrend === 'down' && <TrendingDown className="w-8 h-8 text-red-500" />}
            {moodTrend === 'stable' && <Activity className="w-8 h-8 text-gray-400" />}
          </div>
        </div>

        <div className="card">
          <div>
            <p className="text-sm text-gray-500">Средний стресс</p>
            <p className="text-2xl font-bold mt-1">{avgStress.toFixed(1)}/10</p>
          </div>
        </div>

        <div className="card">
          <div>
            <p className="text-sm text-gray-500">Средний сон</p>
            <p className="text-2xl font-bold mt-1">{avgSleep.toFixed(1)} ч</p>
          </div>
        </div>

        <div className="card">
          <div>
            <p className="text-sm text-gray-500">Выполнение целей</p>
            <p className="text-2xl font-bold mt-1">{goalCompletionRate.toFixed(0)}%</p>
            <p className="text-sm text-gray-500 mt-1">{completedGoals}/{goals.length}</p>
          </div>
        </div>
      </div>

      {/* CBT Инсайты */}
      {insight && (
        <div className="card bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-purple-600" />
            CBT-инсайт
          </h3>
          {insight.cognitiveDistortion && (
            <div className="mb-2">
              <p className="font-medium text-purple-800">Когнитивное искажение:</p>
              <p className="text-gray-700">{insight.cognitiveDistortion}</p>
            </div>
          )}
          {insight.reframing && (
            <div className="mb-2">
              <p className="font-medium text-purple-800">Переформулирование:</p>
              <p className="text-gray-700">{insight.reframing}</p>
            </div>
          )}
          {insight.behavioralSuggestion && (
            <div>
              <p className="font-medium text-purple-800">Поведенческая рекомендация:</p>
              <p className="text-gray-700">{insight.behavioralSuggestion}</p>
            </div>
          )}
        </div>
      )}

      {/* Графики */}
      {moodEntries.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Динамика настроения (7 дней)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={moodChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Настроение" stroke="#0ea5e9" strokeWidth={2} />
              <Line type="monotone" dataKey="Стресс" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="Тревога" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="Энергия" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {sleepEntries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Часы сна (7 дней)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sleepChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 12]} />
                <Tooltip />
                <Bar dataKey="Часы" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Качество сна (7 дней)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sleepChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Bar dataKey="Качество" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {moodEntries.length === 0 && sleepEntries.length === 0 && (
        <div className="card text-center text-gray-500 py-12">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Нет данных для анализа</p>
          <p className="text-sm mt-2">Начните отслеживать свое настроение и сон, чтобы увидеть аналитику</p>
        </div>
      )}
    </div>
  )
}
