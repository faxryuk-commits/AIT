'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Smile, Moon, Target, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function TrackingPanel() {
  const [activeTab, setActiveTab] = useState<'mood' | 'sleep' | 'goals'>('mood')
  const [showMoodForm, setShowMoodForm] = useState(false)
  const [showSleepForm, setShowSleepForm] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  
  const [moodForm, setMoodForm] = useState({
    mood: 5,
    anxiety: 5,
    stress: 5,
    energy: 5,
    notes: '',
  })
  
  const [sleepForm, setSleepForm] = useState({
    hours: 8,
    quality: 5,
    bedtime: '',
    waketime: '',
  })
  
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
  })

  const { moodEntries, sleepEntries, goals, addMoodEntry, addSleepEntry, addGoal, toggleGoal, deleteGoal } = useStore()

  const handleMoodSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addMoodEntry({
      date: new Date().toISOString(),
      ...moodForm,
    })
    setMoodForm({ mood: 5, anxiety: 5, stress: 5, energy: 5, notes: '' })
    setShowMoodForm(false)
  }

  const handleSleepSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addSleepEntry({
      date: new Date().toISOString(),
      ...sleepForm,
    })
    setSleepForm({ hours: 8, quality: 5, bedtime: '', waketime: '' })
    setShowSleepForm(false)
  }

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!goalForm.title.trim()) return
    addGoal(goalForm)
    setGoalForm({ title: '', description: '' })
    setShowGoalForm(false)
  }

  const getMoodEmoji = (value: number) => {
    if (value >= 8) return '😊'
    if (value >= 6) return '🙂'
    if (value >= 4) return '😐'
    if (value >= 2) return '😔'
    return '😢'
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('mood')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'mood'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Smile className="w-5 h-5 inline mr-2" />
          Настроение
        </button>
        <button
          onClick={() => setActiveTab('sleep')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'sleep'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Moon className="w-5 h-5 inline mr-2" />
          Сон
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'goals'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target className="w-5 h-5 inline mr-2" />
          Цели
        </button>
      </div>

      {/* Mood Tracking */}
      {activeTab === 'mood' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Отслеживание настроения</h2>
            <button
              onClick={() => setShowMoodForm(!showMoodForm)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Добавить запись</span>
            </button>
          </div>

          {showMoodForm && (
            <div className="card">
              <form onSubmit={handleMoodSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Настроение: {getMoodEmoji(moodForm.mood)} {moodForm.mood}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={moodForm.mood}
                    onChange={(e) => setMoodForm({ ...moodForm, mood: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Тревога: {moodForm.anxiety}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={moodForm.anxiety}
                    onChange={(e) => setMoodForm({ ...moodForm, anxiety: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Стресс: {moodForm.stress}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={moodForm.stress}
                    onChange={(e) => setMoodForm({ ...moodForm, stress: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Энергия: {moodForm.energy}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={moodForm.energy}
                    onChange={(e) => setMoodForm({ ...moodForm, energy: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Заметки</label>
                  <textarea
                    value={moodForm.notes}
                    onChange={(e) => setMoodForm({ ...moodForm, notes: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Что влияет на ваше настроение?"
                  />
                </div>

                <div className="flex space-x-3">
                  <button type="submit" className="btn-primary">
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMoodForm(false)}
                    className="btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid gap-4">
            {moodEntries.slice().reverse().map((entry) => (
              <div key={entry.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-lg font-semibold">
                      {format(new Date(entry.date), 'd MMMM yyyy, HH:mm', { locale: ru })}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p>Настроение: {getMoodEmoji(entry.mood)} {entry.mood}/10</p>
                      <p>Тревога: {entry.anxiety}/10</p>
                      <p>Стресс: {entry.stress}/10</p>
                      <p>Энергия: {entry.energy}/10</p>
                      {entry.notes && (
                        <p className="text-gray-600 mt-2">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {moodEntries.length === 0 && (
              <div className="card text-center text-gray-500 py-12">
                <Smile className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Нет записей о настроении</p>
                <p className="text-sm mt-2">Начните отслеживать свое настроение для лучшего понимания эмоций</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sleep Tracking */}
      {activeTab === 'sleep' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Отслеживание сна</h2>
            <button
              onClick={() => setShowSleepForm(!showSleepForm)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Добавить запись</span>
            </button>
          </div>

          {showSleepForm && (
            <div className="card">
              <form onSubmit={handleSleepSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Часы сна: {sleepForm.hours}
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    step="0.5"
                    value={sleepForm.hours}
                    onChange={(e) => setSleepForm({ ...sleepForm, hours: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Качество: {sleepForm.quality}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={sleepForm.quality}
                    onChange={(e) => setSleepForm({ ...sleepForm, quality: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Время отхода ко сну</label>
                    <input
                      type="time"
                      value={sleepForm.bedtime}
                      onChange={(e) => setSleepForm({ ...sleepForm, bedtime: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Время пробуждения</label>
                    <input
                      type="time"
                      value={sleepForm.waketime}
                      onChange={(e) => setSleepForm({ ...sleepForm, waketime: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button type="submit" className="btn-primary">
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSleepForm(false)}
                    className="btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid gap-4">
            {sleepEntries.slice().reverse().map((entry) => (
              <div key={entry.id} className="card">
                <p className="text-lg font-semibold">
                  {format(new Date(entry.date), 'd MMMM yyyy', { locale: ru })}
                </p>
                <div className="mt-2 space-y-1">
                  <p>Длительность: {entry.hours} часов</p>
                  <p>Качество: {entry.quality}/10</p>
                  {entry.bedtime && <p>Отход ко сну: {entry.bedtime}</p>}
                  {entry.waketime && <p>Пробуждение: {entry.waketime}</p>}
                </div>
              </div>
            ))}
            {sleepEntries.length === 0 && (
              <div className="card text-center text-gray-500 py-12">
                <Moon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Нет записей о сне</p>
                <p className="text-sm mt-2">Начните отслеживать свой сон для улучшения качества жизни</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Goals */}
      {activeTab === 'goals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Цели</h2>
            <button
              onClick={() => setShowGoalForm(!showGoalForm)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Новая цель</span>
            </button>
          </div>

          {showGoalForm && (
            <div className="card">
              <form onSubmit={handleGoalSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Название цели *</label>
                  <input
                    type="text"
                    value={goalForm.title}
                    onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                    className="input-field"
                    placeholder="Например: Улучшить качество сна"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Описание</label>
                  <textarea
                    value={goalForm.description}
                    onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Детали цели..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button type="submit" className="btn-primary">
                    Создать цель
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGoalForm(false)}
                    className="btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid gap-4">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className={`card ${goal.completed ? 'opacity-75' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={goal.completed}
                        onChange={() => toggleGoal(goal.id)}
                        className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <h3 className={`text-lg font-semibold ${goal.completed ? 'line-through' : ''}`}>
                        {goal.title}
                      </h3>
                    </div>
                    {goal.description && (
                      <p className="text-gray-600 mt-2 ml-8">{goal.description}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2 ml-8">
                      Создано: {format(new Date(goal.createdAt), 'd MMMM yyyy', { locale: ru })}
                      {goal.completedAt && (
                        <> • Выполнено: {format(new Date(goal.completedAt), 'd MMMM yyyy', { locale: ru })}</>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            {goals.length === 0 && (
              <div className="card text-center text-gray-500 py-12">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Нет целей</p>
                <p className="text-sm mt-2">Поставьте первую цель для улучшения вашей жизни</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
