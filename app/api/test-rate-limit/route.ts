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

    // 获取用户的同步统计信息
    const stats = syncRateLimiter.getUserSyncStats(userId);

    return NextResponse.json({
      userId,
      ip,
      stats,
      limits: {
        perUserPerSecond: 3,
        perUserPerMinute: 30,
        perUserPerHour: 300,
        perIPPerMinute: 100,
        perIPPerHour: 1000
      },
      message: 'Rate limit test endpoint - use POST to test sync limits'
    });

  } catch (error) {
    console.error('Rate limit test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    // 测试同步速率限制
    const limitCheck = syncRateLimiter.checkSyncLimit(userId, ip);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: limitCheck.reason,
          code: 'SYNC_RATE_LIMIT_EXCEEDED',
          retryAfter: limitCheck.retryAfter,
          stats: syncRateLimiter.getUserSyncStats(userId)
        },
        {
          status: 429,
          headers: {
            'Retry-After': limitCheck.retryAfter?.toString() || '10',
            'X-RateLimit-Type': 'sync'
          }
        }
      );
    }

    // 模拟成功的同步操作
    const stats = syncRateLimiter.getUserSyncStats(userId);

    return NextResponse.json({
      success: true,
      message: 'Sync test successful',
      userId,
      ip,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Rate limit test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
