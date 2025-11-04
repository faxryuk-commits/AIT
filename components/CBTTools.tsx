'use client'

import { useState } from 'react'
import { Brain, Lightbulb, PenTool, Activity } from 'lucide-react'

export default function CBTTools() {
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [thoughtRecord, setThoughtRecord] = useState({
    situation: '',
    emotion: '',
    automaticThought: '',
    evidence: '',
    alternative: '',
    outcome: '',
  })

  const tools = [
    {
      id: 'thought-record',
      title: 'Запись мыслей',
      icon: PenTool,
      description: 'Техника для выявления и изменения негативных мыслей',
    },
    {
      id: 'reframing',
      title: 'Переформулирование',
      icon: Lightbulb,
      description: 'Переосмысление негативных мыслей в более сбалансированные',
    },
    {
      id: 'behavioral-activation',
      title: 'Поведенческая активация',
      icon: Activity,
      description: 'Планирование приятных и значимых действий',
    },
    {
      id: 'relaxation',
      title: 'Техники релаксации',
      icon: Brain,
      description: 'Дыхательные упражнения и техники снижения стресса',
    },
  ]

  const handleThoughtRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Запись мыслей сохранена! Продолжайте практиковать эту технику.')
    setThoughtRecord({
      situation: '',
      emotion: '',
      automaticThought: '',
      evidence: '',
      alternative: '',
      outcome: '',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">CBT-инструменты</h2>
        <p className="text-gray-600">
          Практические инструменты когнитивно-поведенческой терапии для работы с мыслями, эмоциями и поведением
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
              className="card text-left hover:scale-105 transition-transform"
            >
              <div className="flex items-start space-x-4">
                <div className="bg-primary-100 p-3 rounded-lg">
                  <Icon className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{tool.title}</h3>
                  <p className="text-sm text-gray-600">{tool.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Thought Record Tool */}
      {activeTool === 'thought-record' && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <PenTool className="w-5 h-5 mr-2 text-primary-600" />
            Запись мыслей (ABC Model)
          </h3>
          <p className="text-gray-600 mb-6">
            Записывайте свои мысли, чтобы выявить связь между событиями, мыслями, эмоциями и поведением.
          </p>
          <form onSubmit={handleThoughtRecordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                1. Ситуация (что произошло?)
              </label>
              <textarea
                value={thoughtRecord.situation}
                onChange={(e) => setThoughtRecord({ ...thoughtRecord, situation: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Опишите ситуацию, которая вызвала негативные эмоции"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                2. Эмоция (что вы почувствовали?)
              </label>
              <input
                type="text"
                value={thoughtRecord.emotion}
                onChange={(e) => setThoughtRecord({ ...thoughtRecord, emotion: e.target.value })}
                className="input-field"
                placeholder="Например: тревога, грусть, злость"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                3. Автоматическая мысль (что пришло в голову?)
              </label>
              <textarea
                value={thoughtRecord.automaticThought}
                onChange={(e) => setThoughtRecord({ ...thoughtRecord, automaticThought: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Первая мысль, которая пришла в голову"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                4. Доказательства (подтверждают ли факты эту мысль?)
              </label>
              <textarea
                value={thoughtRecord.evidence}
                onChange={(e) => setThoughtRecord({ ...thoughtRecord, evidence: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Какие факты подтверждают или опровергают эту мысль?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                5. Альтернативная мысль (более сбалансированная мысль)
              </label>
              <textarea
                value={thoughtRecord.alternative}
                onChange={(e) => setThoughtRecord({ ...thoughtRecord, alternative: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Как можно переформулировать эту мысль более позитивно и реалистично?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                6. Результат (как вы чувствуете себя теперь?)
              </label>
              <textarea
                value={thoughtRecord.outcome}
                onChange={(e) => setThoughtRecord({ ...thoughtRecord, outcome: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Изменилось ли ваше эмоциональное состояние?"
              />
            </div>

            <button type="submit" className="btn-primary">
              Сохранить запись
            </button>
          </form>
        </div>
      )}

      {/* Reframing Tool */}
      {activeTool === 'reframing' && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-primary-600" />
            Переформулирование мыслей
          </h3>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="font-medium mb-2">Как работает переформулирование:</p>
              <p className="text-gray-700">
                Когда вы замечаете негативную мысль, попробуйте переформулировать её в более сбалансированную и реалистичную.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="font-medium text-red-800 mb-2">Негативная мысль:</p>
                <p className="text-gray-700">"Я всегда всё делаю неправильно"</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="font-medium text-green-800 mb-2">Переформулированная:</p>
                <p className="text-gray-700">"Иногда я ошибаюсь, но это нормально. Я также делаю много правильных вещей."</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Упражнение:</h4>
              <p className="text-gray-700 mb-4">
                Подумайте о недавней негативной мысли и попробуйте переформулировать её, используя следующие вопросы:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Есть ли альтернативные объяснения этой ситуации?</li>
                <li>Какие доказательства противоречат этой мысли?</li>
                <li>Что бы я сказал другу в такой ситуации?</li>
                <li>Как я буду думать об этом через месяц?</li>
                <li>Что я могу извлечь из этой ситуации?</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Behavioral Activation */}
      {activeTool === 'behavioral-activation' && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-primary-600" />
            Поведенческая активация
          </h3>
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="font-medium mb-2">Что это такое:</p>
              <p className="text-gray-700">
                Поведенческая активация помогает повысить настроение через планирование и выполнение значимых и приятных действий.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Категории действий:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-2">Социальные:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Встретиться с другом</li>
                    <li>• Позвонить близкому</li>
                    <li>• Присоединиться к группе</li>
                  </ul>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-2">Физические:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Прогулка на свежем воздухе</li>
                    <li>• Зарядка или спорт</li>
                    <li>• Йога или растяжка</li>
                  </ul>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-2">Творческие:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Рисование или музыка</li>
                    <li>• Чтение книги</li>
                    <li>• Кулинария</li>
                  </ul>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-2">Полезные:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Уборка комнаты</li>
                    <li>• Завершение задачи</li>
                    <li>• Планирование дня</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="font-medium mb-2">Совет:</p>
              <p className="text-gray-700">
                Выберите хотя бы одно действие из каждой категории на эту неделю. Даже маленькие шаги имеют значение!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Relaxation Techniques */}
      {activeTool === 'relaxation' && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Brain className="w-5 h-5 mr-2 text-primary-600" />
            Техники релаксации
          </h3>
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3 text-lg">1. Дыхательная техника 4-7-8</h4>
              <div className="bg-blue-50 p-4 rounded-lg">
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Вдохните через нос на 4 счёта</li>
                  <li>Задержите дыхание на 7 счётов</li>
                  <li>Выдохните через рот на 8 счётов</li>
                  <li>Повторите цикл 4 раза</li>
                </ol>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3 text-lg">2. Прогрессивная мышечная релаксация</h4>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-gray-700 mb-2">
                  Напрягайте и расслабляйте мышцы по очереди, начиная с пальцев ног и доходя до лица:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                  <li>Напрягите мышцу на 5 секунд</li>
                  <li>Резко расслабьте</li>
                  <li>Ощутите разницу в течение 15 секунд</li>
                  <li>Переходите к следующей группе мышц</li>
                </ul>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3 text-lg">3. Медитация осознанности</h4>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-gray-700 mb-2">Простая 5-минутная практика:</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Сядьте удобно, закройте глаза</li>
                  <li>Сосредоточьтесь на дыхании</li>
                  <li>Когда заметите блуждание мыслей, мягко верните внимание к дыханию</li>
                  <li>Продолжайте 5-10 минут</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {!activeTool && (
        <div className="card text-center text-gray-500 py-12">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Выберите инструмент выше, чтобы начать практику</p>
        </div>
      )}
    </div>
  )
}
