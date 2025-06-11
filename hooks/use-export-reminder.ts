import { useState, useEffect, useCallback } from 'react'
import { useIndexedDB } from './use-indexed-db'

interface ExportReminderState {
  shouldRemind: boolean
  daysSinceLastExport: number
  lastExportDate: Date | null
  hasEnoughData: boolean
  dataSpanDays: number
}

export function useExportReminder(): ExportReminderState {
  const [reminderState, setReminderState] = useState<ExportReminderState>({
    shouldRemind: false,
    daysSinceLastExport: 0,
    lastExportDate: null,
    hasEnoughData: false,
    dataSpanDays: 0
  })

  const { getAllData, waitForInitialization } = useIndexedDB('healthLogs')

  const checkDataSpan = useCallback(async (): Promise<{ hasData: boolean; spanDays: number }> => {
    try {
      await waitForInitialization()
      const allLogs: any[] = await getAllData()

      if (!allLogs || allLogs.length === 0) {
        return { hasData: false, spanDays: 0 }
      }

      const dates = allLogs
        .filter(log => log && (
          (log.foodEntries && log.foodEntries.length > 0) ||
          (log.exerciseEntries && log.exerciseEntries.length > 0) ||
          log.weight !== undefined
        ))
        .map(log => new Date(log.date))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())

      if (dates.length === 0) {
        return { hasData: false, spanDays: 0 }
      }

      const earliestDate = dates[0]
      const latestDate = dates[dates.length - 1]
      const timeDiff = latestDate.getTime() - earliestDate.getTime()
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

      return { hasData: daysDiff >= 1, spanDays: daysDiff + 1 }
    } catch (error) {
      console.error('checkDataSpan error:', error)
      return { hasData: false, spanDays: 0 }
    }
  }, [getAllData, waitForInitialization])

  useEffect(() => {
    const checkExportReminder = async () => {
      try {
        const hasEnoughData = await checkDataSpan()

        if (!hasEnoughData.hasData) {
          // 如果没有足够的数据，不提醒导出
          setReminderState({
            shouldRemind: false,
            daysSinceLastExport: 0,
            lastExportDate: null,
            hasEnoughData: false,
            dataSpanDays: hasEnoughData.spanDays
          })
          return
        }

        const lastExportTimeStr = localStorage.getItem('lastExportTime')

        if (!lastExportTimeStr) {
          // 从未导出过，且有足够数据，提醒导出
          setReminderState({
            shouldRemind: true,
            daysSinceLastExport: Infinity,
            lastExportDate: null,
            hasEnoughData: true,
            dataSpanDays: hasEnoughData.spanDays
          })
          return
        }

        const lastExportTime = new Date(lastExportTimeStr)
        const now = new Date()
        const timeDiff = now.getTime() - lastExportTime.getTime()
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

        setReminderState({
          shouldRemind: daysDiff >= 2,
          daysSinceLastExport: daysDiff,
          lastExportDate: lastExportTime,
          hasEnoughData: true,
          dataSpanDays: hasEnoughData.spanDays
        })
      } catch (error) {
        console.error('Error checking export reminder:', error)
        setReminderState({
          shouldRemind: false,
          daysSinceLastExport: 0,
          lastExportDate: null,
          hasEnoughData: false,
          dataSpanDays: 0
        })
      }
    }

    checkExportReminder()

    // 每小时检查一次
    const interval = setInterval(checkExportReminder, 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [checkDataSpan])

  return reminderState
}
