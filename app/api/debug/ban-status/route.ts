import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ipBanManager } from '@/lib/ip-ban-manager';
import { userBanManager } from '@/lib/user-ban-manager';
import { getClientIP } from '@/lib/ip-utils';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const ip = getClientIP(request);
    const userId = session?.user?.id;

    // 检查IP封禁状态
    const isIPBanned = await ipBanManager.isIPBanned(ip);
    
    // 检查用户封禁状态
    const isUserBanned = userId ? await userBanManager.isUserBanned(userId) : false;

    // 获取最近的安全事件
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const { data: recentEvents, error: eventsError } = await supabaseAdmin
      .from('security_events')
      .select('*')
      .or(`ip_address.eq.${ip}${userId ? `,user_id.eq.${userId}` : ''}`)
      .gte('created_at', thirtyMinutesAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    // 统计用户的速率限制违规事件
    let userRateLimitEvents = 0;
    let ipRateLimitEvents = 0;
    
    if (recentEvents) {
      userRateLimitEvents = recentEvents.filter(e => 
        e.event_type === 'rate_limit_exceeded' && e.user_id === userId
      ).length;
      
      ipRateLimitEvents = recentEvents.filter(e => 
        e.event_type === 'rate_limit_exceeded' && e.ip_address === ip
      ).length;
    }

    // 获取封禁规则
    const ipBanRules = {
      rate_limit_exceeded: { threshold: 5, timeWindow: 10, banDuration: 30 }
    };
    
    const userBanRules = {
      rate_limit_exceeded: { threshold: 10, timeWindow: 30, banDuration: 60 }
    };

    // 检查是否应该触发封禁
    const shouldIPBan = ipRateLimitEvents >= ipBanRules.rate_limit_exceeded.threshold;
    const shouldUserBan = userRateLimitEvents >= userBanRules.rate_limit_exceeded.threshold;

    // 获取IP封禁详情
    let ipBanDetails = null;
    if (isIPBanned) {
      const { data: ipBans } = await supabaseAdmin
        .from('ip_bans')
        .select('*')
        .eq('ip_address', ip)
        .eq('is_active', true)
        .single();
      ipBanDetails = ipBans;
    }

    // 获取用户封禁详情
    let userBanDetails = null;
    if (isUserBanned && userId) {
      const { data: userBans } = await supabaseAdmin
        .from('user_bans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
      userBanDetails = userBans;
    }

    // 手动触发封禁检查
    let autobanResults = {
      ipCheckTriggered: false,
      userCheckTriggered: false,
      ipBannedAfterCheck: false,
      userBannedAfterCheck: false
    };

    // 触发IP自动封禁检查
    try {
      await ipBanManager.checkAndAutoBan(ip);
      autobanResults.ipCheckTriggered = true;
      autobanResults.ipBannedAfterCheck = await ipBanManager.isIPBanned(ip);
    } catch (error) {
      console.error('Error in IP autoban check:', error);
    }

    // 触发用户自动封禁检查
    if (userId) {
      try {
        await userBanManager.checkAndAutoBan(userId);
        autobanResults.userCheckTriggered = true;
        autobanResults.userBannedAfterCheck = await userBanManager.isUserBanned(userId);
      } catch (error) {
        console.error('Error in user autoban check:', error);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: {
        isAuthenticated: !!session,
        userId: userId || null
      },
      ip: {
        address: ip,
        isBanned: isIPBanned,
        banDetails: ipBanDetails
      },
      user: {
        id: userId || null,
        isBanned: isUserBanned,
        banDetails: userBanDetails
      },
      recentActivity: {
        totalEvents: recentEvents?.length || 0,
        userRateLimitEvents,
        ipRateLimitEvents,
        timeWindow: '30 minutes'
      },
      banRules: {
        ip: ipBanRules,
        user: userBanRules
      },
      shouldTriggerBan: {
        ip: shouldIPBan,
        user: shouldUserBan
      },
      autobanResults,
      recentEvents: recentEvents?.slice(0, 10) || []
    });

  } catch (error) {
    console.error('Ban status check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, targetUserId } = await request.json();
    const ip = getClientIP(request);
    const userId = targetUserId || session.user.id;

    let result = {};

    switch (action) {
      case 'trigger_user_autoban':
        await userBanManager.checkAndAutoBan(userId);
        result = {
          action: 'trigger_user_autoban',
          userId,
          isBannedAfter: await userBanManager.isUserBanned(userId)
        };
        break;

      case 'trigger_ip_autoban':
        await ipBanManager.checkAndAutoBan(ip);
        result = {
          action: 'trigger_ip_autoban',
          ip,
          isBannedAfter: await ipBanManager.isIPBanned(ip)
        };
        break;

      case 'manual_user_ban':
        const banResult = await userBanManager.banUser(
          userId,
          'Manual test ban',
          60, // 1 hour
          'medium'
        );
        result = {
          action: 'manual_user_ban',
          userId,
          success: banResult.success,
          error: banResult.error
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ban action error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
