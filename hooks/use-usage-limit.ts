"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface UsageInfo {
  allowed: boolean
  currentUsage: number
  dailyLimit: number
  remaining: number
  resetTime: string
  error?: string
}

export interface UsageStats {
  totalConversations: number
  totalApiCalls: number
  totalUploads: number
  dailyStats: Array<{
    date: string
    conversations: number
    apiCalls: number
    uploads: number
  }>
  averageDaily: {
    conversations: number
    apiCalls: number
    uploads: number
  }
}

export interface LimitInfo {
  trustLevel: number
  trustLevelName: string
  dailyLimits: {
    conversations: { current: number; limit: number; remaining: number }
    apiCalls: { current: number; limit: number; remaining: number }
    uploads: { current: number; limit: number; remaining: number }
  }
  resetTime: string
}

export function useUsageLimit() {
  const { data: session } = useSession()
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [limits, setLimits] = useState<LimitInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // 节流配置
  const THROTTLE_MINUTES = 1 // 自动刷新间隔：1分钟（减少延迟）
  const CACHE_KEY = 'usageInfo_cache'
  const CACHE_TIMESTAMP_KEY = 'usageInfo_timestamp'

  // 添加全局事件监听器用于跨组件同步
  const USAGE_UPDATE_EVENT = 'usageInfoUpdated'

  // 检查是否需要刷新（节流机制）
  const shouldRefresh = useCallback(() => {
    if (!lastFetched) return true

    const now = new Date()
    const diffMinutes = (now.getTime() - lastFetched.getTime()) / (1000 * 60)
    return diffMinutes >= THROTTLE_MINUTES
  }, [lastFetched, THROTTLE_MINUTES])

  // 从缓存加载数据
  const loadFromCache = useCallback(() => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY)
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

      if (cachedData && cachedTimestamp) {
        const data = JSON.parse(cachedData)
        const timestamp = new Date(cachedTimestamp)

        // 检查缓存是否还有效（5分钟内）
        const now = new Date()
        const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)

        if (diffMinutes < 5) {
          console.log('[Usage] Loading from cache')
          setUsageInfo(data)
          setLastFetched(timestamp)
          return true
        }
      }
    } catch (err) {
      console.warn('[Usage] Failed to load from cache:', err)
    }
    return false
  }, [CACHE_KEY, CACHE_TIMESTAMP_KEY])

  // 保存到缓存并广播更新事件
  const saveToCache = useCallback((data: UsageInfo) => {
    try {
      const now = new Date()
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toISOString())
      setLastFetched(now)

      // 🔄 广播使用量更新事件，确保所有组件同步
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(USAGE_UPDATE_EVENT, {
          detail: data
        }))
      }
    } catch (err) {
      console.warn('[Usage] Failed to save to cache:', err)
    }
  }, [CACHE_KEY, CACHE_TIMESTAMP_KEY, USAGE_UPDATE_EVENT])

  // 检查使用限额（带缓存和节流）
  const checkUsageLimit = useCallback(async (type: string = 'conversation', forceRefresh = false) => {
    if (!session?.user) return null

    // 如果不是强制刷新且不需要刷新，返回当前数据
    if (!forceRefresh && !shouldRefresh() && usageInfo) {
      console.log('[Usage] Using cached data (throttled)')
      return usageInfo
    }

    try {
      setLoading(true)
      setError(null)

      console.log('[Usage] Fetching fresh data from API')
      const response = await fetch(`/api/usage/check?type=${type}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check usage limit')
      }

      setUsageInfo(data)
      saveToCache(data)
      setIsInitialized(true)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('[Usage] Failed to fetch usage data:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [session, shouldRefresh, usageInfo, saveToCache])

  // 记录使用量
  const recordUsage = useCallback(async (type: string = 'conversation') => {
    if (!session?.user) return { success: false, error: 'Not authenticated' }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/usage/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record usage')
      }

      // 更新使用信息
      if (data.usage) {
        setUsageInfo(data.usage)
      }

      return { success: true, usage: data.usage }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [session])

  // 手动刷新使用信息
  const refreshUsageInfo = useCallback(async () => {
    console.log('[Usage] Manual refresh triggered')
    return await checkUsageLimit('conversation', true)
  }, [checkUsageLimit])

  // 获取使用统计
  const fetchUsageStats = useCallback(async (days: number = 7) => {
    if (!session?.user) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/usage/stats?days=${days}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch usage stats')
      }

      setStats(data.stats)
      setLimits(data.limits)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [session])

  // 检查是否可以进行对话
  const canStartConversation = useCallback(async () => {
    const result = await checkUsageLimit('conversation')
    return result?.allowed || false
  }, [checkUsageLimit])

  // 🔒 开始对话前的严格检查和记录（原子性操作）
  const startConversation = useCallback(async () => {
    if (!session?.user) {
      return {
        success: false,
        error: 'Not authenticated',
        code: 'UNAUTHORIZED'
      }
    }

    try {
      setLoading(true)
      setError(null)

      // 🔒 原子性检查和记录使用量
      const response = await fetch('/api/usage/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'conversation' }),
      })

      const data = await response.json()

      if (!response.ok) {
        // 🚫 限额超过或其他错误
        const error = data.error || 'Failed to start conversation'
        setError(error)

        if (data.usage) {
          setUsageInfo(data.usage)
        }

        return {
          success: false,
          error,
          code: data.code,
          usage: data.usage
        }
      }

      // ✅ 成功通过检查
      if (data.usage) {
        setUsageInfo(data.usage)
      }

      return {
        success: true,
        usage: data.usage
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
        code: 'NETWORK_ERROR'
      }
    } finally {
      setLoading(false)
    }
  }, [session])

  // 获取剩余次数的百分比
  const getUsagePercentage = useCallback(() => {
    if (!usageInfo || usageInfo.dailyLimit === 0) return 0
    return Math.round((usageInfo.currentUsage / usageInfo.dailyLimit) * 100)
  }, [usageInfo])

  // 获取剩余时间直到重置
  const getTimeUntilReset = useCallback(() => {
    if (!usageInfo?.resetTime) return null

    const resetTime = new Date(usageInfo.resetTime)
    const now = new Date()
    const diff = resetTime.getTime() - now.getTime()

    if (diff <= 0) return '已重置'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}小时${minutes}分钟后重置`
    } else {
      return `${minutes}分钟后重置`
    }
  }, [usageInfo])

  // 监听跨组件使用量更新事件
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUsageUpdate = (event: CustomEvent) => {
      const updatedData = event.detail as UsageInfo
      console.log('[Usage] Received cross-component update:', updatedData)
      setUsageInfo(updatedData)
    }

    window.addEventListener(USAGE_UPDATE_EVENT, handleUsageUpdate as EventListener)

    return () => {
      window.removeEventListener(USAGE_UPDATE_EVENT, handleUsageUpdate as EventListener)
    }
  }, [USAGE_UPDATE_EVENT])

  // 初始化时加载缓存数据，然后获取最新信息
  useEffect(() => {
    if (session?.user && !isInitialized) {
      console.log('[Usage] Initializing usage data')

      // 先尝试从缓存加载
      const hasCache = loadFromCache()

      if (hasCache) {
        setIsInitialized(true)
        // 有缓存时，在后台静默刷新
        setTimeout(() => {
          checkUsageLimit('conversation', false)
        }, 1000)
      } else {
        // 没有缓存时，立即获取数据
        checkUsageLimit('conversation', true)
      }

      // 获取统计数据（不阻塞主要功能）
      setTimeout(() => {
        fetchUsageStats(7)
      }, 2000)
    }
  }, [session, isInitialized, loadFromCache, checkUsageLimit, fetchUsageStats])

  return {
    // 状态
    usageInfo,
    stats,
    limits,
    loading,
    error,
    isInitialized,
    lastFetched,

    // 方法
    checkUsageLimit,
    recordUsage,
    fetchUsageStats,
    refreshUsageInfo, // 新增：手动刷新
    canStartConversation,
    startConversation,

    // 计算属性
    getUsagePercentage,
    getTimeUntilReset,

    // 便捷属性
    canUse: usageInfo?.allowed || false,
    remaining: usageInfo?.remaining || 0,
    currentUsage: usageInfo?.currentUsage || 0,
    dailyLimit: usageInfo?.dailyLimit || 0,
    usagePercentage: getUsagePercentage(),
    timeUntilReset: getTimeUntilReset(),

    // 节流相关
    shouldRefresh,
    THROTTLE_MINUTES
  }
}
