-- 调试数据库函数返回值
-- 在 Supabase SQL Editor 中执行以下查询来调试

-- 1. 检查函数是否存在
SELECT proname, proargnames, prosrc 
FROM pg_proc 
WHERE proname = 'atomic_usage_check_and_increment';

-- 2. 检查当前用户的数据
SELECT user_id, date, log_data 
FROM daily_logs 
WHERE date = CURRENT_DATE 
ORDER BY last_modified DESC 
LIMIT 10;

-- 3. 测试函数调用（替换为实际的用户ID）
-- SELECT * FROM atomic_usage_check_and_increment(
--   'your-user-id-here'::UUID, 
--   'conversation_count', 
--   150
-- );

-- 4. 检查数据类型
SELECT 
  user_id,
  date,
  log_data,
  log_data->>'conversation_count' as conversation_count_text,
  (log_data->>'conversation_count')::int as conversation_count_int,
  CASE 
    WHEN (log_data->>'conversation_count') IS NULL THEN 'IS NULL'
    WHEN (log_data->>'conversation_count') = 'null' THEN 'IS STRING NULL'
    ELSE 'HAS VALUE'
  END as null_status
FROM daily_logs 
WHERE date = CURRENT_DATE;

-- 5. 测试 COALESCE 逻辑
SELECT 
  user_id,
  COALESCE(
    CASE 
      WHEN (log_data->>'conversation_count') IS NULL THEN 0
      WHEN (log_data->>'conversation_count') = 'null' THEN 0
      ELSE (log_data->>'conversation_count')::int
    END, 
    0
  ) as processed_count
FROM daily_logs 
WHERE date = CURRENT_DATE;
