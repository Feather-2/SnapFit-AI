import { NextResponse } from 'next/server';
import { KeyManager } from '@/lib/key-manager';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const keyManager = new KeyManager();

  try {
    // 1. 获取所有活跃的共享Key
    const { data: activeKeys, error: fetchError } = await supabaseAdmin
      .from('shared_keys')
      .select('id, base_url, api_key_encrypted, available_models')
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching active keys:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch active keys' }, { status: 500 });
    }

    if (!activeKeys || activeKeys.length === 0) {
      return NextResponse.json({ message: 'No active keys to update.' });
    }

    let updatedCount = 0;
    const errors = [];

    // 2. 遍历每一个Key，更新模型列表
    for (const key of activeKeys) {
      try {
        const apiKey = keyManager.decryptApiKeyPublic(key.api_key_encrypted);
        // 使用现有的第一个模型进行测试
        const firstModel = key.available_models && key.available_models.length > 0 ? key.available_models[0] : 'gpt-4o';
        const { availableModels } = await keyManager.testApiKey(key.base_url, apiKey, firstModel);

        // 3. 将新的模型列表更新回数据库
        //    (假设您的 'shared_keys' 表有一个 'available_models' 字段)
        if (availableModels && availableModels.length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('shared_keys')
            .update({ available_models: availableModels, updated_at: new Date().toISOString() })
            .eq('id', key.id);

          if (updateError) {
            console.error(`Error updating models for key ${key.id}:`, updateError);
            errors.push(`Key ${key.id}: ${updateError.message}`);
          } else {
            updatedCount++;
          }
        }
      } catch (testError) {
        const errorMessage = testError instanceof Error ? testError.message : 'Unknown test error';
        console.error(`Error testing key ${key.id}:`, testError);
        errors.push(`Key ${key.id}: Failed to test - ${errorMessage}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        message: `Finished with ${errors.length} errors.`,
        updatedCount,
        errors
      }, { status: 207 }); // Multi-Status
    }

    return NextResponse.json({ message: `Successfully updated ${updatedCount} keys.` });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}