'use client'

import { useState, useEffect, useCallback } from 'react'

// 数据接口定义
interface HealthData {
  id?: string
  date: string
  weight?: number
  totalCaloriesConsumed?: number
  totalCaloriesBurned?: number
  netCalories?: number
  mood?: string
  stress?: string
  sleepQuality?: string
  sleepHours?: number
  notes?: string
  foodEntries?: FoodEntry[]
  exerciseEntries?: ExerciseEntry[]
}

interface FoodEntry {
  id?: string
  name: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  amount?: string
  description?: string
}

interface ExerciseEntry {
  id?: string
  name: string
  type?: string
  duration?: number
  calories: number
  intensity?: string
  description?: string
}

interface HealthDataHook {
  healthData: HealthData | null
  isLoading: boolean
  error: string | null
  loadHealthData: (date: string) => Promise<void>
  saveHealthData: (date: string, data: Partial<HealthData>) => Promise<void>
  addFoodEntry: (date: string, food: Omit<FoodEntry, 'id'>) => Promise<void>
  addExerciseEntry: (date: string, exercise: Omit<ExerciseEntry, 'id'>) => Promise<void>
  removeFoodEntry: (foodId: string) => Promise<void>
  removeExerciseEntry: (exerciseId: string) => Promise<void>
  getUserHistory: (startDate?: string, endDate?: string) => Promise<HealthData[]>
}

// 获取当前用户ID（临时方案，后续可以集成认证系统）
const getCurrentUserId = (): string => {
  if (typeof window === 'undefined') return 'default-user'
  
  let userId = localStorage.getItem('snapifit-user-id')
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('snapifit-user-id', userId)
  }
  return userId
}

export function useHealthData(): HealthDataHook {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载健康数据
  const loadHealthData = useCallback(async (date: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = getCurrentUserId()
      const response = await fetch(`/api/db/daily-log?userId=${userId}&date=${date}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // 没有数据，返回空对象
          setHealthData({ date })
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setHealthData(data)
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading health data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 保存健康数据
  const saveHealthData = useCallback(async (date: string, data: Partial<HealthData>) => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = getCurrentUserId()
      const response = await fetch('/api/db/daily-log', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          date,
          ...data,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const updatedData = await response.json()
      setHealthData(updatedData)
    } catch (err: any) {
      setError(err.message)
      console.error('Error saving health data:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 添加食物记录
  const addFoodEntry = useCallback(async (date: string, food: Omit<FoodEntry, 'id'>) => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = getCurrentUserId()
      
      // 先确保有日志记录
      let dailyLog = healthData
      if (!dailyLog || dailyLog.date !== date) {
        await loadHealthData(date)
        dailyLog = healthData
      }

      // 如果还没有日志，创建一个
      if (!dailyLog?.id) {
        await saveHealthData(date, {})
        await loadHealthData(date)
        dailyLog = healthData
      }

      if (!dailyLog?.id) {
        throw new Error('无法创建日志记录')
      }

      const response = await fetch('/api/db/food-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logId: dailyLog.id,
          ...food,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 重新加载数据以获取最新状态
      await loadHealthData(date)
    } catch (err: any) {
      setError(err.message)
      console.error('Error adding food entry:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [healthData, loadHealthData, saveHealthData])

  // 添加运动记录
  const addExerciseEntry = useCallback(async (date: string, exercise: Omit<ExerciseEntry, 'id'>) => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = getCurrentUserId()
      
      // 先确保有日志记录
      let dailyLog = healthData
      if (!dailyLog || dailyLog.date !== date) {
        await loadHealthData(date)
        dailyLog = healthData
      }

      // 如果还没有日志，创建一个
      if (!dailyLog?.id) {
        await saveHealthData(date, {})
        await loadHealthData(date)
        dailyLog = healthData
      }

      if (!dailyLog?.id) {
        throw new Error('无法创建日志记录')
      }

      const response = await fetch('/api/db/exercise-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logId: dailyLog.id,
          ...exercise,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 重新加载数据以获取最新状态
      await loadHealthData(date)
    } catch (err: any) {
      setError(err.message)
      console.error('Error adding exercise entry:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [healthData, loadHealthData, saveHealthData])

  // 删除食物记录
  const removeFoodEntry = useCallback(async (foodId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/db/food-entry/${foodId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 重新加载当前数据
      if (healthData?.date) {
        await loadHealthData(healthData.date)
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error removing food entry:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [healthData, loadHealthData])

  // 删除运动记录
  const removeExerciseEntry = useCallback(async (exerciseId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/db/exercise-entry/${exerciseId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 重新加载当前数据
      if (healthData?.date) {
        await loadHealthData(healthData.date)
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error removing exercise entry:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [healthData, loadHealthData])

  // 获取用户历史数据
  const getUserHistory = useCallback(async (startDate?: string, endDate?: string): Promise<HealthData[]> => {
    try {
      const userId = getCurrentUserId()
      const params = new URLSearchParams({ userId })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/db/user-history?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (err: any) {
      setError(err.message)
      console.error('Error getting user history:', err)
      return []
    }
  }, [])

  return {
    healthData,
    isLoading,
    error,
    loadHealthData,
    saveHealthData,
    addFoodEntry,
    addExerciseEntry,
    removeFoodEntry,
    removeExerciseEntry,
    getUserHistory,
  }
} 