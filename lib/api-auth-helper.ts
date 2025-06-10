import { auth } from '@/lib/auth'
import { UserManager } from '@/lib/user-manager'
import { UsageManager } from '@/lib/usage-manager'

// 获取下次重置时间
function getNextResetTime(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

export interface ApiAuthResult {
  success: boolean
  session?: any
  usageManager?: UsageManager
  error?: {
    message: string
    code: string
    status: number
  }
}

/**
 * 统一的API身份验证和限制检查
 * 只对共享模式用户进行限制检查，私有模式用户跳过限制
 */
export async function checkApiAuth(aiConfig?: any, usageType: 'conversation_count' | 'image_count' = 'conversation_count'): Promise<ApiAuthResult> {
  try {
    // 🔒 第1层：身份验证
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
          status: 401
        }
      }
    }

    // 🔍 检查AI配置模式
    const isSharedMode = aiConfig?.agentModel?.source === 'shared' ||
                        aiConfig?.chatModel?.source === 'shared' ||
                        aiConfig?.visionModel?.source === 'shared'

    console.log('🔍 AI Config mode detection:', {
      agentModel: aiConfig?.agentModel?.source,
      chatModel: aiConfig?.chatModel?.source,
      visionModel: aiConfig?.visionModel?.source,
      isSharedMode
    })

    // 🔑 私有模式用户跳过限制检查
    if (!isSharedMode) {
      console.log('✅ Private mode detected, skipping usage limits')
      return {
        success: true,
        session,
        usageManager: null // 私有模式不需要使用管理器
      }
    }

    console.log('🔒 Shared mode detected, checking usage limits')

    // 🔒 共享模式：进行完整的限制检查
    // 第2层：获取用户信任等级
    const userManager = new UserManager()
    const userResult = await userManager.getUserById(session.user.id)

    if (!userResult.success || !userResult.user) {
      return {
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          status: 404
        }
      }
    }

    // 第3层：原子性限额检查和记录
    const usageManager = new UsageManager()
    const usageResult = await usageManager.checkAndRecordUsage(
      session.user.id,
      userResult.user.trustLevel,
      usageType
    )

    // 🚫 绝对不允许超过限额
    if (!usageResult.allowed) {
      return {
        success: false,
        error: {
          message: 'Daily usage limit exceeded',
          code: 'LIMIT_EXCEEDED',
          status: 429,
          details: {
            currentUsage: usageResult.newCount,
            dailyLimit: usageResult.limit,
            trustLevel: userResult.user.trustLevel,
            resetTime: getNextResetTime()
          }
        }
      }
    }

    return {
      success: true,
      session,
      usageManager
    }

  } catch (error) {
    console.error('API auth check error:', error)
    return {
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        status: 500
      }
    }
  }
}

/**
 * 回滚使用计数（仅在共享模式下有效）
 */
export async function rollbackUsageIfNeeded(usageManager: UsageManager | null, userId: string, usageType: 'conversation_count' | 'image_count' = 'conversation_count') {
  if (usageManager) {
    try {
      await usageManager.rollbackUsage(userId, usageType)
    } catch (error) {
      console.error('Error during usage rollback:', error)
    }
  }
}
