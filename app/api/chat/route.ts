import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UsageManager } from '@/lib/usage-manager'
import { UserManager } from '@/lib/user-manager'

// 🔒 严格限额控制的AI聊天API
export async function POST(request: NextRequest) {
  try {
    // 🔒 第1层：用户身份验证
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    // 🔒 第2层：获取用户信任等级
    const userManager = new UserManager()
    const userResult = await userManager.getUserById(session.user.id)

    if (!userResult.success || !userResult.user) {
      return NextResponse.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, { status: 404 })
    }

    // 🔒 第3层：原子性限额检查和记录
    const usageManager = new UsageManager()
    const usageResult = await usageManager.checkAndRecordUsage(
      session.user.id,
      userResult.user.trustLevel,
      'conversation_count'
    )

    // 🚫 绝对不允许超过限额
    if (!usageResult.allowed) {
      // 🚨 记录违规尝试（已在 checkAndRecordUsage 中处理）
      return NextResponse.json({
        error: 'Daily conversation limit exceeded',
        code: 'LIMIT_EXCEEDED',
        details: {
          currentUsage: usageResult.newCount,
          dailyLimit: usageResult.limit,
          trustLevel: userResult.user.trustLevel,
          resetTime: getNextResetTime()
        }
      }, { status: 429 }) // Too Many Requests
    }

    // ✅ 通过所有安全检查，处理AI请求
    try {
      const body = await request.json()
      const { message, model = 'gpt-3.5-turbo' } = body

      if (!message || typeof message !== 'string') {
        // 🔄 回滚使用计数（输入无效）
        await usageManager.rollbackUsage(session.user.id, 'conversation_count')
        return NextResponse.json({
          error: 'Invalid message format',
          code: 'INVALID_INPUT'
        }, { status: 400 })
      }

      // 🤖 调用AI服务（这里是示例）
      const aiResponse = await processAIRequest({
        message,
        model,
        userId: session.user.id,
        trustLevel: userResult.user.trustLevel
      })

      // ✅ 成功响应
      return NextResponse.json({
        success: true,
        response: aiResponse.content,
        usage: {
          currentUsage: usageResult.newCount,
          dailyLimit: usageResult.limit,
          remaining: Math.max(0, usageResult.limit - usageResult.newCount)
        },
        model: aiResponse.model,
        timestamp: new Date().toISOString()
      })

    } catch (aiError) {
      // 🔄 AI服务失败，回滚使用计数
      await usageManager.rollbackUsage(
        session.user.id,
        'conversation_count'
      )

      return NextResponse.json({
        error: 'AI service temporarily unavailable',
        code: 'AI_SERVICE_ERROR'
      }, { status: 503 })
    }

  } catch (error) {
    console.error('Error in chat API:', error)

    // 🚫 任何未预期的错误都默认拒绝
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
}

// 🤖 AI请求处理函数（示例实现）
async function processAIRequest({
  message,
  model,
  userId,
  trustLevel
}: {
  message: string
  model: string
  userId: string
  trustLevel: number
}): Promise<{
  content: string
  model: string
  usage?: any
}> {
  // 这里集成实际的AI服务
  // 例如：OpenAI, Claude, 或其他AI服务

  // 🔒 根据信任等级限制模型访问
  const allowedModels = getAllowedModels(trustLevel)
  if (!allowedModels.includes(model)) {
    throw new Error(`Model ${model} not allowed for trust level ${trustLevel}`)
  }

  // 🔒 内容安全检查
  if (await isUnsafeContent(message)) {
    throw new Error('Content violates safety guidelines')
  }

  // 模拟AI响应（实际实现中替换为真实的AI调用）
  const response = {
    content: `AI Response to: ${message}`,
    model: model,
    usage: {
      prompt_tokens: message.length,
      completion_tokens: 50,
      total_tokens: message.length + 50
    }
  }

  return response
}

// 🔒 根据信任等级获取允许的模型
function getAllowedModels(trustLevel: number): string[] {
  switch (trustLevel) {
    case 0:
      return [] // 新用户无法使用
    case 1:
      return ['gpt-3.5-turbo'] // 基础模型
    case 2:
      return ['gpt-3.5-turbo', 'gpt-4'] // 标准模型
    case 3:
    case 4:
      return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3'] // 高级模型
    default:
      return []
  }
}

// 🔒 内容安全检查
async function isUnsafeContent(message: string): Promise<boolean> {
  // 实现内容安全检查逻辑
  // 例如：检查恶意内容、垃圾信息等

  const unsafePatterns = [
    /hack/i,
    /malware/i,
    /illegal/i
    // 添加更多安全模式
  ]

  return unsafePatterns.some(pattern => pattern.test(message))
}

// 获取下次重置时间
function getNextResetTime(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

// 🔒 GET方法：检查用户状态（不消耗使用量）
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 })
    }

    const userManager = new UserManager()
    const userResult = await userManager.getUserById(session.user.id)

    if (!userResult.success || !userResult.user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 })
    }

    const usageManager = new UsageManager()
    const limitInfo = await usageManager.getUserLimitInfo(
      session.user.id,
      userResult.user.trustLevel
    )

    if (!limitInfo.success) {
      return NextResponse.json({
        error: 'Failed to get limit info'
      }, { status: 500 })
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        trustLevel: userResult.user.trustLevel,
        trustLevelName: limitInfo.info?.trustLevelName
      },
      limits: limitInfo.info?.dailyLimits,
      allowedModels: getAllowedModels(userResult.user.trustLevel),
      resetTime: getNextResetTime()
    })

  } catch (error) {
    console.error('Error in chat status API:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}
