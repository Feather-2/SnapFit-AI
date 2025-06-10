import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security-monitor';
import { getClientIP } from '@/lib/ip-utils';
import { supabaseAdmin } from '@/lib/supabase';

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
        description: 'Attempted to access user ban statistics without admin privileges'
      });

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 获取基本统计信息
    const { data: stats, error: statsError } = await supabaseAdmin
      .rpc('get_user_ban_statistics');

    if (statsError) {
      console.error('Error getting user ban statistics:', statsError);
      return NextResponse.json({ error: 'Failed to get statistics' }, { status: 500 });
    }

    // 获取最近的封禁活动
    const { data: recentBans, error: recentError } = await supabaseAdmin
      .from('user_bans')
      .select(`
        id,
        user_id,
        reason,
        severity,
        ban_type,
        banned_at,
        expires_at,
        is_active,
        created_by
      `)
      .gte('banned_at', startDate.toISOString())
      .order('banned_at', { ascending: false })
      .limit(50);

    if (recentError) {
      console.error('Error getting recent bans:', recentError);
      return NextResponse.json({ error: 'Failed to get recent bans' }, { status: 500 });
    }

    // 获取按时间分组的统计
    const { data: dailyStats, error: dailyError } = await supabaseAdmin
      .from('user_bans')
      .select('banned_at, ban_type, severity')
      .gte('banned_at', startDate.toISOString())
      .order('banned_at', { ascending: true });

    if (dailyError) {
      console.error('Error getting daily stats:', dailyError);
    }

    // 处理每日统计
    const dailyBanStats = {};
    const severityStats = { low: 0, medium: 0, high: 0, critical: 0 };
    const typeStats = { manual: 0, automatic: 0, temporary: 0 };

    if (dailyStats) {
      dailyStats.forEach(ban => {
        const date = ban.banned_at.split('T')[0];
        if (!dailyBanStats[date]) {
          dailyBanStats[date] = 0;
        }
        dailyBanStats[date]++;

        // 统计严重程度
        if (ban.severity && severityStats.hasOwnProperty(ban.severity)) {
          severityStats[ban.severity]++;
        }

        // 统计封禁类型
        if (ban.ban_type && typeStats.hasOwnProperty(ban.ban_type)) {
          typeStats[ban.ban_type]++;
        }
      });
    }

    // 获取当前活跃封禁的详细信息
    const { data: activeBans, error: activeError } = await supabaseAdmin
      .from('active_user_bans')
      .select('*')
      .order('banned_at', { ascending: false });

    if (activeError) {
      console.error('Error getting active bans:', activeError);
    }

    // 计算趋势
    const currentPeriodBans = recentBans?.length || 0;
    const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    const { data: previousBans, error: previousError } = await supabaseAdmin
      .from('user_bans')
      .select('id')
      .gte('banned_at', previousStartDate.toISOString())
      .lt('banned_at', startDate.toISOString());

    const previousPeriodBans = previousBans?.length || 0;
    const trend = previousPeriodBans > 0 
      ? Math.round(((currentPeriodBans - previousPeriodBans) / previousPeriodBans) * 100)
      : currentPeriodBans > 0 ? 100 : 0;

    const result = {
      success: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      },
      summary: {
        totalActive: stats?.total_active || 0,
        totalExpired: stats?.total_expired || 0,
        manualBans: stats?.manual_bans || 0,
        automaticBans: stats?.automatic_bans || 0,
        recentBans: currentPeriodBans,
        trend: {
          percentage: trend,
          direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable'
        }
      },
      breakdown: {
        bySeverity: severityStats,
        byType: typeStats,
        byDay: dailyBanStats
      },
      recentActivity: recentBans || [],
      activeBans: activeBans || []
    };

    // 如果请求包含历史数据
    if (includeHistory) {
      const { data: allBans, error: historyError } = await supabaseAdmin
        .from('user_bans')
        .select('*')
        .order('banned_at', { ascending: false })
        .limit(1000);

      if (!historyError && allBans) {
        result.history = allBans;
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error getting user ban statistics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
