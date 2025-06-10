import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { KeyManager } from '@/lib/key-manager'
import { UserManager } from '@/lib/user-manager'

// 获取用户自己的所有配置（包括已停用的）
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 检查用户信任等级权限
    const userManager = new UserManager()
    const userResult = await userManager.getUserById(session.user.id)
    if (!userResult.success || !userResult.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!userManager.canUseSharedService(userResult.user.trustLevel)) {
      return NextResponse.json({
        error: '您的信任等级不足，只有LV1-4用户可以使用共享服务'
      }, { status: 403 })
    }

    const keyManager = new KeyManager()
    const result = await keyManager.getMyConfigurations(session.user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch configurations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ keys: result.keys })
  } catch (error) {
    console.error('Error in my-configs API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
