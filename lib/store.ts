import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MoodEntry {
  id: string
  date: string
  mood: number // 1-10
  anxiety: number // 1-10
  stress: number // 1-10
  energy: number // 1-10
  notes?: string
}

export interface SleepEntry {
  id: string
  date: string
  hours: number
  quality: number // 1-10
  bedtime?: string
  waketime?: string
}

export interface Goal {
  id: string
  title: string
  description: string
  completed: boolean
  createdAt: string
  completedAt?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AppState {
  messages: Message[]
  moodEntries: MoodEntry[]
  sleepEntries: SleepEntry[]
  goals: Goal[]
  
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  addMoodEntry: (entry: Omit<MoodEntry, 'id'>) => void
  addSleepEntry: (entry: Omit<SleepEntry, 'id'>) => void
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'completed'>) => void
  toggleGoal: (id: string) => void
  deleteGoal: (id: string) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      messages: [],
      moodEntries: [],
      sleepEntries: [],
      goals: [],
      
      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: Date.now().toString(),
              timestamp: new Date(),
            },
          ],
        })),
      
      addMoodEntry: (entry) =>
        set((state) => ({
          moodEntries: [
            ...state.moodEntries,
            {
              ...entry,
              id: Date.now().toString(),
            },
          ],
        })),
      
      addSleepEntry: (entry) =>
        set((state) => ({
          sleepEntries: [
            ...state.sleepEntries,
            {
              ...entry,
              id: Date.now().toString(),
            },
          ],
        })),
      
      addGoal: (goal) =>
        set((state) => ({
          goals: [
            ...state.goals,
            {
              ...goal,
              id: Date.now().toString(),
              createdAt: new Date().toISOString(),
              completed: false,
            },
          ],
        })),
      
      toggleGoal: (id) =>
        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === id
              ? {
                  ...goal,
                  completed: !goal.completed,
                  completedAt: goal.completed ? undefined : new Date().toISOString(),
                }
              : goal
          ),
        })),
      
      deleteGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((goal) => goal.id !== id),
        })),
    }),
    {
      name: 'ai-therapist-storage',
    }
  )
)
