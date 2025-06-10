-- 修复数据库函数中的 null 值处理问题

-- 1. 修复原子性检查和递增函数
CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_user_id UUID,
  p_usage_type TEXT,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, new_count INTEGER) AS $$
DECLARE
  current_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  -- 🔒 获取当前使用量（带行锁防止并发）
  -- 特别处理 null 值，确保返回 0 而不是 null
  SELECT COALESCE(
    CASE 
      WHEN (log_data->>p_usage_type) IS NULL THEN 0
      WHEN (log_data->>p_usage_type) = 'null' THEN 0
      ELSE (log_data->>p_usage_type)::int
    END, 
    0
  )
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE; -- 🔒 行级锁确保原子性

  -- 如果没有记录，current_count 为 0
  current_count := COALESCE(current_count, 0);

  -- 🚫 严格检查限额 - 绝对不允许超过
  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  -- ✅ 未超过限额，原子性递增
  new_count := current_count + 1;

  -- 🔒 原子性更新或插入
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object(p_usage_type, new_count)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = COALESCE(daily_logs.log_data, '{}'::jsonb) || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW();

  -- ✅ 返回成功结果
  RETURN QUERY SELECT TRUE, new_count;
END;
$$ LANGUAGE plpgsql;

-- 2. 修复回滚函数
CREATE OR REPLACE FUNCTION decrement_usage_count(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  -- 获取当前计数，特别处理 null 值
  SELECT COALESCE(
    CASE 
      WHEN (log_data->>p_usage_type) IS NULL THEN 0
      WHEN (log_data->>p_usage_type) = 'null' THEN 0
      ELSE (log_data->>p_usage_type)::int
    END, 
    0
  )
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- 确保不是 null
  current_count := COALESCE(current_count, 0);

  -- 只有大于0才减少
  IF current_count > 0 THEN
    new_count := current_count - 1;

    UPDATE daily_logs
    SET log_data = COALESCE(log_data, '{}'::jsonb) || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    RETURN new_count;
  END IF;

  RETURN current_count;
END;
$$ LANGUAGE plpgsql;

-- 3. 修复获取使用量函数
CREATE OR REPLACE FUNCTION get_user_today_usage(
  p_user_id UUID, 
  p_usage_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  usage_count INTEGER := 0;
BEGIN
  -- 特别处理 null 值
  SELECT COALESCE(
    CASE 
      WHEN (log_data->>p_usage_type) IS NULL THEN 0
      WHEN (log_data->>p_usage_type) = 'null' THEN 0
      ELSE (log_data->>p_usage_type)::int
    END, 
    0
  )
  INTO usage_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  RETURN COALESCE(usage_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 4. 清理现有的 null 值数据
UPDATE daily_logs 
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{conversation_count}',
  '0'::jsonb
)
WHERE log_data->>'conversation_count' IS NULL 
   OR log_data->>'conversation_count' = 'null';

UPDATE daily_logs 
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{api_call_count}',
  '0'::jsonb
)
WHERE log_data->>'api_call_count' IS NULL 
   OR log_data->>'api_call_count' = 'null';

UPDATE daily_logs 
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{upload_count}',
  '0'::jsonb
)
WHERE log_data->>'upload_count' IS NULL 
   OR log_data->>'upload_count' = 'null';

-- 5. 验证修复
DO $$
DECLARE
  test_result RECORD;
BEGIN
  -- 测试函数是否正确处理 null 值
  SELECT * INTO test_result FROM atomic_usage_check_and_increment(
    gen_random_uuid(), 
    'test_count', 
    10
  );
  
  IF test_result.allowed = TRUE AND test_result.new_count = 1 THEN
    RAISE NOTICE '✅ Null handling fix applied successfully';
  ELSE
    RAISE EXCEPTION '❌ Null handling fix failed';
  END IF;
END $$;
