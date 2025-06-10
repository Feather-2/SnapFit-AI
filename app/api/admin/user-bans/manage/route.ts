import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClientIP } from '@/lib/ip-utils';

// 简单的用户封禁管理界面API
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 返回管理界面的使用说明
    return NextResponse.json({
      success: true,
      title: 'User Ban Management API',
      description: 'Comprehensive user ban management system',
      endpoints: {
        'GET /api/admin/user-bans': {
          description: 'Get list of all banned users',
          parameters: {
            page: 'Page number (default: 1)',
            limit: 'Items per page (default: 50)'
          }
        },
        'GET /api/admin/user-bans/[userId]': {
          description: 'Get specific user ban details',
          example: '/api/admin/user-bans/123e4567-e89b-12d3-a456-426614174000'
        },
        'PUT /api/admin/user-bans/[userId]': {
          description: 'Ban a user',
          body: {
            reason: 'string (required)',
            duration: 'number (minutes, 0 = permanent)',
            severity: 'low|medium|high|critical'
          }
        },
        'DELETE /api/admin/user-bans/[userId]': {
          description: 'Unban a user',
          parameters: {
            reason: 'Reason for unbanning'
          }
        },
        'POST /api/admin/user-bans/batch': {
          description: 'Batch operations on multiple users',
          body: {
            action: 'ban|unban|extend',
            userIds: 'array of user IDs',
            reason: 'string',
            duration: 'number (for ban/extend)',
            severity: 'string (for ban/extend)'
          }
        },
        'GET /api/admin/user-bans/stats': {
          description: 'Get ban statistics',
          parameters: {
            days: 'Number of days to analyze (default: 30)',
            includeHistory: 'Include full history (true/false)'
          }
        }
      },
      examples: {
        banUser: {
          method: 'PUT',
          url: '/api/admin/user-bans/[userId]',
          body: {
            reason: 'Violation of terms of service',
            duration: 1440,
            severity: 'medium'
          }
        },
        unbanUser: {
          method: 'DELETE',
          url: '/api/admin/user-bans/[userId]?reason=Appeal approved'
        },
        batchBan: {
          method: 'POST',
          url: '/api/admin/user-bans/batch',
          body: {
            action: 'ban',
            userIds: ['user1', 'user2', 'user3'],
            reason: 'Spam activity detected',
            duration: 720,
            severity: 'high'
          }
        },
        getStats: {
          method: 'GET',
          url: '/api/admin/user-bans/stats?days=7&includeHistory=false'
        }
      },
      quickActions: {
        viewActiveBans: 'SELECT * FROM active_user_bans;',
        viewBanHistory: 'SELECT * FROM user_bans ORDER BY banned_at DESC LIMIT 50;',
        countActiveBans: 'SELECT COUNT(*) FROM user_bans WHERE is_active = true;',
        getBansByUser: 'SELECT * FROM user_bans WHERE user_id = $1 ORDER BY banned_at DESC;'
      },
      databaseTables: {
        user_bans: {
          description: 'Main table for user ban records',
          editable: true,
          keyFields: ['user_id', 'is_active', 'banned_at', 'expires_at']
        },
        active_user_bans: {
          description: 'View showing only active bans with user info',
          editable: false,
          note: 'This is a VIEW - use user_bans table for modifications'
        }
      },
      directDatabaseOperations: {
        manualBan: {
          sql: `INSERT INTO user_bans (user_id, reason, severity, ban_type, created_by) 
                VALUES ($1, $2, $3, 'manual', $4);`,
          description: 'Manually insert a ban record'
        },
        manualUnban: {
          sql: `UPDATE user_bans 
                SET is_active = false, unbanned_at = NOW(), unban_reason = $2 
                WHERE user_id = $1 AND is_active = true;`,
          description: 'Manually unban a user'
        },
        extendBan: {
          sql: `UPDATE user_bans 
                SET expires_at = NOW() + INTERVAL '$2 minutes' 
                WHERE user_id = $1 AND is_active = true;`,
          description: 'Extend ban duration'
        }
      },
      tips: [
        'Use active_user_bans view for read-only operations and reporting',
        'Use user_bans table for all modifications (ban, unban, extend)',
        'Always provide a reason when banning or unbanning users',
        'Use batch operations for efficiency when dealing with multiple users',
        'Check ban statistics regularly to monitor system health',
        'Set expires_at to NULL for permanent bans',
        'Use appropriate severity levels: low, medium, high, critical'
      ]
    });

  } catch (error) {
    console.error('Error getting management info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
