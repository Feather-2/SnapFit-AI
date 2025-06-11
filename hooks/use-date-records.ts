"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { DB_NAME, DB_VERSION } from '@/lib/db-config'
import { useIndexedDB } from './use-indexed-db'

interface DateRecordsHook {
  hasRecord: (date: Date) => boolean
  isLoading: boolean
  refreshRecords: () => Promise<void>
}

export function useDateRecords(): DateRecordsHook {
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const { waitForInitialization } = useIndexedDB('healthLogs')

  // 检查某个日期是否有记录
  const hasRecord = useCallback((date: Date): boolean => {
    const dateKey = format(date, "yyyy-MM-dd")
    return recordedDates.has(dateKey)
  }, [recordedDates])

  // 从IndexedDB加载所有有记录的日期
  const loadRecordedDates = useCallback(async () => {
    setIsLoading(true)
    try {
      // 等待IndexedDB初始化完成
      await waitForInitialization()

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 验证healthLogs存储是否存在
        if (!db.objectStoreNames.contains('healthLogs')) {
          console.error("'healthLogs' object store not found in database");
          setRecordedDates(new Set());
          setIsLoading(false);
          return;
        }

        try {
          const transaction = db.transaction(['healthLogs'], 'readonly')
          const objectStore = transaction.objectStore('healthLogs')
          const getAllRequest = objectStore.getAll()

          getAllRequest.onsuccess = () => {
            const allLogs = getAllRequest.result
            const dates = new Set<string>()

            if (allLogs && allLogs.length > 0) {
              allLogs.forEach(log => {
                if (log && (
                  (log.foodEntries && log.foodEntries.length > 0) ||
                  (log.exerciseEntries && log.exerciseEntries.length > 0) ||
                  log.weight !== undefined ||
                  log.dailyStatus ||
                  log.calculatedBMR ||
                  log.calculatedTDEE ||
                  log.tefAnalysis
                )) {
                  dates.add(log.date)
                }
              })
            }

            setRecordedDates(dates)
            setIsLoading(false)
          }

          getAllRequest.onerror = (event) => {
            console.error('Failed to load recorded dates', event)
            setIsLoading(false)
          }
        } catch (transactionError) {
          console.error('Transaction error:', transactionError)
          setRecordedDates(new Set())
          setIsLoading(false)
        } finally {
          // 确保数据库关闭
          db.close()
        }
      }

      request.onerror = (event) => {
        console.error('Failed to open IndexedDB', event)
        setRecordedDates(new Set())
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error loading recorded dates:', error)
      setRecordedDates(new Set())
      setIsLoading(false)
    }
  }, [waitForInitialization])

  // 刷新记录状态
  const refreshRecords = useCallback(async () => {
    await loadRecordedDates()
  }, [loadRecordedDates])

  // 初始化时加载数据
  useEffect(() => {
    loadRecordedDates()
  }, [loadRecordedDates])

  return { hasRecord, isLoading, refreshRecords }
}
