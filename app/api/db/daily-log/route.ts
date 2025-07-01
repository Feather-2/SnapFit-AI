import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// 获取每日日志
export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (date) {
      // 获取特定日期的日志
      const dailyLog = await prisma.dailyLog.findUnique({
        where: {
          userId_date: {
            userId,
            date
          }
        },
        include: {
          foodEntries: true,
          exerciseEntries: true
        }
      })

      return NextResponse.json({ dailyLog })
    } else {
      // 获取所有日志
      const dailyLogs = await prisma.dailyLog.findMany({
        where: { userId },
        include: {
          foodEntries: true,
          exerciseEntries: true
        },
        orderBy: { date: 'desc' }
      })

      return NextResponse.json({ dailyLogs })
    }
  } catch (error) {
    console.error('Get daily log error:', error)
    return NextResponse.json(
      { error: '获取每日日志失败' },
      { status: 500 }
    )
  }
})

// 创建或更新每日日志
export const POST = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const data = await request.json()

    if (!data.date) {
      return NextResponse.json(
        { error: 'date 是必填字段' },
        { status: 400 }
      )
    }

    // 使用 upsert 创建或更新日志
    const dailyLog = await prisma.dailyLog.upsert({
      where: {
        userId_date: {
          userId,
          date: data.date
        }
      },
      update: {
        weight: data.weight,
        activityLevel: data.activityLevel,
        calculatedBMR: data.calculatedBMR,
        calculatedTDEE: data.calculatedTDEE,
        tefAnalysis: data.tefAnalysis ? JSON.stringify(data.tefAnalysis) : null,
        dailyStatus: data.dailyStatus ? JSON.stringify(data.dailyStatus) : null,
      },
      create: {
        userId,
        date: data.date,
        weight: data.weight,
        activityLevel: data.activityLevel,
        calculatedBMR: data.calculatedBMR,
        calculatedTDEE: data.calculatedTDEE,
        tefAnalysis: data.tefAnalysis ? JSON.stringify(data.tefAnalysis) : null,
        dailyStatus: data.dailyStatus ? JSON.stringify(data.dailyStatus) : null,
      },
      include: {
        foodEntries: true,
        exerciseEntries: true
      }
    })

    return NextResponse.json({ dailyLog })
  } catch (error) {
    console.error('Save daily log error:', error)
    return NextResponse.json(
      { error: '保存每日日志失败' },
      { status: 500 }
    )
  }
})

// 删除每日日志
export const DELETE = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json(
        { error: 'date 参数是必需的' },
        { status: 400 }
      )
    }

    await prisma.dailyLog.delete({
      where: {
        userId_date: {
          userId,
          date
        }
      }
    })

    return NextResponse.json({ message: '每日日志已删除' })
  } catch (error) {
    console.error('Delete daily log error:', error)
    return NextResponse.json(
      { error: '删除每日日志失败' },
      { status: 500 }
    )
  }
})
