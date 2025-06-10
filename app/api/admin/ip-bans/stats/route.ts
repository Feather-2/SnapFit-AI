import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ipBanManager } from '@/lib/ip-ban-manager';
import { logSecurityEvent } from '@/lib/security-monitor';
import { getClientIP } from '@/lib/ip-utils';

// 检查管理员权限
async function checkAdminPermission(userId: string): Promise<boolean> {
  try {
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(',') || [];
    return adminUserIds.includes(userId);
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

// 获取IP封禁统计信息
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查管理员权限
    const isAdmin = await checkAdminPermission(session.user.id);
    if (!isAdmin) {
      await logSecurityEvent({
        userId: session.user.id,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        eventType: 'unauthorized_access',
        severity: 'medium',
        description: 'Attempted to access IP ban statistics without admin privileges'
      });

      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 获取统计信息
    const stats = await ipBanManager.getBanStats();

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching IP ban stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
