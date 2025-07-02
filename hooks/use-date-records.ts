"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { useDailyLogServer } from "./use-daily-log-server"

interface DateRecordsHook {
  hasRecord: (date: Date) => boolean
  isLoading: boolean
  refreshRecords: () => Promise<void>
}

export function useDateRecords(): DateRecordsHook {
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const { getAllDailyLogs } = useDailyLogServer()

  // 检查某个日期是否有记录
  const hasRecord = useCallback((date: Date): boolean => {
    const dateKey = format(date, "yyyy-MM-dd")
    return recordedDates.has(dateKey)
  }, [recordedDates])

  // 从服务端加载所有有记录的日期
  const loadRecordedDates = useCallback(async () => {
    setIsLoading(true)
    try {
      const allLogs = await getAllDailyLogs()
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
    } catch (error) {
      console.error('Error loading recorded dates:', error)
      setIsLoading(false)
    }
  }, [getAllDailyLogs])

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
