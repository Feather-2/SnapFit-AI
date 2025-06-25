'use client'

import { useState, useEffect, useCallback } from 'react'

interface AIMemory {
  id: string
  category: string
  key: string
  value: any
  context?: string
  createdAt: string
  updatedAt: string
}

interface AIMemoryHook {
  memories: Record<string, any>
  isLoading: boolean
  error: string | null
  updateMemory: (category: string, key: string, value: any, context?: string) => Promise<void>
  getMemory: (category: string, key?: string) => any
  clearMemory: (category: string, key?: string) => Promise<void>
  clearAllMemories: () => Promise<void>
  loadMemories: () => Promise<void>
}

// 获取当前用户ID
const getCurrentUserId = (): string => {
  if (typeof window === 'undefined') return 'default-user'
  
  let userId = localStorage.getItem('snapifit-user-id')
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('snapifit-user-id', userId)
  }
  return userId
}

export function useServerAIMemory(): AIMemoryHook {
  const [memories, setMemories] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载所有记忆
  const loadMemories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = getCurrentUserId()
      const response = await fetch(`/api/db/ai-memory?userId=${userId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const memoriesData: AIMemory[] = await response.json()
      
      // 将记忆数据转换为key-value格式，便于使用
      const memoriesMap: Record<string, any> = {}
      memoriesData.forEach(memory => {
        const key = `${memory.category}:${memory.key}`
        memoriesMap[key] = memory.value
      })

      setMemories(memoriesMap)
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading AI memories:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 更新记忆
  const updateMemory = useCallback(async (category: string, key: string, value: any, context?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = getCurrentUserId()
      const response = await fetch('/api/db/ai-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          category,
          key,
          value,
          context,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 更新本地状态
      const memoryKey = `${category}:${key}`
      setMemories(prev => ({
        ...prev,
        [memoryKey]: value,
      }))
    } catch (err: any) {
      setError(err.message)
      console.error('Error updating AI memory:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 获取记忆
  const getMemory = useCallback((category: string, key?: string) => {
    if (!key) {
      // 获取某个类别下的所有记忆
      const categoryMemories: Record<string, any> = {}
      Object.entries(memories).forEach(([memoryKey, value]) => {
        if (memoryKey.startsWith(`${category}:`)) {
          const actualKey = memoryKey.replace(`${category}:`, '')
          categoryMemories[actualKey] = value
        }
      })
      return categoryMemories
    }

    const memoryKey = `${category}:${key}`
    return memories[memoryKey] || null
  }, [memories])

  // 删除记忆
  const clearMemory = useCallback(async (category: string, key?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = getCurrentUserId()
      const params = new URLSearchParams({ userId, category })
      if (key) params.append('key', key)

      const response = await fetch(`/api/db/ai-memory?${params.toString()}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 更新本地状态
      if (key) {
        const memoryKey = `${category}:${key}`
        setMemories(prev => {
          const updated = { ...prev }
          delete updated[memoryKey]
          return updated
        })
      } else {
        // 删除整个类别
        setMemories(prev => {
          const updated = { ...prev }
          Object.keys(updated).forEach(memoryKey => {
            if (memoryKey.startsWith(`${category}:`)) {
              delete updated[memoryKey]
            }
          })
          return updated
        })
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error clearing AI memory:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 清空所有记忆
  const clearAllMemories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = getCurrentUserId()
      const response = await fetch(`/api/db/ai-memory?userId=${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      setMemories({})
    } catch (err: any) {
      setError(err.message)
      console.error('Error clearing all AI memories:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始化时加载记忆
  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  return {
    memories,
    isLoading,
    error,
    updateMemory,
    getMemory,
    clearMemory,
    clearAllMemories,
    loadMemories,
  }
} 