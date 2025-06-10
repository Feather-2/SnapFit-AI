import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { KeyManager } from '@/lib/key-manager'
import { UserManager } from '@/lib/user-manager'

// 删除共享Key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const result = await keyManager.deleteSharedKey(params.id, session.user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete key' },
        { status: result.error?.includes('not found') ? 404 : 403 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shared key:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 更新共享Key
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json()
    const keyManager = new KeyManager()
    const result = await keyManager.updateSharedKey(params.id, session.user.id, body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update key' },
        { status: result.error?.includes('not found') ? 404 : 403 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating shared key:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
