import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import { syncRateLimiter } from '@/lib/sync-rate-limiter';
import { logSecurityEvent } from '@/lib/security-monitor';
import { getClientIP } from '@/lib/ip-utils';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const userId = session.user.id;

    console.log(`[API/SYNC/MEMORIES/GET] Fetching AI memories for user: ${userId}`);

    const { data, error } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[API/SYNC/MEMORIES/GET] Supabase error:', error);
      throw error;
    }

    // 转换为前端期望的格式
    const memoriesMap: Record<string, any> = {};
    if (data) {
      data.forEach(memory => {
        memoriesMap[memory.expert_id] = {
          expertId: memory.expert_id,
          content: memory.content,
          lastUpdated: memory.last_updated,
          version: memory.version
        };
      });
    }

    console.log(`[API/SYNC/MEMORIES/GET] Successfully fetched ${data?.length || 0} memories for user: ${userId}`);
    return NextResponse.json(memoriesMap);

  } catch (error: any) {
    console.error('[API/SYNC/MEMORIES/GET] An unexpected error occurred:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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

    // 🔒 检查同步速率限制
    const limitCheck = syncRateLimiter.checkSyncLimit(userId, ip);
    if (!limitCheck.allowed) {
      await logSecurityEvent({
        userId,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || 'unknown',
        eventType: 'rate_limit_exceeded',
        severity: 'medium',
        description: `Memories sync rate limit exceeded: ${limitCheck.reason}`,
        metadata: {
          api: 'sync/memories',
          retryAfter: limitCheck.retryAfter
        }
      });

      return NextResponse.json(
        {
          error: limitCheck.reason,
          code: 'SYNC_RATE_LIMIT_EXCEEDED',
          retryAfter: limitCheck.retryAfter
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

    const supabase = await createClient();
    const memoriesToSync = await request.json();

    if (!memoriesToSync || typeof memoriesToSync !== 'object') {
      return NextResponse.json({ error: 'Invalid memories data provided.' }, { status: 400 });
    }

    console.log(`[API/SYNC/MEMORIES/POST] Attempting to sync ${Object.keys(memoriesToSync).length} memories for user: ${userId}`);

    // 使用RPC函数批量更新
    const { data, error } = await supabase.rpc('upsert_ai_memories', {
      p_user_id: userId,
      p_memories: memoriesToSync
    });

    if (error) {
      console.error('[API/SYNC/MEMORIES/POST] RPC error:', error);
      throw error;
    }

    // 检查是否有失败的记录
    const failures = data?.filter((result: any) => !result.success) || [];
    if (failures.length > 0) {
      console.warn('[API/SYNC/MEMORIES/POST] Some memories failed to sync:', failures);
      return NextResponse.json({
        message: 'Partial sync completed',
        failures,
        successCount: data.length - failures.length
      }, { status: 207 }); // 207 Multi-Status
    }

    console.log(`[API/SYNC/MEMORIES/POST] Successfully synced ${data?.length || 0} memories for user: ${userId}`);
    return NextResponse.json({ message: 'Memories sync successful', count: data?.length || 0 });

  } catch (error: any) {
    console.error('[API/SYNC/MEMORIES/POST] An unexpected error occurred:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
