import { NextResponse } from 'next/server';
import { KeyManager } from '@/lib/key-manager';
import { supabaseAdmin } from '@/lib/supabase';

// 限制更新频率，避免过于频繁的调用
const UPDATE_COOLDOWN_MINUTES = 30;

export async function POST() {
  const keyManager = new KeyManager();

  try {
    // 1. 检查是否有需要更新的密钥
    const { data: keysNeedingUpdate, error: fetchError } = await supabaseAdmin
      .from('shared_keys')
      .select('id, base_url, api_key_encrypted, available_models, updated_at')
      .eq('is_active', true)
      .or(`metadata->needs_model_update.eq.true,updated_at.lt.${new Date(Date.now() - UPDATE_COOLDOWN_MINUTES * 60 * 1000).toISOString()}`);

    if (fetchError) {
      console.error('Error fetching keys needing update:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
    }

    if (!keysNeedingUpdate || keysNeedingUpdate.length === 0) {
      return NextResponse.json({ 
        message: 'No keys need updating at this time.',
        nextUpdateAvailable: new Date(Date.now() + UPDATE_COOLDOWN_MINUTES * 60 * 1000).toISOString()
      });
    }

    // 2. 限制每次更新的数量，避免超时
    const MAX_KEYS_PER_UPDATE = 5;
    const keysToUpdate = keysNeedingUpdate.slice(0, MAX_KEYS_PER_UPDATE);

    let updatedCount = 0;
    const errors = [];
    const results = [];

    // 3. 更新选中的密钥
    for (const key of keysToUpdate) {
      try {
        const apiKey = keyManager.decryptApiKeyPublic(key.api_key_encrypted);
        const firstModel = key.available_models && key.available_models.length > 0 ? key.available_models[0] : 'gpt-4o';
        
        // 设置较短的超时时间
        const { availableModels } = await keyManager.testApiKey(key.base_url, apiKey, firstModel);

        if (availableModels && availableModels.length > 0) {
          // 更新模型列表并清除更新标记
          const { error: updateError } = await supabaseAdmin
            .from('shared_keys')
            .update({ 
              available_models: availableModels, 
              updated_at: new Date().toISOString(),
              metadata: supabaseAdmin.rpc('jsonb_delete_key', { 
                input_jsonb: key.metadata || {}, 
                key_to_delete: 'needs_model_update' 
              })
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

    // 4. 返回结果
    const response = {
      message: `Updated ${updatedCount} of ${keysToUpdate.length} keys.`,
      updatedCount,
      totalKeysNeedingUpdate: keysNeedingUpdate.length,
      remainingKeys: Math.max(0, keysNeedingUpdate.length - keysToUpdate.length),
      results,
      nextUpdateAvailable: new Date(Date.now() + UPDATE_COOLDOWN_MINUTES * 60 * 1000).toISOString()
    };

    if (errors.length > 0) {
      response.errors = errors;
      return NextResponse.json(response, { status: 207 }); // Multi-Status
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Model update failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET 方法用于检查更新状态
export async function GET() {
  try {
    const { data: keysNeedingUpdate, error } = await supabaseAdmin
      .from('shared_keys')
      .select('id, updated_at')
      .eq('is_active', true)
      .or(`metadata->needs_model_update.eq.true,updated_at.lt.${new Date(Date.now() - UPDATE_COOLDOWN_MINUTES * 60 * 1000).toISOString()}`);

    if (error) {
      return NextResponse.json({ error: 'Failed to check update status' }, { status: 500 });
    }

    return NextResponse.json({
      keysNeedingUpdate: keysNeedingUpdate?.length || 0,
      canUpdate: (keysNeedingUpdate?.length || 0) > 0,
      cooldownMinutes: UPDATE_COOLDOWN_MINUTES
    });
  } catch (error) {
    console.error('Error checking update status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
