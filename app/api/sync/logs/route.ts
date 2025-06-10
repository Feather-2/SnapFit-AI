import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const userId = session.user.id;



    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    console.log(`[API/SYNC/GET] Successfully fetched ${data.length} logs for user: ${userId}`);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/SYNC/GET] An unexpected error occurred:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const userId = session.user.id;
    const logsToSync = await request.json();

    if (!Array.isArray(logsToSync) || logsToSync.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty data provided.' }, { status: 400 });
    }

    console.log(`[API/SYNC/POST] Attempting to upsert ${logsToSync.length} logs for user: ${userId}`);

    const errors = [];
    for (const log of logsToSync) {
      // 检查是补丁更新还是完整更新
      if (log.log_data_patch) {
        // 调用RPC函数处理补丁
        const { error: rpcError } = await supabase.rpc('upsert_log_patch', {
          p_user_id: userId,
          p_date: log.date,
          p_log_data_patch: log.log_data_patch,
          p_last_modified: log.last_modified,
          p_based_on_modified: log.based_on_modified || null, // 新增参数
        });
        if (rpcError) errors.push(rpcError);
      } else {
        // 处理完整的日志对象（保持旧的逻辑作为备用）
        const { error: upsertError } = await supabase
          .from('daily_logs')
          .upsert({ ...log, user_id: userId }, { onConflict: 'user_id, date' });
        if (upsertError) errors.push(upsertError);
      }
    }

    if (errors.length > 0) {
      console.error('[API/SYNC/POST] Supabase errors occurred during sync:', errors);
      // 将第一个错误信息抛出，也可以选择更复杂的错误处理
      throw errors[0];
    }

    console.log(`[API/SYNC/POST] Successfully processed ${logsToSync.length} logs for user: ${userId}`);

    return NextResponse.json({ message: 'Sync successful', count: logsToSync.length });
  } catch (error: any) {
    console.error('[API/SYNC/POST] An unexpected error occurred:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}