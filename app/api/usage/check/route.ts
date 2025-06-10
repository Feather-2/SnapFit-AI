import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UsageManager } from '@/lib/usage-manager'
import { UserManager } from '@/lib/user-manager'

// 检查用户使用限额
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'conversation'

    // 获取用户信任等级
    const userManager = new UserManager()
    const userResult = await userManager.getUserById(session.user.id)

    if (!userResult.success || !userResult.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const usageManager = new UsageManager()

    switch (type) {
      case 'conversation':
        const conversationCheck = await usageManager.checkConversationLimit(
          session.user.id,
          userResult.user.trustLevel
        )
        return NextResponse.json(conversationCheck)

      default:
        return NextResponse.json({ error: 'Invalid usage type' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 🔒 原子性检查和记录使用量
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type = 'conversation' } = body

    // 获取用户信任等级
    const userManager = new UserManager()
    const userResult = await userManager.getUserById(session.user.id)

    if (!userResult.success || !userResult.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const usageManager = new UsageManager()

    // 🔒 原子性检查和记录使用量
    switch (type) {
      case 'conversation':
        const result = await usageManager.checkAndRecordUsage(
          session.user.id,
          userResult.user.trustLevel,
          'conversation_count'
        )

        // 🚫 绝对不允许超过限额
        if (!result.allowed) {
          return NextResponse.json({
            error: result.error || 'Daily limit exceeded',
            code: 'LIMIT_EXCEEDED',
            usage: {
              allowed: false,
              currentUsage: result.newCount,
              dailyLimit: result.limit,
              remaining: 0,
              resetTime: getNextResetTime()
            }
          }, { status: 429 }) // Too Many Requests
        }

        // ✅ 成功记录使用
        return NextResponse.json({
          success: true,
          usage: {
            allowed: true,
            currentUsage: result.newCount,
            dailyLimit: result.limit,
            remaining: Math.max(0, result.limit - result.newCount),
            resetTime: getNextResetTime()
          }
        })

      default:
        return NextResponse.json({ error: 'Invalid usage type' }, { status: 400 })
    }
  } catch (error) {
    // 🚫 任何异常都默认拒绝
    return NextResponse.json({
      error: 'Service temporarily unavailable',
      code: 'SERVICE_ERROR'
    }, { status: 503 })
  }
}

// 获取下次重置时间的辅助方法
function getNextResetTime(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}
