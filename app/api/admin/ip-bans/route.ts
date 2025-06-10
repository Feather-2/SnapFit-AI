import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ipBanManager } from '@/lib/ip-ban-manager';
import { InputValidator, ValidationRules } from '@/lib/input-validator';
import { logSecurityEvent } from '@/lib/security-monitor';
import { getClientIP } from '@/lib/ip-utils';

// 检查管理员权限
async function checkAdminPermission(userId: string): Promise<boolean> {
  try {
    // 这里应该实现真正的管理员权限检查
    // 可以检查用户的角色、权限等
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(',') || [];
    return adminUserIds.includes(userId);
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

// 获取IP封禁列表
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
        description: 'Attempted to access IP ban management without admin privileges'
      });

      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const result = await ipBanManager.getBannedIPs(page, limit);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit)
    });

  } catch (error) {
    console.error('Error fetching IP bans:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 手动封禁IP
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
        description: 'Attempted to ban IP without admin privileges'
      });

      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // 输入验证
    const validation = InputValidator.validateObject(body, {
      ipAddress: {
        required: true,
        type: 'string',
        pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      },
      reason: {
        required: true,
        type: 'string',
        minLength: 5,
        maxLength: 500
      },
      duration: {
        required: false,
        type: 'number',
        customValidator: (value: number) => value >= 0 && value <= 525600 // 最多1年
      },
      severity: {
        required: false,
        type: 'string',
        customValidator: (value: string) => ['low', 'medium', 'high', 'critical'].includes(value)
      }
    });

    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Invalid input',
        details: validation.errors
      }, { status: 400 });
    }

    const { ipAddress, reason, duration = 0, severity = 'medium' } = validation.sanitizedValue;

    // 执行封禁
    const result = await ipBanManager.banIP(
      ipAddress,
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
      description: `Admin manually banned IP: ${ipAddress}`,
      metadata: {
        targetIP: ipAddress,
        reason,
        duration,
        severity
      }
    });

    return NextResponse.json({
      success: true,
      message: 'IP banned successfully'
    });

  } catch (error) {
    console.error('Error banning IP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 解封IP
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
        description: 'Attempted to unban IP without admin privileges'
      });

      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ipAddress = searchParams.get('ip');
    const reason = searchParams.get('reason') || 'manual_unban';

    if (!ipAddress) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    // 验证IP地址格式
    const ipValidation = InputValidator.validateField(ipAddress, {
      required: true,
      type: 'string',
      pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    }, 'ipAddress');

    if (!ipValidation.isValid) {
      return NextResponse.json({
        error: 'Invalid IP address format',
        details: ipValidation.errors
      }, { status: 400 });
    }

    // 执行解封
    const result = await ipBanManager.unbanIP(ipAddress, reason);

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
      description: `Admin manually unbanned IP: ${ipAddress}`,
      metadata: {
        targetIP: ipAddress,
        reason
      }
    });

    return NextResponse.json({
      success: true,
      message: 'IP unbanned successfully'
    });

  } catch (error) {
    console.error('Error unbanning IP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
