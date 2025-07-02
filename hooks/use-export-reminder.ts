import { useState, useEffect } from 'react'
import { useDailyLogServer } from './use-daily-log-server'

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
  const { getAllDailyLogs } = useDailyLogServer()

  useEffect(() => {
    const checkExportReminder = async () => {
      try {
        // 首先检查IndexedDB中的数据
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

    // 检查服务端数据的时间跨度
    const checkDataSpan = async (): Promise<{ hasData: boolean; spanDays: number }> => {
      try {
        const allLogs = await getAllDailyLogs()

        if (!allLogs || allLogs.length === 0) {
          return { hasData: false, spanDays: 0 }
        }

        // 获取所有有数据的日期
        const dates = allLogs
          .filter(log => log && (
            (log.foodEntries && log.foodEntries.length > 0) ||
            (log.exerciseEntries && log.exerciseEntries.length > 0) ||
            log.weight !== undefined
          ))
          .map(log => new Date(log.date))
          .sort((a, b) => a.getTime() - b.getTime())

        if (dates.length === 0) {
          return { hasData: false, spanDays: 0 }
        }

        // 计算最早和最晚日期的差值
        const earliestDate = dates[0]
        const latestDate = dates[dates.length - 1]
        const timeDiff = latestDate.getTime() - earliestDate.getTime()
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

        // 需要至少2天的数据跨度
        return {
          hasData: daysDiff >= 1, // 至少跨越2天（差值>=1）
          spanDays: daysDiff + 1 // 实际天数
        }
      } catch (error) {
        console.error('检查数据跨度失败:', error)
        return { hasData: false, spanDays: 0 }
      }
    }

    checkExportReminder()

    // 每小时检查一次
    const interval = setInterval(checkExportReminder, 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [getAllDailyLogs])

  return reminderState
}
