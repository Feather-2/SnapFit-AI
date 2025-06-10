-- 最小化的使用限额控制函数创建脚本
-- 只包含核心功能，避免复杂的索引和触发器

-- 1. 创建每日使用记录表（如果不存在）
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  log_data JSONB NOT NULL DEFAULT '{}',
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个用户每天只有一条记录
  UNIQUE(user_id, date)
);

-- 2. 创建基本索引
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);

-- 3. 核心限额检查和递增函数
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
  -- 获取当前使用量（带行锁防止并发）
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE;

  -- 严格检查限额 - 绝对不允许超过
  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  -- 未超过限额，原子性递增
  new_count := current_count + 1;

  -- 原子性更新或插入
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object(p_usage_type, new_count)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = daily_logs.log_data || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW();

  -- 返回成功结果
  RETURN QUERY SELECT TRUE, new_count;
END;
$$ LANGUAGE plpgsql;

-- 4. 回滚函数（AI请求失败时使用）
CREATE OR REPLACE FUNCTION decrement_usage_count(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  -- 获取当前计数
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- 只有大于0才减少
  IF current_count > 0 THEN
    new_count := current_count - 1;

    UPDATE daily_logs
    SET log_data = log_data || jsonb_build_object(
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

-- 5. 获取用户今日使用量的函数
CREATE OR REPLACE FUNCTION get_user_today_usage(
  p_user_id UUID, 
  p_usage_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  usage_count INTEGER := 0;
BEGIN
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO usage_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  RETURN COALESCE(usage_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 6. 验证函数创建
DO $$
BEGIN
  -- 检查核心函数是否存在
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'atomic_usage_check_and_increment'
  ) THEN
    RAISE NOTICE '✅ atomic_usage_check_and_increment function created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create atomic_usage_check_and_increment function';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'decrement_usage_count'
  ) THEN
    RAISE NOTICE '✅ decrement_usage_count function created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create decrement_usage_count function';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_today_usage'
  ) THEN
    RAISE NOTICE '✅ get_user_today_usage function created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create get_user_today_usage function';
  END IF;

  -- 检查表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'daily_logs'
  ) THEN
    RAISE NOTICE '✅ daily_logs table exists';
  ELSE
    RAISE EXCEPTION '❌ daily_logs table does not exist';
  END IF;

  RAISE NOTICE '🎉 All usage control functions and tables created successfully!';
END $$;
