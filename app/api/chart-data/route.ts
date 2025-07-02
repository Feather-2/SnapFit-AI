import { NextRequest, NextResponse } from "next/server"
import { format, parseISO, eachDayOfInterval } from "date-fns"
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Missing start or end date" }, { status: 400 })
    }

    // 解析日期
    const start = parseISO(startDate)
    const end = parseISO(endDate)

    // 生成日期范围内的所有日期
    const dateRange = eachDayOfInterval({ start, end })

    // 从数据库获取真实数据
    const chartData = await Promise.all(
      dateRange.map(async (date) => {
        const dateStr = format(date, 'yyyy-MM-dd')

        // 获取当日数据
        const dailyData = await getDailyHealthData(userId, dateStr)

        return {
          date: format(date, 'MM-dd'),
          weight: dailyData.weight,
          caloriesIn: dailyData.caloriesIn,
          caloriesOut: dailyData.caloriesOut,
          calorieDeficit: dailyData.calorieDeficit
        }
      })
    )

    return NextResponse.json(chartData)
  } catch (error) {
    console.error('获取图表数据失败:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

// 获取指定日期的健康数据
async function getDailyHealthData(userId: string, dateStr: string) {
  try {
    // 从数据库获取指定日期的日志数据
    const dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateStr
        }
      },
      include: {
        foodEntries: true,
        exerciseEntries: true
      }
    })

    if (!dailyLog) {
      return {
        weight: null,
        caloriesIn: 0,
        caloriesOut: 0,
        calorieDeficit: 0
      }
    }

    // 计算总摄入热量
    const caloriesIn = dailyLog.foodEntries.reduce((total, entry) => {
      const nutritionalInfo = JSON.parse(entry.totalNutritionalInfoConsumed)
      return total + (nutritionalInfo.calories || 0)
    }, 0)

    // 计算总消耗热量
    const caloriesOut = dailyLog.exerciseEntries.reduce((total, entry) => {
      return total + (entry.caloriesBurnedEstimated || 0)
    }, 0)

    // 计算热量缺口 (摄入 - 消耗 - TDEE)
    const tdee = dailyLog.calculatedTDEE || 1800 // 默认TDEE
    const calorieDeficit = caloriesIn - caloriesOut - tdee

    return {
      weight: dailyLog.weight,
      caloriesIn: Math.round(caloriesIn),
      caloriesOut: Math.round(caloriesOut),
      calorieDeficit: Math.round(calorieDeficit)
    }
  } catch (error) {
    console.error('获取日志数据失败:', error)
    // 返回默认值
    return {
      weight: null,
      caloriesIn: 0,
      caloriesOut: 0,
      calorieDeficit: 0
    }
  }
}
