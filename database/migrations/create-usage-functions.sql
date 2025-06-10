-- 创建使用限额控制的核心函数
-- 这个脚本需要在 Supabase 数据库中执行

-- 🔒 原子性检查和递增函数（核心安全控制）
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
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE; -- 🔒 行级锁确保原子性

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
    log_data = daily_logs.log_data || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW();

  -- ✅ 返回成功结果
  RETURN QUERY SELECT TRUE, new_count;
END;
$$ LANGUAGE plpgsql;

-- 🔄 回滚函数（AI请求失败时使用）
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

-- 获取用户今日使用量的函数
CREATE OR REPLACE FUNCTION get_user_today_usage(p_user_id UUID, p_usage_type TEXT)
RETURNS INTEGER AS $$
DECLARE
  usage_count INTEGER := 0;
BEGIN
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO usage_count
  FROM daily_logs
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE;

  RETURN COALESCE(usage_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 创建每日使用记录表（如果不存在）
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  log_data JSONB NOT NULL DEFAULT '{}',
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保每个用户每天只有一条记录
  UNIQUE(user_id, date)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_last_modified ON daily_logs(last_modified);

-- 创建部分索引，只索引最近30天的数据（使用固定日期避免IMMUTABLE问题）
-- 注意：这个索引需要定期重建以保持有效性
-- CREATE INDEX IF NOT EXISTS idx_daily_logs_recent ON daily_logs(user_id, date)
-- WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- 添加注释
COMMENT ON TABLE daily_logs IS '用户每日使用记录表';
COMMENT ON COLUMN daily_logs.user_id IS '用户ID，关联users表';
COMMENT ON COLUMN daily_logs.date IS '记录日期';
COMMENT ON COLUMN daily_logs.log_data IS 'JSON格式的使用数据，包含对话次数、API调用次数等';
COMMENT ON COLUMN daily_logs.last_modified IS '最后修改时间';

-- 创建更新last_modified的触发器
CREATE OR REPLACE FUNCTION update_daily_logs_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_logs_modified
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_logs_modified();

-- 授权给服务角色（如果需要）
-- GRANT ALL ON daily_logs TO service_role;
-- GRANT EXECUTE ON FUNCTION atomic_usage_check_and_increment(UUID, TEXT, INTEGER) TO service_role;
-- GRANT EXECUTE ON FUNCTION decrement_usage_count(UUID, TEXT) TO service_role;
-- GRANT EXECUTE ON FUNCTION get_user_today_usage(UUID, TEXT) TO service_role;

-- 验证函数是否创建成功
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'atomic_usage_check_and_increment'
  ) THEN
    RAISE NOTICE '✅ atomic_usage_check_and_increment function created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create atomic_usage_check_and_increment function';
  END IF;
END $$;
