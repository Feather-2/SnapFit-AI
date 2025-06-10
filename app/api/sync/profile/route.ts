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

    console.log(`[API/SYNC/PROFILE/GET] Fetching profile for user: ${userId}`);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[API/SYNC/PROFILE/GET] Supabase error:', error);
      throw error;
    }

    // 如果没有找到档案，返回空对象
    if (!data) {
      console.log(`[API/SYNC/PROFILE/GET] No profile found for user: ${userId}`);
      return NextResponse.json({});
    }

    // 转换为前端期望的格式
    const profile = {
      weight: data.weight,
      height: data.height,
      age: data.age,
      gender: data.gender,
      activityLevel: data.activity_level,
      goal: data.goal,
      targetWeight: data.target_weight,
      targetCalories: data.target_calories,
      notes: data.notes,
      professionalMode: data.professional_mode,
      medicalHistory: data.medical_history,
      lifestyle: data.lifestyle,
      healthAwareness: data.health_awareness,
      // 添加一些默认值，如果数据库中没有这些字段
      bmrCalculationBasis: 'totalWeight', // 默认值
      bmrFormula: 'mifflin-st-jeor', // 默认值
      sharedKey: { selectedKeyIds: [] }, // 默认值
      lastUpdated: data.updated_at
    };

    console.log(`[API/SYNC/PROFILE/GET] Successfully fetched profile for user: ${userId}`);
    return NextResponse.json(profile);

  } catch (error: any) {
    console.error('[API/SYNC/PROFILE/GET] An unexpected error occurred:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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
    const profileData = await request.json();

    if (!profileData || typeof profileData !== 'object') {
      return NextResponse.json({ error: 'Invalid profile data provided.' }, { status: 400 });
    }

    console.log(`[API/SYNC/PROFILE/POST] Attempting to sync profile for user: ${userId}`);

    // 转换为数据库格式
    const dbProfile = {
      user_id: userId,
      weight: profileData.weight,
      height: profileData.height,
      age: profileData.age,
      gender: profileData.gender,
      activity_level: profileData.activityLevel,
      goal: profileData.goal,
      target_weight: profileData.targetWeight,
      target_calories: profileData.targetCalories,
      notes: profileData.notes,
      professional_mode: profileData.professionalMode,
      medical_history: profileData.medicalHistory,
      lifestyle: profileData.lifestyle,
      health_awareness: profileData.healthAwareness,
      updated_at: new Date().toISOString()
    };

    // 使用upsert来插入或更新档案
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(dbProfile, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('[API/SYNC/PROFILE/POST] Supabase error:', error);
      throw error;
    }

    console.log(`[API/SYNC/PROFILE/POST] Successfully synced profile for user: ${userId}`);
    return NextResponse.json({
      message: 'Profile sync successful',
      profile: data,
      lastUpdated: data.updated_at
    });

  } catch (error: any) {
    console.error('[API/SYNC/PROFILE/POST] An unexpected error occurred:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
