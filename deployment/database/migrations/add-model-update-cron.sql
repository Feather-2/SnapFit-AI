-- ========================================
-- 模型更新定时任务
-- ========================================

-- 创建模型更新函数
CREATE OR REPLACE FUNCTION update_shared_key_models()
RETURNS TABLE(
  updated_count INTEGER,
  error_count INTEGER,
  details JSONB
) AS $$
DECLARE
  key_record RECORD;
  update_count INTEGER := 0;
  error_count INTEGER := 0;
  result_details JSONB := '[]'::JSONB;
  key_details JSONB;
BEGIN
  -- 遍历所有活跃的共享密钥
  FOR key_record IN 
    SELECT id, base_url, api_key_encrypted, available_models
    FROM shared_keys 
    WHERE is_active = true
  LOOP
    BEGIN
      -- 记录处理的密钥
      key_details := jsonb_build_object(
        'key_id', key_record.id,
        'base_url', key_record.base_url,
        'status', 'processing',
        'timestamp', NOW()
      );
      
      -- 这里我们只能标记需要更新，实际的API调用需要在应用层完成
      -- 因为PostgreSQL函数无法直接进行HTTP请求
      UPDATE shared_keys 
      SET 
        updated_at = NOW(),
        -- 添加一个标记字段表示需要更新模型
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('needs_model_update', true)
      WHERE id = key_record.id;
      
      update_count := update_count + 1;
      
      key_details := key_details || jsonb_build_object('status', 'marked_for_update');
      result_details := result_details || jsonb_build_array(key_details);
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      
      key_details := key_details || jsonb_build_object(
        'status', 'error',
        'error_message', SQLERRM
      );
      result_details := result_details || jsonb_build_array(key_details);
      
      -- 记录错误到安全事件表
      INSERT INTO security_events (
        event_type,
        severity,
        description,
        metadata
      ) VALUES (
        'system_maintenance',
        'low',
        'Error during scheduled model update',
        jsonb_build_object(
          'key_id', key_record.id,
          'error', SQLERRM,
          'function', 'update_shared_key_models'
        )
      );
    END;
  END LOOP;
  
  -- 记录执行结果
  INSERT INTO security_events (
    event_type,
    severity,
    description,
    metadata
  ) VALUES (
    'system_maintenance',
    'low',
    'Scheduled model update completed',
    jsonb_build_object(
      'updated_count', update_count,
      'error_count', error_count,
      'execution_time', NOW(),
      'details', result_details
    )
  );
  
  RETURN QUERY SELECT update_count, error_count, result_details;
END;
$$ LANGUAGE plpgsql;

-- 创建定时任务（每4小时执行一次）
-- 注意：这需要 pg_cron 扩展
SELECT cron.schedule(
  'update-shared-key-models',
  '0 */4 * * *',
  'SELECT update_shared_key_models();'
);

-- 创建检查需要更新的密钥的函数
CREATE OR REPLACE FUNCTION get_keys_needing_model_update()
RETURNS TABLE(
  id UUID,
  base_url TEXT,
  api_key_encrypted TEXT,
  available_models TEXT[],
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sk.id,
    sk.base_url,
    sk.api_key_encrypted,
    sk.available_models,
    sk.updated_at
  FROM shared_keys sk
  WHERE sk.is_active = true
    AND (
      sk.metadata->>'needs_model_update' = 'true'
      OR sk.updated_at < NOW() - INTERVAL '4 hours'
    );
END;
$$ LANGUAGE plpgsql;

-- 创建清除更新标记的函数
CREATE OR REPLACE FUNCTION clear_model_update_flag(key_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE shared_keys 
  SET metadata = metadata - 'needs_model_update'
  WHERE id = key_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 添加注释
COMMENT ON FUNCTION update_shared_key_models() IS '定时标记需要更新模型的共享密钥';
COMMENT ON FUNCTION get_keys_needing_model_update() IS '获取需要更新模型的密钥列表';
COMMENT ON FUNCTION clear_model_update_flag(UUID) IS '清除密钥的模型更新标记';

-- 验证函数创建
SELECT 'Model update cron functions created successfully' as status;
