import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ipBanManager } from '@/lib/ip-ban-manager';
import { userBanManager } from '@/lib/user-ban-manager';
import { logSecurityEvent } from '@/lib/security-monitor';
import { getClientIP } from '@/lib/ip-utils';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const ip = getClientIP(request);
    
    console.log(`[FULL-BAN-TEST] Starting comprehensive ban test for user ${userId} from IP ${ip}`);

    // 第一步：检查当前状态
    const initialState = {
      user: {
        id: userId,
        isBanned: await userBanManager.isUserBanned(userId)
      },
      ip: {
        address: ip,
        isBanned: await ipBanManager.isIPBanned(ip)
      }
    };

    console.log(`[FULL-BAN-TEST] Initial state:`, initialState);

    // 第二步：清理之前的测试数据（可选）
    await supabaseAdmin
      .from('security_events')
      .delete()
      .eq('user_id', userId)
      .like('description', '%test%');

    // 第三步：模拟用户级别的速率限制违规
    console.log(`[FULL-BAN-TEST] Creating user-level security events...`);
    
    const userEvents = [];
    for (let i = 0; i < 4; i++) { // 创建4个事件，超过阈值3
      const eventResult = await logSecurityEvent({
        userId,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || 'test-agent',
        eventType: 'rate_limit_exceeded',
        severity: 'medium',
        description: `Test user rate limit violation ${i + 1}/4`,
        metadata: {
          test: true,
          violationNumber: i + 1,
          testType: 'user_ban_test',
          timestamp: new Date().toISOString()
        }
      });
      userEvents.push(`User event ${i + 1} created`);
      
      // 小延迟确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[FULL-BAN-TEST] Created ${userEvents.length} user events`);

    // 第四步：等待事件被处理
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 第五步：手动触发用户封禁检查
    console.log(`[FULL-BAN-TEST] Manually triggering user ban check...`);
    await userBanManager.checkAndAutoBan(userId);

    // 第六步：检查用户是否被封禁
    const userBannedAfterCheck = await userBanManager.isUserBanned(userId);
    console.log(`[FULL-BAN-TEST] User banned after check: ${userBannedAfterCheck}`);

    // 第七步：如果没有被封禁，检查原因
    let debugInfo = {};
    if (!userBannedAfterCheck) {
      console.log(`[FULL-BAN-TEST] User not banned, investigating...`);
      
      // 检查数据库中的事件
      const { data: dbEvents, error } = await supabaseAdmin
        .from('security_events')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', 'rate_limit_exceeded')
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[FULL-BAN-TEST] Error querying events:`, error);
      } else {
        console.log(`[FULL-BAN-TEST] Found ${dbEvents?.length || 0} matching events in DB`);
      }

      debugInfo = {
        eventsInDB: dbEvents?.length || 0,
        events: dbEvents || [],
        threshold: 3,
        timeWindow: '15 minutes',
        shouldTriggerBan: (dbEvents?.length || 0) >= 3
      };

      // 如果有足够的事件但没有被封禁，手动封禁进行测试
      if ((dbEvents?.length || 0) >= 3) {
        console.log(`[FULL-BAN-TEST] Sufficient events found, manually banning user...`);
        const manualBanResult = await userBanManager.banUser(
          userId,
          'Manual ban after auto-ban failed',
          30, // 30分钟
          'medium'
        );
        debugInfo = { ...debugInfo, manualBanResult };
      }
    }

    // 第八步：获取最终状态
    const finalState = {
      user: {
        id: userId,
        isBanned: await userBanManager.isUserBanned(userId),
        banDetails: await userBanManager.getBanDetails(userId)
      },
      ip: {
        address: ip,
        isBanned: await ipBanManager.isIPBanned(ip)
      }
    };

    console.log(`[FULL-BAN-TEST] Final state:`, finalState);

    // 第九步：获取用户封禁表的内容
    const { data: userBans, error: banError } = await supabaseAdmin
      .from('user_bans')
      .select('*')
      .eq('user_id', userId)
      .order('banned_at', { ascending: false });

    if (banError) {
      console.error(`[FULL-BAN-TEST] Error querying user bans:`, banError);
    }

    return NextResponse.json({
      success: true,
      testResults: {
        initialState,
        userEvents,
        finalState,
        debugInfo,
        userBansInDB: userBans || [],
        testSummary: {
          userWasBanned: finalState.user.isBanned,
          banMethod: finalState.user.isBanned ? 
            (userBannedAfterCheck ? 'automatic' : 'manual_fallback') : 'none',
          eventsCreated: userEvents.length,
          testCompleted: true
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[FULL-BAN-TEST] Error:', error);
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
    const ip = getClientIP(request);

    // 获取当前状态
    const currentState = {
      user: {
        id: userId,
        isBanned: await userBanManager.isUserBanned(userId),
        banDetails: await userBanManager.getBanDetails(userId)
      },
      ip: {
        address: ip,
        isBanned: await ipBanManager.isIPBanned(ip)
      }
    };

    // 获取最近的安全事件
    const { data: recentEvents, error } = await supabaseAdmin
      .from('security_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    // 获取用户封禁记录
    const { data: userBans } = await supabaseAdmin
      .from('user_bans')
      .select('*')
      .eq('user_id', userId)
      .order('banned_at', { ascending: false });

    return NextResponse.json({
      success: true,
      currentState,
      recentEvents: recentEvents || [],
      userBans: userBans || [],
      banRules: {
        user: {
          rate_limit_exceeded: {
            threshold: 3,
            timeWindow: 15,
            banDuration: 60
          }
        },
        ip: {
          rate_limit_exceeded: {
            threshold: 5,
            timeWindow: 10,
            banDuration: 30
          }
        }
      },
      instructions: {
        test: 'POST to this endpoint to run a comprehensive ban test',
        description: 'This will create security events and test the ban system'
      }
    });

  } catch (error) {
    console.error('Full ban test status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
