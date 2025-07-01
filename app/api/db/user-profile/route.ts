import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// 获取用户配置
export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!

    const profile = await prisma.userProfile.findUnique({
      where: { userId }
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Get user profile error:', error)
    return NextResponse.json(
      { error: '获取用户配置失败' },
      { status: 500 }
    )
  }
})

// 创建或更新用户配置
export const POST = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const data = await request.json()

    // 验证必填字段
    const requiredFields = ['weight', 'height', 'age', 'gender', 'activityLevel', 'goal']
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        return NextResponse.json(
          { error: `${field} 是必填字段` },
          { status: 400 }
        )
      }
    }

    // 使用 upsert 创建或更新配置
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        weight: data.weight,
        height: data.height,
        age: data.age,
        gender: data.gender,
        activityLevel: data.activityLevel,
        goal: data.goal,
        targetWeight: data.targetWeight,
        targetCalories: data.targetCalories,
        notes: data.notes,
        bmrFormula: data.bmrFormula,
        bmrCalculationBasis: data.bmrCalculationBasis,
        bodyFatPercentage: data.bodyFatPercentage,
        professionalMode: data.professionalMode,
        medicalHistory: data.medicalHistory,
        lifestyle: data.lifestyle,
        healthAwareness: data.healthAwareness,
      },
      create: {
        userId,
        weight: data.weight,
        height: data.height,
        age: data.age,
        gender: data.gender,
        activityLevel: data.activityLevel,
        goal: data.goal,
        targetWeight: data.targetWeight,
        targetCalories: data.targetCalories,
        notes: data.notes,
        bmrFormula: data.bmrFormula,
        bmrCalculationBasis: data.bmrCalculationBasis,
        bodyFatPercentage: data.bodyFatPercentage,
        professionalMode: data.professionalMode,
        medicalHistory: data.medicalHistory,
        lifestyle: data.lifestyle,
        healthAwareness: data.healthAwareness,
      }
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Save user profile error:', error)
    return NextResponse.json(
      { error: '保存用户配置失败' },
      { status: 500 }
    )
  }
})

// 删除用户配置
export const DELETE = withAuth(async (request) => {
  try {
    const userId = request.userId!

    await prisma.userProfile.delete({
      where: { userId }
    })

    return NextResponse.json({ message: '用户配置已删除' })
  } catch (error) {
    console.error('Delete user profile error:', error)
    return NextResponse.json(
      { error: '删除用户配置失败' },
      { status: 500 }
    )
  }
})
