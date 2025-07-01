import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// 导出用户所有数据
export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!

    // 获取用户基本信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // 获取用户配置
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId }
    })

    // 获取所有每日日志
    const dailyLogs = await prisma.dailyLog.findMany({
      where: { userId },
      include: {
        foodEntries: true,
        exerciseEntries: true
      },
      orderBy: { date: 'asc' }
    })

    // 获取 AI 记忆
    const aiMemories = await prisma.aIMemory.findMany({
      where: { userId }
    })

    // 获取 AI 配置
    const aiConfig = await prisma.aIConfig.findUnique({
      where: { userId }
    })

    // 构建导出数据结构
    const exportData = {
      exportInfo: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        userId: user?.id,
        username: user?.username
      },
      user,
      userProfile,
      dailyLogs: dailyLogs.map(log => ({
        ...log,
        // 解析 JSON 字段
        tefAnalysis: log.tefAnalysis ? JSON.parse(log.tefAnalysis) : null,
        dailyStatus: log.dailyStatus ? JSON.parse(log.dailyStatus) : null,
        foodEntries: log.foodEntries.map(entry => ({
          ...entry,
          nutritionalInfoPer100g: JSON.parse(entry.nutritionalInfoPer100g),
          totalNutritionalInfoConsumed: JSON.parse(entry.totalNutritionalInfoConsumed)
        })),
        exerciseEntries: log.exerciseEntries.map(entry => ({
          ...entry,
          muscleGroups: entry.muscleGroups ? JSON.parse(entry.muscleGroups) : null
        }))
      })),
      aiMemories: aiMemories.map(memory => ({
        ...memory,
        keyInsights: memory.keyInsights ? JSON.parse(memory.keyInsights) : null,
        userPreferences: memory.userPreferences ? JSON.parse(memory.userPreferences) : null,
        healthPatterns: memory.healthPatterns ? JSON.parse(memory.healthPatterns) : null,
        goals: memory.goals ? JSON.parse(memory.goals) : null,
        concerns: memory.concerns ? JSON.parse(memory.concerns) : null
      })),
      aiConfig: aiConfig ? {
        ...aiConfig,
        chatModel: aiConfig.chatModel ? JSON.parse(aiConfig.chatModel) : null,
        parseModel: aiConfig.parseModel ? JSON.parse(aiConfig.parseModel) : null,
        adviceModel: aiConfig.adviceModel ? JSON.parse(aiConfig.adviceModel) : null,
        tefModel: aiConfig.tefModel ? JSON.parse(aiConfig.tefModel) : null
      } : null
    }

    return NextResponse.json(exportData)
  } catch (error) {
    console.error('Export data error:', error)
    return NextResponse.json(
      { error: '导出数据失败' },
      { status: 500 }
    )
  }
})
