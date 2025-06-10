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
        description: 'Attempted to access user ban management without admin privileges'
      });

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // 获取被封禁用户列表
    const result = await userBanManager.getBannedUsers(page, limit);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching user bans:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // 验证输入
    const validator = new InputValidator();
    const validationRules: ValidationRules = {
      userId: { required: true, type: 'string', minLength: 1 },
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
      await logSecurityEvent({
        userId: session.user.id,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        eventType: 'invalid_input',
        severity: 'low',
        description: 'Invalid input in user ban request',
        metadata: { errors: validationResult.errors }
      });

      return NextResponse.json({
        error: 'Invalid input',
        details: validationResult.errors
      }, { status: 400 });
    }

    const { userId, reason, duration = 0, severity = 'medium' } = body;

    // 检查目标用户是否存在
    // 这里应该添加用户存在性检查

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

    // 记录管理员操作
    await logSecurityEvent({
      userId: session.user.id,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      eventType: 'system_maintenance',
      severity: 'low',
      description: `Admin manually banned user: ${userId}`,
      metadata: {
        targetUserId: userId,
        reason,
        duration,
        severity
      }
    });

    return NextResponse.json({
      success: true,
      message: 'User banned successfully'
    });

  } catch (error) {
    console.error('Error banning user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const reason = searchParams.get('reason') || 'manual';

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 验证用户ID
    const validator = new InputValidator();
    const cleanUserId = validator.sanitizeInput(userId);

    if (!cleanUserId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // 执行解封
    const result = await userBanManager.unbanUser(cleanUserId, reason);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // 记录管理员操作
    await logSecurityEvent({
      userId: session.user.id,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      eventType: 'system_maintenance',
      severity: 'low',
      description: `Admin manually unbanned user: ${cleanUserId}`,
      metadata: {
        targetUserId: cleanUserId,
        reason
      }
    });

    return NextResponse.json({
      success: true,
      message: 'User unbanned successfully'
    });

  } catch (error) {
    console.error('Error unbanning user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
