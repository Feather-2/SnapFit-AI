import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { userBanManager } from '@/lib/user-ban-manager';
import { InputValidator, ValidationRules } from '@/lib/input-validator';
import { logSecurityEvent } from '@/lib/security-monitor';
import { getClientIP } from '@/lib/ip-utils';

// 检查管理员权限
async function checkAdminPermission(userId: string): Promise<boolean> {
  try {
    // 这里应该根据您的权限系统来实现
    // 暂时返回 true，您需要根据实际情况修改
    return true;
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

// GET /api/admin/user-bans/[userId] - 获取特定用户的封禁信息
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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
        description: 'Attempted to access user ban details without admin privileges'
      });

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = params;

    // 获取用户封禁状态
    const isBanned = await userBanManager.isUserBanned(userId);
    const banDetails = isBanned ? await userBanManager.getBanDetails(userId) : null;

    // 获取用户的所有封禁历史
    const { supabaseAdmin } = await import('@/lib/supabase');
    const { data: banHistory, error } = await supabaseAdmin
      .from('user_bans')
      .select('*')
      .eq('user_id', userId)
      .order('banned_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId,
      currentBan: {
        isBanned,
        details: banDetails?.data || null
      },
      banHistory: banHistory || []
    });

  } catch (error) {
    console.error('Error fetching user ban details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/user-bans/[userId] - 封禁用户
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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
        severity: 'high',
        description: 'Attempted to ban user without admin privileges'
      });

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = params;
    const body = await request.json();

    // 验证输入
    const validator = new InputValidator();
    const validationRules: ValidationRules = {
      reason: { required: true, type: 'string', minLength: 1, maxLength: 500 },
      duration: { required: false, type: 'number', min: 0 },
      severity: { 
        required: false, 
        type: 'string', 
        allowedValues: ['low', 'medium', 'high', 'critical'] 
      }
    };

    const validationResult = validator.validate(body, validationRules);
    if (!validationResult.isValid) {
      return NextResponse.json({
        error: 'Invalid input',
        details: validationResult.errors
      }, { status: 400 });
    }

    const { reason, duration = 0, severity = 'medium' } = body;

    // 检查用户是否已经被封禁
    const isAlreadyBanned = await userBanManager.isUserBanned(userId);
    if (isAlreadyBanned) {
      return NextResponse.json({
        error: 'User is already banned',
        message: 'Please unban the user first before applying a new ban'
      }, { status: 409 });
    }

    // 执行封禁
    const result = await userBanManager.banUser(
      userId,
      reason,
      duration,
      severity,
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'User banned successfully',
      banDetails: {
        userId,
        reason,
        duration,
        severity,
        bannedBy: session.user.id,
        bannedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error banning user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/user-bans/[userId] - 解封用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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
        description: 'Attempted to unban user without admin privileges'
      });

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') || 'Manual unban by admin';

    // 检查用户是否被封禁
    const isBanned = await userBanManager.isUserBanned(userId);
    if (!isBanned) {
      return NextResponse.json({
        error: 'User is not banned',
        message: 'Cannot unban a user who is not currently banned'
      }, { status: 409 });
    }

    // 执行解封
    const result = await userBanManager.unbanUser(userId, reason);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'User unbanned successfully',
      unbanDetails: {
        userId,
        reason,
        unbannedBy: session.user.id,
        unbannedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error unbanning user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
