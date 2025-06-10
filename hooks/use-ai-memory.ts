"use client"

import { useState, useEffect, useCallback } from "react"
import { useIndexedDB } from "./use-indexed-db"
import { useAIMemorySync } from "./use-ai-memory-sync"
import type { AIMemory, AIMemoryUpdateRequest } from "@/lib/types"

interface AIMemoryHook {
  memories: Record<string, AIMemory>
  getMemory: (expertId: string) => AIMemory | null
  updateMemory: (request: AIMemoryUpdateRequest) => Promise<void>
  clearMemory: (expertId: string) => Promise<void>
  clearAllMemories: () => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function useAIMemory(): AIMemoryHook {
  const [memories, setMemories] = useState<Record<string, AIMemory>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { getData, saveData, deleteData, clearAllData } = useIndexedDB("aiMemories")
  const { syncSingleMemory } = useAIMemorySync()

  // 加载所有记忆
  const loadMemories = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // 动态获取所有存在的记忆，而不是只加载预定义的专家ID
      const memoriesData: Record<string, AIMemory> = {}

      // 尝试打开IndexedDB并获取所有记忆
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = window.indexedDB.open("healthApp", 2)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        if (db.objectStoreNames.contains("aiMemories")) {
          const transaction = db.transaction(["aiMemories"], "readonly")
          const objectStore = transaction.objectStore("aiMemories")

          const allMemories = await new Promise<Record<string, AIMemory>>((resolve, reject) => {
            const memories: Record<string, AIMemory> = {}
            const request = objectStore.openCursor()

            request.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest).result
              if (cursor) {
                memories[cursor.key as string] = cursor.value
                cursor.continue()
              } else {
                resolve(memories)
              }
            }

            request.onerror = () => reject(request.error)
          })

          Object.assign(memoriesData, allMemories)
        }

        db.close()
      } catch (dbError) {
        console.warn("Failed to load memories from IndexedDB directly, falling back to individual queries:", dbError)

        // 如果直接访问IndexedDB失败，回退到预定义的专家ID列表
        const expertIds = ["general", "nutrition", "fitness", "psychology", "medical", "sleep", "exercise", "metabolism", "behavior", "timing"]

        for (const expertId of expertIds) {
          try {
            const memory = await getData(expertId)
            if (memory) {
              memoriesData[expertId] = memory
            }
          } catch (err) {
            // 单个记忆加载失败不影响其他记忆
            console.warn(`Failed to load memory for expert ${expertId}:`, err)
          }
        }
      }

      setMemories(memoriesData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("加载AI记忆失败"))
    } finally {
      setIsLoading(false)
    }
  }, [getData])

  // 初始化时加载记忆
  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  // 获取特定专家的记忆
  const getMemory = useCallback((expertId: string): AIMemory | null => {
    return memories[expertId] || null
  }, [memories])

  // 更新记忆
  const updateMemory = useCallback(async (request: AIMemoryUpdateRequest) => {
    try {
      setIsLoading(true)
      setError(null)

      // 验证内容长度
      if (request.newContent.length > 500) {
        throw new Error("记忆内容不能超过500字")
      }

      const existingMemory = memories[request.expertId]
      const newMemory: AIMemory = {
        expertId: request.expertId,
        content: request.newContent,
        lastUpdated: new Date().toISOString(),
        version: existingMemory ? existingMemory.version + 1 : 1
      }

      // 先保存到本地
      await saveData(request.expertId, newMemory)

      // 更新本地状态
      setMemories(prev => ({
        ...prev,
        [request.expertId]: newMemory
      }))

      // 异步同步到云端（不阻塞用户操作）
      try {
        await syncSingleMemory(request.expertId, newMemory)
        console.log(`[AIMemory] Successfully synced memory for expert: ${request.expertId}`)
      } catch (syncError) {
        console.warn(`[AIMemory] Failed to sync memory for expert ${request.expertId}:`, syncError)
        // 同步失败不影响本地操作，只记录警告
      }

    } catch (err) {
      setError(err instanceof Error ? err : new Error("更新AI记忆失败"))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [memories, saveData, syncSingleMemory])

  // 清空特定专家的记忆
  const clearMemory = useCallback(async (expertId: string) => {
    try {
      setIsLoading(true)
      setError(null)

      await deleteData(expertId)

      setMemories(prev => {
        const newMemories = { ...prev }
        delete newMemories[expertId]
        return newMemories
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error("清空AI记忆失败"))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [deleteData])

  // 清空所有记忆
  const clearAllMemories = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      await clearAllData()
      setMemories({})
    } catch (err) {
      setError(err instanceof Error ? err : new Error("清空所有AI记忆失败"))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [clearAllData])

  return {
    memories,
    getMemory,
    updateMemory,
    clearMemory,
    clearAllMemories,
    isLoading,
    error
  }
}
