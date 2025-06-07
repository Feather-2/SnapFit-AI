import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();
    const userId = session.user.id;

    console.log(`[API/SYNC/GET] Fetching logs for user: ${userId}`);

    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[API/SYNC/GET] Supabase error:', error);
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

    const supabase = createClient();
    const userId = session.user.id;
    const logsToSync = await request.json();

    if (!Array.isArray(logsToSync) || logsToSync.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty data provided.' }, { status: 400 });
    }

    console.log(`[API/SYNC/POST] Attempting to upsert ${logsToSync.length} logs for user: ${userId}`);

    // 为每条日志添加/覆盖 user_id
    const dataToUpsert = logsToSync.map(log => ({
      ...log,
      user_id: userId,
    }));

    const { data, error } = await supabase
      .from('daily_logs')
      .upsert(dataToUpsert, {
        onConflict: 'user_id, date', // 当 user_id 和 date 冲突时，执行更新
      })
      .select();

    if (error) {
      console.error('[API/SYNC/POST] Supabase upsert error:', error);
      throw error;
    }

    console.log(`[API/SYNC/POST] Successfully upserted ${data.length} logs for user: ${userId}`);

    return NextResponse.json({ message: 'Sync successful', count: data.length });
  } catch (error: any) {
    console.error('[API/SYNC/POST] An unexpected error occurred:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}