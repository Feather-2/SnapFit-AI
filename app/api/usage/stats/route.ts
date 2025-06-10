import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UsageManager } from '@/lib/usage-manager'
import { UserManager } from '@/lib/user-manager'

// 获取用户使用统计
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')

    // 获取用户信任等级
    const userManager = new UserManager()
    const userResult = await userManager.getUserById(session.user.id)
    
    if (!userResult.success || !userResult.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const usageManager = new UsageManager()
    
    // 获取使用统计
    const statsResult = await usageManager.getUserUsageStats(session.user.id, days)
    if (!statsResult.success) {
      return NextResponse.json({ error: statsResult.error }, { status: 500 })
    }

    // 获取当前限额信息
    const limitResult = await usageManager.getUserLimitInfo(
      session.user.id,
      userResult.user.trustLevel
    )
    if (!limitResult.success) {
      return NextResponse.json({ error: limitResult.error }, { status: 500 })
    }

    return NextResponse.json({
      stats: statsResult.stats,
      limits: limitResult.info
    })
  } catch (error) {
    console.error('Error fetching usage stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
