"use client"

import { useState, useEffect, useCallback } from "react"
import { useIndexedDB } from "./use-indexed-db"
import { useAIMemorySync } from "./use-ai-memory-sync"
import type { AIMemory, AIMemoryUpdateRequest } from "@/lib/types"
import { useToast } from "./use-toast"
import { DB_NAME, DB_VERSION } from '@/lib/db-config'

interface AIMemoryHook {
  memories: Record<string, AIMemory>
  getMemory: (expertId: string) => AIMemory | null
  updateMemory: (request: AIMemoryUpdateRequest) => Promise<void>
  clearMemory: (expertId: string) => Promise<void>
  clearAllMemories: () => Promise<void>
  isLoading: boolean
  error: Error | null
}

const STORE_NAME = 'aiMemory'

export function useAIMemory(): AIMemoryHook {
  const [memories, setMemories] = useState<Record<string, AIMemory>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()
  const { syncSingleMemory } = useAIMemorySync()

  const { getData, saveData, deleteData, clearAllData } = useIndexedDB(STORE_NAME)

  useEffect(() => {
    let isMounted = true;

    const initDB = async () => {
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
              dbInstance.createObjectStore(STORE_NAME);
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.close();
          if (isMounted) {
            setIsLoading(false)
          }
          return;
        }

        const transaction = db.transaction([STORE_NAME], "readonly");
        const objectStore = transaction.objectStore(STORE_NAME);
        const allMemoriesRequest = objectStore.getAll();

        allMemoriesRequest.onsuccess = () => {
          if (isMounted) {
            const allItems = allMemoriesRequest.result;
            const allKeysRequest = objectStore.getAllKeys();

            allKeysRequest.onsuccess = () => {
              const keys = allKeysRequest.result;
              const memoriesData: Record<string, AIMemory> = {};
              allItems.forEach((item, index) => {
                memoriesData[keys[index] as string] = item;
              });
              setMemories(memoriesData);
              setIsLoading(false);
            }
            allKeysRequest.onerror = () => {
               setError(new Error("Failed to retrieve memory keys."));
               setIsLoading(false);
            }
          }
        };

        allMemoriesRequest.onerror = () => {
          if (isMounted) {
            setError(new Error("Failed to retrieve memories."));
            setIsLoading(false);
          }
        };

        transaction.oncomplete = () => {
          db.close();
        };

      } catch (dbError) {
        if (isMounted) {
          console.error("Failed to initialize DB for memories:", dbError);
          setError(dbError instanceof Error ? dbError : new Error("Unknown DB error"));
          setIsLoading(false);
        }
      }
    };

    initDB();

    return () => {
      isMounted = false;
    };
  }, []);

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
