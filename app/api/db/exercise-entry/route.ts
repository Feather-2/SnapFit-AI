import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// 获取运动记录
export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const { searchParams } = new URL(request.url)
    const logId = searchParams.get('logId')

    if (logId) {
      // 获取特定日志的运动记录
      const exerciseEntries = await prisma.exerciseEntry.findMany({
        where: {
          logId,
          userId
        },
        orderBy: { createdAt: 'asc' }
      })

      return NextResponse.json({ exerciseEntries })
    } else {
      // 获取用户所有运动记录
      const exerciseEntries = await prisma.exerciseEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      })

      return NextResponse.json({ exerciseEntries })
    }
  } catch (error) {
    console.error('Get exercise entries error:', error)
    return NextResponse.json(
      { error: '获取运动记录失败' },
      { status: 500 }
    )
  }
})

// 创建运动记录
export const POST = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const data = await request.json()

    // 验证必填字段
    const requiredFields = ['logId', 'exerciseName', 'exerciseType', 'durationMinutes', 'estimatedMets', 'userWeight', 'caloriesBurnedEstimated', 'isEstimated']
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        return NextResponse.json(
          { error: `${field} 是必填字段` },
          { status: 400 }
        )
      }
    }

    const exerciseEntry = await prisma.exerciseEntry.create({
      data: {
        logId: data.logId,
        userId,
        exerciseName: data.exerciseName,
        exerciseType: data.exerciseType,
        durationMinutes: data.durationMinutes,
        distanceKm: data.distanceKm,
        sets: data.sets,
        reps: data.reps,
        weightKg: data.weightKg,
        estimatedMets: data.estimatedMets,
        userWeight: data.userWeight,
        caloriesBurnedEstimated: data.caloriesBurnedEstimated,
        muscleGroups: data.muscleGroups ? JSON.stringify(data.muscleGroups) : null,
        isEstimated: data.isEstimated,
        timestamp: data.timestamp,
      }
    })

    return NextResponse.json({ exerciseEntry })
  } catch (error) {
    console.error('Create exercise entry error:', error)
    return NextResponse.json(
      { error: '创建运动记录失败' },
      { status: 500 }
    )
  }
})

// 批量创建运动记录
export const PUT = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const { entries } = await request.json()

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: 'entries 必须是数组' },
        { status: 400 }
      )
    }

    const exerciseEntries = await prisma.exerciseEntry.createMany({
      data: entries.map((entry: any) => ({
        logId: entry.logId,
        userId,
        exerciseName: entry.exerciseName,
        exerciseType: entry.exerciseType,
        durationMinutes: entry.durationMinutes,
        distanceKm: entry.distanceKm,
        sets: entry.sets,
        reps: entry.reps,
        weightKg: entry.weightKg,
        estimatedMets: entry.estimatedMets,
        userWeight: entry.userWeight,
        caloriesBurnedEstimated: entry.caloriesBurnedEstimated,
        muscleGroups: entry.muscleGroups ? JSON.stringify(entry.muscleGroups) : null,
        isEstimated: entry.isEstimated,
        timestamp: entry.timestamp,
      }))
    })

    return NextResponse.json({ count: exerciseEntries.count })
  } catch (error) {
    console.error('Batch create exercise entries error:', error)
    return NextResponse.json(
      { error: '批量创建运动记录失败' },
      { status: 500 }
    )
  }
})
