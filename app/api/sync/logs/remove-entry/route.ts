import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const userId = session.user.id;
    const { date, entryType, logId, lastModified } = await request.json();

    if (!date || !entryType || !logId) {
      return NextResponse.json({
        error: 'Missing required fields: date, entryType, logId'
      }, { status: 400 });
    }

    if (!['food', 'exercise'].includes(entryType)) {
      return NextResponse.json({
        error: 'Invalid entryType. Must be "food" or "exercise"'
      }, { status: 400 });
    }

    console.log(`[API/SYNC/REMOVE-ENTRY] Removing ${entryType} entry ${logId} for user: ${userId}, date: ${date}`);

    // 🔍 首先检查当前日志数据
    const { data: currentLog, error: fetchError } = await supabase
      .from('daily_logs')
      .select('log_data')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (fetchError) {
      console.error('[API/SYNC/REMOVE-ENTRY] Failed to fetch current log:', fetchError);
      return NextResponse.json({
        error: 'Log not found for the specified date'
      }, { status: 404 });
    }

    console.log(`[API/SYNC/REMOVE-ENTRY] Current log data:`, JSON.stringify(currentLog.log_data, null, 2));

    // 🗑️ 调用数据库函数安全删除条目
    const { data, error } = await supabase.rpc('remove_log_entry', {
      p_user_id: userId,
      p_date: date,
      p_entry_type: entryType,
      p_log_id: logId
    });

    if (error) {
      console.error('[API/SYNC/REMOVE-ENTRY] Database RPC error:', error);
      throw error;
    }

    console.log(`[API/SYNC/REMOVE-ENTRY] RPC function result:`, data);

    const result = data?.[0];
    if (!result?.success) {
      console.error(`[API/SYNC/REMOVE-ENTRY] Delete failed. Result:`, result);
      return NextResponse.json({
        error: 'Failed to remove entry or entry not found',
        details: result
      }, { status: 404 });
    }

    console.log(`[API/SYNC/REMOVE-ENTRY] Successfully removed entry. Remaining entries: ${result.entries_remaining}`);

    return NextResponse.json({
      message: 'Entry removed successfully',
      entriesRemaining: result.entries_remaining,
      entryType,
      logId
    });

  } catch (error: any) {
    console.error('[API/SYNC/REMOVE-ENTRY] An unexpected error occurred:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
