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
    return true;
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

// POST /api/admin/user-bans/batch - 批量操作用户封禁
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
        description: 'Attempted batch user ban operation without admin privileges'
      });

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // 验证输入
    const validator = new InputValidator();
    const validationRules: ValidationRules = {
      action: { 
        required: true, 
        type: 'string', 
        allowedValues: ['ban', 'unban', 'extend', 'modify'] 
      },
      userIds: { 
        required: true, 
        type: 'array',
        minLength: 1,
        maxLength: 100 // 限制批量操作的数量
      },
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

    const { 
      action, 
      userIds, 
      reason, 
      duration = 0, 
      severity = 'medium' 
    } = body;

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // 批量处理每个用户
    for (const userId of userIds) {
      try {
        let result;
        
        switch (action) {
          case 'ban':
            // 检查用户是否已经被封禁
            const isAlreadyBanned = await userBanManager.isUserBanned(userId);
            if (isAlreadyBanned) {
              result = {
                userId,
                success: false,
                error: 'User is already banned'
              };
            } else {
              const banResult = await userBanManager.banUser(
                userId,
                reason,
                duration,
                severity,
                session.user.id
              );
              result = {
                userId,
                success: banResult.success,
                error: banResult.error
              };
            }
            break;

          case 'unban':
            const isBanned = await userBanManager.isUserBanned(userId);
            if (!isBanned) {
              result = {
                userId,
                success: false,
                error: 'User is not banned'
              };
            } else {
              const unbanResult = await userBanManager.unbanUser(userId, reason);
              result = {
                userId,
                success: unbanResult.success,
                error: unbanResult.error
              };
            }
            break;

          case 'extend':
            // 延长现有封禁时间
            const currentBan = await userBanManager.getBanDetails(userId);
            if (!currentBan.success || !currentBan.data) {
              result = {
                userId,
                success: false,
                error: 'User is not currently banned'
              };
            } else {
              // 先解封，再重新封禁（延长时间）
              await userBanManager.unbanUser(userId, 'Extending ban duration');
              const extendResult = await userBanManager.banUser(
                userId,
                `Extended ban: ${reason}`,
                duration,
                severity,
                session.user.id
              );
              result = {
                userId,
                success: extendResult.success,
                error: extendResult.error
              };
            }
            break;

          default:
            result = {
              userId,
              success: false,
              error: 'Invalid action'
            };
        }

        results.push(result);
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }

      } catch (error) {
        results.push({
          userId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    // 记录批量操作
    await logSecurityEvent({
      userId: session.user.id,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      eventType: 'system_maintenance',
      severity: 'medium',
      description: `Batch user ${action} operation completed`,
      metadata: {
        action,
        totalUsers: userIds.length,
        successCount,
        errorCount,
        reason
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        action,
        totalUsers: userIds.length,
        successCount,
        errorCount,
        successRate: Math.round((successCount / userIds.length) * 100)
      },
      results
    });

  } catch (error) {
    console.error('Error in batch user ban operation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/admin/user-bans/batch - 获取批量操作的模板和说明
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查管理员权限
    const isAdmin = await checkAdminPermission(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      batchOperations: {
        ban: {
          description: 'Ban multiple users',
          requiredFields: ['userIds', 'reason'],
          optionalFields: ['duration', 'severity'],
          example: {
            action: 'ban',
            userIds: ['user1', 'user2'],
            reason: 'Violation of terms of service',
            duration: 1440, // 24 hours in minutes
            severity: 'medium'
          }
        },
        unban: {
          description: 'Unban multiple users',
          requiredFields: ['userIds', 'reason'],
          example: {
            action: 'unban',
            userIds: ['user1', 'user2'],
            reason: 'Appeal approved'
          }
        },
        extend: {
          description: 'Extend ban duration for multiple users',
          requiredFields: ['userIds', 'reason', 'duration'],
          optionalFields: ['severity'],
          example: {
            action: 'extend',
            userIds: ['user1', 'user2'],
            reason: 'Additional violations found',
            duration: 2880, // 48 hours in minutes
            severity: 'high'
          }
        }
      },
      limits: {
        maxUsersPerBatch: 100,
        allowedActions: ['ban', 'unban', 'extend'],
        allowedSeverities: ['low', 'medium', 'high', 'critical']
      }
    });

  } catch (error) {
    console.error('Error getting batch operation info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
