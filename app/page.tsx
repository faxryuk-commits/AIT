'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import TrackingPanel from '@/components/TrackingPanel'
import CBTTools from '@/components/CBTTools'
import { MessageCircle, BarChart3, Activity, Brain } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'analytics' | 'tracking' | 'cbt'>('chat')

  const tabs = [
    { id: 'chat', label: 'Чат с терапевтом', icon: MessageCircle },
    { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
    { id: 'tracking', label: 'Отслеживание', icon: Activity },
    { id: 'cbt', label: 'CBT-инструменты', icon: Brain },
  ]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-primary-500 to-purple-600 p-2 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI-терапевт</h1>
                <p className="text-sm text-gray-500">Ваш персональный помощник</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'chat' && <ChatInterface />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'tracking' && <TrackingPanel />}
        {activeTab === 'cbt' && <CBTTools />}
      </main>
    </div>
  )
}
