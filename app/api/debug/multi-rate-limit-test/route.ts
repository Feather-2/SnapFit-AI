import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { syncRateLimiter } from '@/lib/sync-rate-limiter';
import { getClientIP } from '@/lib/ip-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const ip = getClientIP(request);

    // 获取用户和IP的统计信息
    const userStats = syncRateLimiter.getUserSyncStats(userId);
    const ipStats = syncRateLimiter.getIPSyncStats(ip);

    return NextResponse.json({
      success: true,
      userId,
      ip,
      userStats,
      ipStats,
      rateLimits: {
        user: {
          perSecond: { limit: 3, window: '1 second' },
          perMinute: { limit: 30, window: '1 minute' },
          perHour: { limit: 300, window: '1 hour' }
        },
        ip: {
          perMinute: { limit: 100, window: '1 minute' },
          perHour: { limit: 1000, window: '1 hour' }
        }
      },
      testInstructions: {
        'POST /burst': 'Test burst limit (3 requests in 1 second)',
        'POST /sustained': 'Test sustained limit (30 requests in 1 minute)',
        'POST /heavy': 'Test heavy usage (300 requests in 1 hour)',
        'POST /reset': 'Reset all limits for current user'
      }
    });

  } catch (error) {
    console.error('Multi rate limit test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const ip = getClientIP(request);
    const { testType = 'burst' } = await request.json();

    let result: any = {
      testType,
      userId,
      ip,
      timestamp: new Date().toISOString()
    };

    switch (testType) {
      case 'burst':
        // 测试每秒限制：快速发送4次请求（应该第4次被拒绝）
        const burstResults = [];
        for (let i = 0; i < 4; i++) {
          const limitCheck = syncRateLimiter.checkSyncLimit(userId, ip);
          burstResults.push({
            attempt: i + 1,
            allowed: limitCheck.allowed,
            reason: limitCheck.reason,
            limitType: limitCheck.limitType,
            retryAfter: limitCheck.retryAfter
          });
          
          // 很短的延迟，确保在同一秒内
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        result.burstResults = burstResults;
        result.summary = {
          totalAttempts: burstResults.length,
          allowed: burstResults.filter(r => r.allowed).length,
          blocked: burstResults.filter(r => !r.allowed).length,
          firstBlockedAt: burstResults.findIndex(r => !r.allowed) + 1 || null
        };
        break;

      case 'sustained':
        // 测试每分钟限制：发送35次请求（应该在第31次被拒绝）
        const sustainedResults = [];
        let allowedCount = 0;
        let blockedCount = 0;
        
        for (let i = 0; i < 35; i++) {
          const limitCheck = syncRateLimiter.checkSyncLimit(userId, ip);
          
          if (limitCheck.allowed) {
            allowedCount++;
          } else {
            blockedCount++;
            // 记录第一次被阻止的详情
            if (blockedCount === 1) {
              sustainedResults.push({
                attempt: i + 1,
                allowed: limitCheck.allowed,
                reason: limitCheck.reason,
                limitType: limitCheck.limitType,
                retryAfter: limitCheck.retryAfter
              });
            }
          }
          
          // 每次请求间隔50ms，确保在同一分钟内
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        result.sustainedResults = sustainedResults;
        result.summary = {
          totalAttempts: 35,
          allowed: allowedCount,
          blocked: blockedCount,
          limitTriggeredAt: allowedCount + 1
        };
        break;

      case 'heavy':
        // 模拟重度使用：检查当前小时限制状态
        const heavyCheck = syncRateLimiter.checkSyncLimit(userId, ip);
        const userStats = syncRateLimiter.getUserSyncStats(userId);
        
        result.heavyUsageCheck = {
          currentlyAllowed: heavyCheck.allowed,
          reason: heavyCheck.reason,
          limitType: heavyCheck.limitType,
          hourlyUsage: userStats.last1hCount,
          hourlyLimit: 300,
          remainingThisHour: Math.max(0, 300 - userStats.last1hCount),
          percentageUsed: Math.round((userStats.last1hCount / 300) * 100)
        };
        break;

      case 'reset':
        // 重置用户的所有限制
        syncRateLimiter.resetUserLimits(userId);
        syncRateLimiter.resetIPLimits(ip);
        
        result.resetResult = {
          userLimitsReset: true,
          ipLimitsReset: true,
          message: 'All rate limits have been reset for this user and IP'
        };
        break;

      case 'status':
        // 获取详细状态
        const userStatsDetailed = syncRateLimiter.getUserSyncStats(userId);
        const ipStatsDetailed = syncRateLimiter.getIPSyncStats(ip);
        
        result.detailedStatus = {
          user: userStatsDetailed,
          ip: ipStatsDetailed,
          nextAllowedSync: userStatsDetailed.nextAllowedSync ? 
            new Date(userStatsDetailed.nextAllowedSync).toISOString() : null
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }

    // 获取测试后的统计信息
    result.statsAfterTest = {
      user: syncRateLimiter.getUserSyncStats(userId),
      ip: syncRateLimiter.getIPSyncStats(ip)
    };

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Multi rate limit test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
