-- 添加共享Key使用统计函数
-- 用于替代 key_usage_logs 表，将使用信息记录到 daily_logs 中

-- 创建或更新共享Key使用统计的函数
CREATE OR REPLACE FUNCTION increment_shared_key_usage(
  p_user_id UUID,
  p_shared_key_id UUID,
  p_model_used TEXT,
  p_api_endpoint TEXT
)
RETURNS void AS $$
DECLARE
  current_data JSONB;
  shared_key_usage JSONB;
  key_stats JSONB;
BEGIN
  -- 获取当前的 daily_logs 数据
  SELECT COALESCE(log_data, '{}'::jsonb)
  INTO current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- 如果没有记录，初始化为空对象
  IF current_data IS NULL THEN
    current_data := '{}'::jsonb;
  END IF;

  -- 获取或初始化 shared_key_usage 对象
  shared_key_usage := COALESCE(current_data->'shared_key_usage', '{}'::jsonb);

  -- 获取或初始化特定Key的统计
  key_stats := COALESCE(shared_key_usage->p_shared_key_id::text, '{
    "total_calls": 0,
    "successful_calls": 0,
    "models_used": {},
    "endpoints_used": {},
    "last_used_at": null
  }'::jsonb);

  -- 更新统计数据
  key_stats := jsonb_set(key_stats, '{total_calls}',
    to_jsonb((key_stats->>'total_calls')::int + 1));

  key_stats := jsonb_set(key_stats, '{successful_calls}',
    to_jsonb((key_stats->>'successful_calls')::int + 1));

  key_stats := jsonb_set(key_stats, '{last_used_at}',
    to_jsonb(NOW()::text));

  -- 更新模型使用统计
  key_stats := jsonb_set(key_stats,
    ARRAY['models_used', p_model_used],
    to_jsonb(COALESCE((key_stats->'models_used'->>p_model_used)::int, 0) + 1));

  -- 更新端点使用统计
  key_stats := jsonb_set(key_stats,
    ARRAY['endpoints_used', p_api_endpoint],
    to_jsonb(COALESCE((key_stats->'endpoints_used'->>p_api_endpoint)::int, 0) + 1));

  -- 更新 shared_key_usage
  shared_key_usage := jsonb_set(shared_key_usage,
    ARRAY[p_shared_key_id::text],
    key_stats);

  -- 更新 current_data
  current_data := jsonb_set(current_data, '{shared_key_usage}', shared_key_usage);

  -- 同时增加总的 api_call_count
  current_data := jsonb_set(current_data, '{api_call_count}',
    to_jsonb(COALESCE((current_data->>'api_call_count')::int, 0) + 1));

  -- 更新或插入到 daily_logs
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (p_user_id, CURRENT_DATE, current_data)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = EXCLUDED.log_data,
    last_modified = NOW();

END;
$$ LANGUAGE plpgsql;

-- 创建获取用户共享Key使用统计的函数
CREATE OR REPLACE FUNCTION get_user_shared_key_usage(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  date DATE,
  shared_key_usage JSONB,
  total_api_calls INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dl.date,
    COALESCE(dl.log_data->'shared_key_usage', '{}'::jsonb) as shared_key_usage,
    COALESCE((dl.log_data->>'api_call_count')::int, 0) as total_api_calls
  FROM daily_logs dl
  WHERE dl.user_id = p_user_id
    AND dl.date >= CURRENT_DATE - (p_days - 1)
    AND dl.date <= CURRENT_DATE
  ORDER BY dl.date DESC;
END;
$$ LANGUAGE plpgsql;

-- 验证函数是否创建成功
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'increment_shared_key_usage'
  ) THEN
    RAISE NOTICE '✅ increment_shared_key_usage function created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create increment_shared_key_usage function';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_user_shared_key_usage'
  ) THEN
    RAISE NOTICE '✅ get_user_shared_key_usage function created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create get_user_shared_key_usage function';
  END IF;

  RAISE NOTICE '🎉 Shared key usage functions created successfully!';
END $$;

-- 添加注释
COMMENT ON FUNCTION increment_shared_key_usage(UUID, UUID, TEXT, TEXT) IS '增加用户的共享Key使用统计';
COMMENT ON FUNCTION get_user_shared_key_usage(UUID, INTEGER) IS '获取用户的共享Key使用历史';
