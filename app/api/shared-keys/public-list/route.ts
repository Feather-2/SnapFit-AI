import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. 获取所有活跃的共享Key
    const { data: keysData, error: keysError } = await supabaseAdmin
      .from('shared_keys')
      .select('id, name, available_models, description, tags, total_usage_count, user_id')
      .eq('is_active', true)
      .order('total_usage_count', { ascending: false });

    if (keysError) {
      console.error('Error fetching public shared keys:', keysError);
      return NextResponse.json({ error: 'Failed to fetch public shared keys' }, { status: 500 });
    }

    if (!keysData || keysData.length === 0) {
      return NextResponse.json({ keys: [] });
    }

    // 2. 获取所有相关的用户信息
    const userIds = [...new Set(keysData.map(key => key.user_id))];
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, username, avatar_url')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      // 即使获取用户信息失败，也继续，只是会显示"匿名用户"
    }

    const usersMap = new Map(usersData?.map(user => [user.id, user]));

    // 3. 组合数据
    const formattedKeys = keysData.map(key => {
      const user = usersMap.get(key.user_id);
      return {
        id: key.id,
        name: key.name,
        availableModels: key.available_models,
        description: key.description,
        tags: key.tags,
        totalUsageCount: key.total_usage_count,
        provider: {
          userId: key.user_id,
          username: user?.username || '匿名用户',
          avatarUrl: user?.avatar_url,
        }
      };
    });

    return NextResponse.json({ keys: formattedKeys });

  } catch (error) {
    console.error('Public shared keys API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}