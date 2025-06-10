-- 修复数据库函数返回值问题
-- 确保返回的数据结构正确

-- 1. 重新创建原子性检查和递增函数
CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_user_id UUID,
  p_usage_type TEXT,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, new_count INTEGER) AS $$
DECLARE
  current_count INTEGER := 0;
  new_count_val INTEGER := 0;
  record_exists BOOLEAN := FALSE;
BEGIN
  -- 🔍 调试日志
  RAISE NOTICE 'Function called with user_id: %, usage_type: %, daily_limit: %', p_user_id, p_usage_type, p_daily_limit;

  -- 🔒 检查是否存在记录并获取当前使用量
  SELECT 
    COALESCE(
      CASE 
        WHEN (log_data->>p_usage_type) IS NULL THEN 0
        WHEN (log_data->>p_usage_type) = 'null' THEN 0
        WHEN (log_data->>p_usage_type) = '' THEN 0
        ELSE (log_data->>p_usage_type)::int
      END, 
      0
    ),
    TRUE
  INTO current_count, record_exists
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE;

  -- 如果没有记录，设置默认值
  IF NOT FOUND THEN
    current_count := 0;
    record_exists := FALSE;
  END IF;

  -- 确保 current_count 不是 NULL
  current_count := COALESCE(current_count, 0);

  -- 🔍 调试日志
  RAISE NOTICE 'Current count: %, Record exists: %', current_count, record_exists;

  -- 🚫 严格检查限额 - 绝对不允许超过
  IF current_count >= p_daily_limit THEN
    RAISE NOTICE 'Limit exceeded: % >= %', current_count, p_daily_limit;
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  -- ✅ 未超过限额，原子性递增
  new_count_val := current_count + 1;

  -- 🔍 调试日志
  RAISE NOTICE 'Incrementing to: %', new_count_val;

  -- 🔒 原子性更新或插入
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object(p_usage_type, new_count_val)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = COALESCE(daily_logs.log_data, '{}'::jsonb) || jsonb_build_object(
      p_usage_type,
      new_count_val
    ),
    last_modified = NOW();

  -- 🔍 调试日志
  RAISE NOTICE 'Successfully updated to: %', new_count_val;

  -- ✅ 返回成功结果，确保字段名正确
  RETURN QUERY SELECT TRUE, new_count_val;
END;
$$ LANGUAGE plpgsql;

-- 2. 重新创建回滚函数
CREATE OR REPLACE FUNCTION decrement_usage_count(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER := 0;
  new_count_val INTEGER := 0;
BEGIN
  -- 获取当前计数，特别处理 null 值
  SELECT COALESCE(
    CASE 
      WHEN (log_data->>p_usage_type) IS NULL THEN 0
      WHEN (log_data->>p_usage_type) = 'null' THEN 0
      WHEN (log_data->>p_usage_type) = '' THEN 0
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
    new_count_val := current_count - 1;

    UPDATE daily_logs
    SET log_data = COALESCE(log_data, '{}'::jsonb) || jsonb_build_object(
      p_usage_type,
      new_count_val
    ),
    last_modified = NOW()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    RETURN new_count_val;
  END IF;

  RETURN current_count;
END;
$$ LANGUAGE plpgsql;

-- 3. 清理所有可能的 null 值
UPDATE daily_logs 
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{conversation_count}',
  '0'::jsonb
)
WHERE log_data->>'conversation_count' IS NULL 
   OR log_data->>'conversation_count' = 'null'
   OR log_data->>'conversation_count' = '';

-- 4. 验证修复
DO $$
DECLARE
  test_result RECORD;
  test_user_id UUID := gen_random_uuid();
BEGIN
  -- 测试函数是否正确返回数据
  SELECT * INTO test_result FROM atomic_usage_check_and_increment(
    test_user_id, 
    'test_count', 
    10
  );
  
  IF test_result.allowed = TRUE AND test_result.new_count = 1 THEN
    RAISE NOTICE '✅ Function returns correct structure: allowed=%, new_count=%', test_result.allowed, test_result.new_count;
  ELSE
    RAISE EXCEPTION '❌ Function return structure is incorrect: allowed=%, new_count=%', test_result.allowed, test_result.new_count;
  END IF;

  -- 清理测试数据
  DELETE FROM daily_logs WHERE user_id = test_user_id;
END $$;
