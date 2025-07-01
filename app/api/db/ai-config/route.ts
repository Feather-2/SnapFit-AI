import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// 获取 AI 配置
export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!

    const aiConfig = await prisma.aIConfig.findUnique({
      where: { userId }
    })

    return NextResponse.json({ aiConfig })
  } catch (error) {
    console.error('Get AI config error:', error)
    return NextResponse.json(
      { error: '获取AI配置失败' },
      { status: 500 }
    )
  }
})

// 创建或更新 AI 配置
export const POST = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const data = await request.json()

    // 使用 upsert 创建或更新配置
    const aiConfig = await prisma.aIConfig.upsert({
      where: { userId },
      update: {
        chatModel: data.chatModel ? JSON.stringify(data.chatModel) : null,
        parseModel: data.parseModel ? JSON.stringify(data.parseModel) : null,
        adviceModel: data.adviceModel ? JSON.stringify(data.adviceModel) : null,
        tefModel: data.tefModel ? JSON.stringify(data.tefModel) : null,
      },
      create: {
        userId,
        chatModel: data.chatModel ? JSON.stringify(data.chatModel) : null,
        parseModel: data.parseModel ? JSON.stringify(data.parseModel) : null,
        adviceModel: data.adviceModel ? JSON.stringify(data.adviceModel) : null,
        tefModel: data.tefModel ? JSON.stringify(data.tefModel) : null,
      }
    })

    return NextResponse.json({ aiConfig })
  } catch (error) {
    console.error('Save AI config error:', error)
    return NextResponse.json(
      { error: '保存AI配置失败' },
      { status: 500 }
    )
  }
})

// 删除 AI 配置
export const DELETE = withAuth(async (request) => {
  try {
    const userId = request.userId!

    await prisma.aIConfig.delete({
      where: { userId }
    })

    return NextResponse.json({ message: 'AI配置已删除' })
  } catch (error) {
    console.error('Delete AI config error:', error)
    return NextResponse.json(
      { error: '删除AI配置失败' },
      { status: 500 }
    )
  }
})
