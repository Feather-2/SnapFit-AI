-- 创建每日使用记录表
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

-- 创建部分索引，只索引最近30天的数据
CREATE INDEX IF NOT EXISTS idx_daily_logs_recent ON daily_logs(user_id, date)
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- 添加注释
COMMENT ON TABLE daily_logs IS '用户每日使用记录表';
COMMENT ON COLUMN daily_logs.user_id IS '用户ID，关联users表';
COMMENT ON COLUMN daily_logs.date IS '记录日期';
COMMENT ON COLUMN daily_logs.log_data IS 'JSON格式的使用数据，包含对话次数、API调用次数等';
COMMENT ON COLUMN daily_logs.last_modified IS '最后修改时间';

-- log_data 字段的结构示例：
-- {
--   "conversation_count": 15,
--   "api_call_count": 45,
--   "upload_count": 3,
--   "last_conversation_at": "2024-01-15T10:30:00Z",
--   "last_api_call_at": "2024-01-15T11:45:00Z",
--   "last_upload_at": "2024-01-15T09:15:00Z"
-- }

-- 创建自动清理旧数据的函数（保留90天）
CREATE OR REPLACE FUNCTION cleanup_old_daily_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM daily_logs
  WHERE date < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 创建定时任务（需要pg_cron扩展）
-- SELECT cron.schedule('cleanup-daily-logs', '0 2 * * *', 'SELECT cleanup_old_daily_logs();');

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

-- 创建用于统计的视图
CREATE OR REPLACE VIEW user_usage_summary AS
SELECT
  u.id as user_id,
  u.username,
  u.trust_level,
  dl.date,
  COALESCE((dl.log_data->>'conversation_count')::int, 0) as conversation_count,
  COALESCE((dl.log_data->>'api_call_count')::int, 0) as api_call_count,
  COALESCE((dl.log_data->>'upload_count')::int, 0) as upload_count,
  dl.last_modified
FROM users u
LEFT JOIN daily_logs dl ON u.id = dl.user_id
WHERE u.is_active = true;

COMMENT ON VIEW user_usage_summary IS '用户使用情况汇总视图';

-- 创建获取用户今日使用量的函数
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

-- 创建增加使用量的函数
CREATE OR REPLACE FUNCTION increment_user_usage(
  p_user_id UUID,
  p_usage_type TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  -- 使用 UPSERT 来创建或更新记录
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object(p_usage_type, p_increment)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = daily_logs.log_data || jsonb_build_object(
      p_usage_type,
      COALESCE((daily_logs.log_data->>p_usage_type)::int, 0) + p_increment
    ),
    last_modified = NOW();

  -- 返回新的计数
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO new_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- 示例用法：
-- SELECT get_user_today_usage('user-uuid', 'conversation_count');
-- SELECT increment_user_usage('user-uuid', 'conversation_count', 1);

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

-- 创建获取用户使用统计的函数
CREATE OR REPLACE FUNCTION get_user_usage_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  date DATE,
  conversation_count INTEGER,
  api_call_count INTEGER,
  upload_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dl.date,
    COALESCE((dl.log_data->>'conversation_count')::int, 0) as conversation_count,
    COALESCE((dl.log_data->>'api_call_count')::int, 0) as api_call_count,
    COALESCE((dl.log_data->>'upload_count')::int, 0) as upload_count
  FROM daily_logs dl
  WHERE dl.user_id = p_user_id
    AND dl.date >= CURRENT_DATE - (p_days - 1)
    AND dl.date <= CURRENT_DATE
  ORDER BY dl.date DESC;
END;
$$ LANGUAGE plpgsql;

-- 创建RLS策略（如果启用了行级安全）
-- ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view own daily logs" ON daily_logs
--   FOR SELECT USING (auth.uid() = user_id);

-- CREATE POLICY "Users can insert own daily logs" ON daily_logs
--   FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CREATE POLICY "Users can update own daily logs" ON daily_logs
--   FOR UPDATE USING (auth.uid() = user_id);

-- 🚨 创建安全事件记录表
CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,     -- 'LIMIT_VIOLATION', 'SUSPICIOUS_USAGE', 'AUTH_FAIL'
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_key_id UUID REFERENCES shared_keys(id) ON DELETE SET NULL,
  severity SMALLINT DEFAULT 1,         -- 1-5 (1=低, 5=严重)
  details JSONB DEFAULT '{}',          -- 最小化的关键信息
  ip_address INET,                     -- 用户IP地址
  user_agent TEXT,                     -- 用户代理
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建安全事件索引
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

-- 只保留30天的安全事件
CREATE INDEX IF NOT EXISTS idx_security_events_recent ON security_events(created_at)
WHERE created_at >= NOW() - INTERVAL '30 days';

-- 自动清理安全事件（保留30天）
CREATE OR REPLACE FUNCTION cleanup_security_events()
RETURNS void AS $$
BEGIN
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 🔄 创建智能数组合并函数
CREATE OR REPLACE FUNCTION merge_arrays_by_log_id(
  existing_array JSONB,
  new_array JSONB
)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '[]'::jsonb;
  existing_item JSONB;
  new_item JSONB;
  existing_ids TEXT[];
  new_ids TEXT[];
  all_ids TEXT[];
  item_id TEXT;
BEGIN
  -- 如果任一数组为空，返回另一个
  IF existing_array IS NULL OR jsonb_array_length(existing_array) = 0 THEN
    RETURN COALESCE(new_array, '[]'::jsonb);
  END IF;

  IF new_array IS NULL OR jsonb_array_length(new_array) = 0 THEN
    RETURN existing_array;
  END IF;

  -- 收集所有 log_id
  SELECT array_agg(DISTINCT item->>'log_id') INTO existing_ids
  FROM jsonb_array_elements(existing_array) AS item
  WHERE item->>'log_id' IS NOT NULL;

  SELECT array_agg(DISTINCT item->>'log_id') INTO new_ids
  FROM jsonb_array_elements(new_array) AS item
  WHERE item->>'log_id' IS NOT NULL;

  -- 合并所有唯一ID
  SELECT array_agg(DISTINCT unnest) INTO all_ids
  FROM unnest(COALESCE(existing_ids, ARRAY[]::TEXT[]) || COALESCE(new_ids, ARRAY[]::TEXT[])) AS unnest;

  -- 对每个ID，选择最新的版本
  FOR item_id IN SELECT unnest(COALESCE(all_ids, ARRAY[]::TEXT[]))
  LOOP
    -- 从新数组中查找
    SELECT item INTO new_item
    FROM jsonb_array_elements(new_array) AS item
    WHERE item->>'log_id' = item_id
    LIMIT 1;

    IF new_item IS NOT NULL THEN
      -- 新数组中有此项，使用新版本
      result := result || jsonb_build_array(new_item);
    ELSE
      -- 新数组中没有，从现有数组中获取
      SELECT item INTO existing_item
      FROM jsonb_array_elements(existing_array) AS item
      WHERE item->>'log_id' = item_id
      LIMIT 1;

      IF existing_item IS NOT NULL THEN
        result := result || jsonb_build_array(existing_item);
      END IF;
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 🔄 创建安全的日志补丁更新函数
CREATE OR REPLACE FUNCTION upsert_log_patch(
  p_user_id UUID,
  p_date DATE,
  p_log_data_patch JSONB,
  p_last_modified TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(success BOOLEAN, conflict_resolved BOOLEAN, final_modified TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
  current_modified TIMESTAMP WITH TIME ZONE;
  current_data JSONB;
  merged_data JSONB;
  conflict_detected BOOLEAN := FALSE;
BEGIN
  -- 🔒 获取当前记录（带行锁）
  SELECT last_modified, log_data INTO current_modified, current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date
  FOR UPDATE;

  -- 🔍 检测冲突：如果服务器版本比客户端版本新
  IF current_modified IS NOT NULL AND current_modified > p_last_modified THEN
    conflict_detected := TRUE;

    -- 🧠 智能合并策略
    merged_data := COALESCE(current_data, '{}'::jsonb);

    -- 对于数组字段，使用智能合并
    IF p_log_data_patch ? 'foodEntries' THEN
      merged_data := jsonb_set(
        merged_data,
        '{foodEntries}',
        merge_arrays_by_log_id(
          current_data->'foodEntries',
          p_log_data_patch->'foodEntries'
        )
      );
    END IF;

    IF p_log_data_patch ? 'exerciseEntries' THEN
      merged_data := jsonb_set(
        merged_data,
        '{exerciseEntries}',
        merge_arrays_by_log_id(
          current_data->'exerciseEntries',
          p_log_data_patch->'exerciseEntries'
        )
      );
    END IF;

    -- 对于非数组字段，使用补丁覆盖
    merged_data := merged_data || (p_log_data_patch - 'foodEntries' - 'exerciseEntries');

  ELSE
    -- 无冲突，直接合并
    merged_data := COALESCE(current_data, '{}'::jsonb);

    -- 安全合并数组字段
    IF p_log_data_patch ? 'foodEntries' THEN
      merged_data := jsonb_set(
        merged_data,
        '{foodEntries}',
        merge_arrays_by_log_id(
          current_data->'foodEntries',
          p_log_data_patch->'foodEntries'
        )
      );
    END IF;

    IF p_log_data_patch ? 'exerciseEntries' THEN
      merged_data := jsonb_set(
        merged_data,
        '{exerciseEntries}',
        merge_arrays_by_log_id(
          current_data->'exerciseEntries',
          p_log_data_patch->'exerciseEntries'
        )
      );
    END IF;

    -- 合并其他字段
    merged_data := merged_data || (p_log_data_patch - 'foodEntries' - 'exerciseEntries');
  END IF;

  -- 🔒 原子性更新或插入
  INSERT INTO daily_logs (user_id, date, log_data, last_modified)
  VALUES (
    p_user_id,
    p_date,
    merged_data,
    GREATEST(COALESCE(current_modified, p_last_modified), p_last_modified)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = EXCLUDED.log_data,
    last_modified = EXCLUDED.last_modified;

  -- 返回最终的修改时间
  SELECT last_modified INTO current_modified
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date;

  RETURN QUERY SELECT TRUE, conflict_detected, current_modified;
END;
$$ LANGUAGE plpgsql;

-- 🗑️ 创建安全删除条目函数
CREATE OR REPLACE FUNCTION remove_log_entry(
  p_user_id UUID,
  p_date DATE,
  p_entry_type TEXT, -- 'food' 或 'exercise'
  p_log_id TEXT
)
RETURNS TABLE(success BOOLEAN, entries_remaining INTEGER) AS $$
DECLARE
  current_data JSONB;
  updated_array JSONB;
  field_name TEXT;
BEGIN
  -- 确定字段名
  IF p_entry_type = 'food' THEN
    field_name := 'foodEntries';
  ELSIF p_entry_type = 'exercise' THEN
    field_name := 'exerciseEntries';
  ELSE
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  -- 🔒 获取当前数据（带行锁）
  SELECT log_data INTO current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date
  FOR UPDATE;

  IF current_data IS NULL THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  -- 过滤掉指定的条目
  SELECT jsonb_agg(item) INTO updated_array
  FROM jsonb_array_elements(current_data->field_name) AS item
  WHERE item->>'log_id' != p_log_id;

  -- 更新数据
  UPDATE daily_logs
  SET
    log_data = jsonb_set(log_data, ('{' || field_name || '}')::text[], COALESCE(updated_array, '[]'::jsonb)),
    last_modified = NOW()
  WHERE user_id = p_user_id AND date = p_date;

  -- 返回剩余条目数
  RETURN QUERY SELECT TRUE, COALESCE(jsonb_array_length(updated_array), 0);
END;
$$ LANGUAGE plpgsql;

-- 记录限额违规事件的函数
CREATE OR REPLACE FUNCTION log_limit_violation(
  p_user_id UUID,
  p_trust_level INTEGER,
  p_attempted_usage INTEGER,
  p_daily_limit INTEGER,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO security_events (
    event_type,
    user_id,
    severity,
    details,
    ip_address,
    user_agent
  ) VALUES (
    'LIMIT_VIOLATION',
    p_user_id,
    CASE
      WHEN p_attempted_usage > p_daily_limit * 1.5 THEN 4  -- 超过50%为高危
      WHEN p_attempted_usage > p_daily_limit * 1.2 THEN 3  -- 超过20%为中危
      ELSE 2  -- 其他为低危
    END,
    jsonb_build_object(
      'trust_level', p_trust_level,
      'attempted_usage', p_attempted_usage,
      'daily_limit', p_daily_limit,
      'excess_attempts', p_attempted_usage - p_daily_limit
    ),
    p_ip_address,
    p_user_agent
  );
END;
$$ LANGUAGE plpgsql;

-- 授权给服务角色
-- GRANT ALL ON daily_logs TO service_role;
-- GRANT ALL ON security_events TO service_role;
-- GRANT EXECUTE ON FUNCTION get_user_today_usage(UUID, TEXT) TO service_role;
-- GRANT EXECUTE ON FUNCTION increment_user_usage(UUID, TEXT, INTEGER) TO service_role;
-- GRANT EXECUTE ON FUNCTION get_user_usage_stats(UUID, INTEGER) TO service_role;
-- GRANT EXECUTE ON FUNCTION atomic_usage_check_and_increment(UUID, TEXT, INTEGER) TO service_role;
-- GRANT EXECUTE ON FUNCTION decrement_usage_count(UUID, TEXT) TO service_role;
-- GRANT EXECUTE ON FUNCTION log_limit_violation(UUID, INTEGER, INTEGER, INTEGER, INET, TEXT) TO service_role;
