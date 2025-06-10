-- 修复数据库测试脚本，使用真实用户ID

-- 1. 重新创建函数（如果还没有执行）
CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_user_id UUID,
  p_usage_type TEXT,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, new_count INTEGER) AS $$
DECLARE
  current_count INTEGER := 0;
  new_count_val INTEGER := 0;
BEGIN
  -- 获取当前使用量，特别处理 null 值
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
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE;

  -- 如果没有记录，设置为0
  IF NOT FOUND THEN
    current_count := 0;
  END IF;

  -- 确保不是 NULL
  current_count := COALESCE(current_count, 0);

  -- 检查限额
  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  -- 递增
  new_count_val := current_count + 1;

  -- 更新或插入
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

  -- 返回结果
  RETURN QUERY SELECT TRUE, new_count_val;
END;
$$ LANGUAGE plpgsql;

-- 2. 清理所有 null 值
UPDATE daily_logs 
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{conversation_count}',
  '0'::jsonb
)
WHERE log_data->>'conversation_count' IS NULL 
   OR log_data->>'conversation_count' = 'null'
   OR log_data->>'conversation_count' = '';

-- 3. 使用真实用户ID进行测试
DO $$
DECLARE
  test_result RECORD;
  real_user_id UUID;
BEGIN
  -- 获取一个真实的用户ID
  SELECT id INTO real_user_id FROM users LIMIT 1;
  
  IF real_user_id IS NOT NULL THEN
    -- 使用真实用户ID测试
    SELECT * INTO test_result FROM atomic_usage_check_and_increment(
      real_user_id, 
      'test_count', 
      150
    );
    
    RAISE NOTICE '✅ Test with real user successful: allowed=%, new_count=%', test_result.allowed, test_result.new_count;
    
    -- 清理测试数据
    UPDATE daily_logs 
    SET log_data = log_data - 'test_count'
    WHERE user_id = real_user_id AND date = CURRENT_DATE;
    
  ELSE
    RAISE NOTICE '⚠️ No users found in users table, skipping test';
  END IF;
END $$;

-- 4. 验证当前数据状态
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN log_data->>'conversation_count' IS NULL THEN 1 END) as null_counts,
  COUNT(CASE WHEN log_data->>'conversation_count' = 'null' THEN 1 END) as string_null_counts
FROM daily_logs 
WHERE date = CURRENT_DATE;

-- 5. 显示今日使用情况
SELECT 
  u.id as user_id,
  COALESCE(dl.log_data->>'conversation_count', '0') as conversation_count,
  dl.last_modified
FROM users u
LEFT JOIN daily_logs dl ON u.id = dl.user_id AND dl.date = CURRENT_DATE
ORDER BY dl.last_modified DESC NULLS LAST
LIMIT 10;
