import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// 获取单个运动记录
export const GET = withAuth(async (request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const userId = request.userId!
    const { id } = await params

    const exerciseEntry = await prisma.exerciseEntry.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!exerciseEntry) {
      return NextResponse.json(
        { error: '运动记录不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ exerciseEntry })
  } catch (error) {
    console.error('Get exercise entry error:', error)
    return NextResponse.json(
      { error: '获取运动记录失败' },
      { status: 500 }
    )
  }
})

// 更新运动记录
export const PUT = withAuth(async (request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const userId = request.userId!
    const { id } = await params
    const data = await request.json()

    // 验证记录是否属于当前用户
    const existingEntry = await prisma.exerciseEntry.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: '运动记录不存在' },
        { status: 404 }
      )
    }

    const exerciseEntry = await prisma.exerciseEntry.update({
      where: { id },
      data: {
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
    console.error('Update exercise entry error:', error)
    return NextResponse.json(
      { error: '更新运动记录失败' },
      { status: 500 }
    )
  }
})

// 删除运动记录
export const DELETE = withAuth(async (request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const userId = request.userId!
    const { id } = await params

    // 验证记录是否属于当前用户
    const existingEntry = await prisma.exerciseEntry.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: '运动记录不存在' },
        { status: 404 }
      )
    }

    await prisma.exerciseEntry.delete({
      where: { id }
    })

    return NextResponse.json({ message: '运动记录已删除' })
  } catch (error) {
    console.error('Delete exercise entry error:', error)
    return NextResponse.json(
      { error: '删除运动记录失败' },
      { status: 500 }
    )
  }
})
