import { NextResponse } from 'next/server';
import { KeyManager } from '@/lib/key-manager';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const keyManager = new KeyManager();

  try {
    // 1. 获取所有活跃的共享Key（限制数量以避免超时）
    const MAX_KEYS_PER_BATCH = 10;
    const { data: activeKeys, error: fetchError } = await supabaseAdmin
      .from('shared_keys')
      .select('id, base_url, api_key_encrypted, available_models, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: true }) // 优先更新最久未更新的
      .limit(MAX_KEYS_PER_BATCH);

    if (fetchError) {
      console.error('Error fetching active keys:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch active keys' }, { status: 500 });
    }

    if (!activeKeys || activeKeys.length === 0) {
      return NextResponse.json({ message: 'No active keys to update.' });
    }

    let updatedCount = 0;
    const errors = [];
    const results = [];

    // 2. 遍历每一个Key，更新模型列表
    for (const key of activeKeys) {
      try {
        const apiKey = keyManager.decryptApiKeyPublic(key.api_key_encrypted);
        // 使用现有的第一个模型进行测试
        const firstModel = key.available_models && key.available_models.length > 0 ? key.available_models[0] : 'gpt-4o';
        const { availableModels } = await keyManager.testApiKey(key.base_url, apiKey, firstModel);

        // 3. 将新的模型列表更新回数据库
        if (availableModels && availableModels.length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('shared_keys')
            .update({
              available_models: availableModels,
              updated_at: new Date().toISOString(),
              // 清除更新标记（如果存在）
              metadata: key.metadata ?
                Object.fromEntries(Object.entries(key.metadata).filter(([k]) => k !== 'needs_model_update')) :
                null
            })
            .eq('id', key.id);

          if (updateError) {
            console.error(`Error updating models for key ${key.id}:`, updateError);
            errors.push(`Key ${key.id}: ${updateError.message}`);
          } else {
            updatedCount++;
            results.push({
              keyId: key.id,
              baseUrl: key.base_url,
              modelCount: availableModels.length,
              status: 'updated'
            });
          }
        } else {
          results.push({
            keyId: key.id,
            baseUrl: key.base_url,
            status: 'no_models_found'
          });
        }
      } catch (testError) {
        const errorMessage = testError instanceof Error ? testError.message : 'Unknown test error';
        console.error(`Error testing key ${key.id}:`, testError);
        errors.push(`Key ${key.id}: Failed to test - ${errorMessage}`);
        results.push({
          keyId: key.id,
          baseUrl: key.base_url,
          status: 'error',
          error: errorMessage
        });
      }
    }

    // 检查是否还有更多密钥需要更新
    const { count: remainingCount } = await supabaseAdmin
      .from('shared_keys')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('id', 'in', `(${activeKeys.map(k => k.id).join(',')})`);

    const response = {
      message: `Successfully updated ${updatedCount} of ${activeKeys.length} keys.`,
      updatedCount,
      processedKeys: activeKeys.length,
      remainingKeys: remainingCount || 0,
      results,
      batchSize: MAX_KEYS_PER_BATCH,
      timestamp: new Date().toISOString()
    };

    if (errors.length > 0) {
      response.errors = errors;
      return NextResponse.json(response, { status: 207 }); // Multi-Status
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}