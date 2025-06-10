import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { userBanManager } from '@/lib/user-ban-manager';
import { logSecurityEvent } from '@/lib/security-monitor';
import { getClientIP } from '@/lib/ip-utils';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const ip = getClientIP(request);
    const { action = 'simulate_violations' } = await request.json();

    let result: any = {
      userId,
      ip,
      action,
      timestamp: new Date().toISOString()
    };

    switch (action) {
      case 'simulate_violations':
        // 模拟3次速率限制违规事件（触发用户封禁的阈值）
        const violations = [];
        for (let i = 0; i < 3; i++) {
          await logSecurityEvent({
            userId,
            ipAddress: ip,
            userAgent: request.headers.get('user-agent') || 'test-agent',
            eventType: 'rate_limit_exceeded',
            severity: 'medium',
            description: `Simulated rate limit violation ${i + 1}/3`,
            metadata: {
              simulation: true,
              violationNumber: i + 1,
              testReason: 'Testing user ban functionality'
            }
          });
          violations.push(`Violation ${i + 1} logged`);
        }

        // 等待一下让事件被处理
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 检查是否应该触发封禁
        const shouldBan = await userBanManager.checkAndAutoBan(userId);
        
        // 检查用户是否被封禁
        const isBanned = await userBanManager.isUserBanned(userId);
        
        result = {
          ...result,
          violations,
          shouldBan,
          isBannedAfter: isBanned,
          message: isBanned ? 'User successfully banned after violations' : 'User not banned - check thresholds'
        };
        break;

      case 'check_status':
        const banStatus = await userBanManager.isUserBanned(userId);
        const banDetails = banStatus ? await userBanManager.getBanDetails(userId) : null;
        
        result = {
          ...result,
          isBanned: banStatus,
          banDetails: banDetails?.data || null
        };
        break;

      case 'manual_ban':
        const manualBanResult = await userBanManager.banUser(
          userId,
          'Manual test ban for debugging',
          30, // 30分钟
          'medium'
        );
        
        result = {
          ...result,
          banResult: manualBanResult,
          isBannedAfter: manualBanResult.success ? await userBanManager.isUserBanned(userId) : false
        };
        break;

      case 'unban':
        const unbanResult = await userBanManager.unbanUser(userId, 'Test unban');
        
        result = {
          ...result,
          unbanResult,
          isBannedAfter: await userBanManager.isUserBanned(userId)
        };
        break;

      case 'check_rules':
        // 检查当前的封禁规则和用户的违规情况
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        
        // 这里我们需要直接查询数据库来检查用户的违规记录
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { data: userEvents, error } = await supabaseAdmin
          .from('security_events')
          .select('*')
          .eq('user_id', userId)
          .eq('event_type', 'rate_limit_exceeded')
          .gte('created_at', fifteenMinutesAgo.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        result = {
          ...result,
          currentRules: {
            rate_limit_exceeded: {
              threshold: 3,
              timeWindow: 15,
              banDuration: 60
            }
          },
          userViolations: {
            count: userEvents?.length || 0,
            events: userEvents || [],
            timeWindow: '15 minutes'
          },
          shouldTriggerBan: (userEvents?.length || 0) >= 3,
          isBanned: await userBanManager.isUserBanned(userId)
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('User ban test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // 获取用户的封禁状态和相关信息
    const isBanned = await userBanManager.isUserBanned(userId);
    const banDetails = isBanned ? await userBanManager.getBanDetails(userId) : null;
    
    // 获取最近的安全事件
    const { supabaseAdmin } = await import('@/lib/supabase');
    const { data: recentEvents, error } = await supabaseAdmin
      .from('security_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // 最近1小时
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    // 统计违规类型
    const violationStats = (recentEvents || []).reduce((stats, event) => {
      const type = event.event_type;
      stats[type] = (stats[type] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      userId,
      banStatus: {
        isBanned,
        details: banDetails?.data || null
      },
      recentActivity: {
        totalEvents: recentEvents?.length || 0,
        violationStats,
        events: recentEvents || []
      },
      testActions: [
        'simulate_violations - 模拟3次违规触发封禁',
        'check_status - 检查当前封禁状态',
        'manual_ban - 手动封禁用户',
        'unban - 解封用户',
        'check_rules - 检查封禁规则和违规情况'
      ],
      currentRules: {
        rate_limit_exceeded: {
          threshold: 3,
          timeWindow: 15,
          banDuration: 60,
          description: '15分钟内3次速率限制违规将被封禁1小时'
        }
      }
    });

  } catch (error) {
    console.error('User ban status check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
