import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// 获取 AI 记忆
export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const { searchParams } = new URL(request.url)
    const expertId = searchParams.get('expertId')

    if (expertId) {
      // 获取特定专家的记忆
      const aiMemory = await prisma.aIMemory.findUnique({
        where: {
          userId_expertId: {
            userId,
            expertId
          }
        }
      })

      return NextResponse.json({ aiMemory })
    } else {
      // 获取所有 AI 记忆
      const aiMemories = await prisma.aIMemory.findMany({
        where: { userId },
        orderBy: { lastUpdated: 'desc' }
      })

      return NextResponse.json({ aiMemories })
    }
  } catch (error) {
    console.error('Get AI memory error:', error)
    return NextResponse.json(
      { error: '获取AI记忆失败' },
      { status: 500 }
    )
  }
})

// 创建或更新 AI 记忆
export const POST = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const data = await request.json()

    if (!data.expertId) {
      return NextResponse.json(
        { error: 'expertId 是必填字段' },
        { status: 400 }
      )
    }

    // 使用 upsert 创建或更新记忆
    const aiMemory = await prisma.aIMemory.upsert({
      where: {
        userId_expertId: {
          userId,
          expertId: data.expertId
        }
      },
      update: {
        conversationCount: data.conversationCount,
        lastUpdated: new Date(),
        keyInsights: data.keyInsights ? JSON.stringify(data.keyInsights) : null,
        userPreferences: data.userPreferences ? JSON.stringify(data.userPreferences) : null,
        healthPatterns: data.healthPatterns ? JSON.stringify(data.healthPatterns) : null,
        goals: data.goals ? JSON.stringify(data.goals) : null,
        concerns: data.concerns ? JSON.stringify(data.concerns) : null,
      },
      create: {
        userId,
        expertId: data.expertId,
        conversationCount: data.conversationCount || 0,
        keyInsights: data.keyInsights ? JSON.stringify(data.keyInsights) : null,
        userPreferences: data.userPreferences ? JSON.stringify(data.userPreferences) : null,
        healthPatterns: data.healthPatterns ? JSON.stringify(data.healthPatterns) : null,
        goals: data.goals ? JSON.stringify(data.goals) : null,
        concerns: data.concerns ? JSON.stringify(data.concerns) : null,
      }
    })

    return NextResponse.json({ aiMemory })
  } catch (error) {
    console.error('Save AI memory error:', error)
    return NextResponse.json(
      { error: '保存AI记忆失败' },
      { status: 500 }
    )
  }
})

// 删除 AI 记忆
export const DELETE = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const { searchParams } = new URL(request.url)
    const expertId = searchParams.get('expertId')

    if (!expertId) {
      return NextResponse.json(
        { error: 'expertId 参数是必需的' },
        { status: 400 }
      )
    }

    await prisma.aIMemory.delete({
      where: {
        userId_expertId: {
          userId,
          expertId
        }
      }
    })

    return NextResponse.json({ message: 'AI记忆已删除' })
  } catch (error) {
    console.error('Delete AI memory error:', error)
    return NextResponse.json(
      { error: '删除AI记忆失败' },
      { status: 500 }
    )
  }
})

// 清空所有 AI 记忆
export const PUT = withAuth(async (request) => {
  try {
    const userId = request.userId!

    await prisma.aIMemory.deleteMany({
      where: { userId }
    })

    return NextResponse.json({ message: '所有AI记忆已清空' })
  } catch (error) {
    console.error('Clear AI memories error:', error)
    return NextResponse.json(
      { error: '清空AI记忆失败' },
      { status: 500 }
    )
  }
})
