-- 创建安全事件表
-- 用于记录和监控系统安全事件

-- 1. 创建安全事件表
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引优化
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'rate_limit_exceeded',
    'invalid_input', 
    'unauthorized_access',
    'suspicious_activity',
    'brute_force_attempt',
    'data_injection_attempt',
    'file_upload_violation',
    'api_abuse',
    'privilege_escalation_attempt'
  ))
);

-- 2. 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_created ON security_events(ip_address, created_at);

-- 3. 创建复合索引用于常见查询
CREATE INDEX IF NOT EXISTS idx_security_events_user_time ON security_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON security_events(event_type, severity);

-- 4. 创建记录限额违规的函数
CREATE OR REPLACE FUNCTION log_limit_violation(
  p_user_id UUID,
  p_trust_level INTEGER,
  p_attempted_usage INTEGER,
  p_daily_limit INTEGER,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO security_events (
    user_id,
    ip_address,
    user_agent,
    event_type,
    severity,
    description,
    metadata
  ) VALUES (
    p_user_id,
    COALESCE(p_ip_address::INET, '0.0.0.0'::INET),
    p_user_agent,
    'rate_limit_exceeded',
    CASE 
      WHEN p_attempted_usage > p_daily_limit * 2 THEN 'high'
      WHEN p_attempted_usage > p_daily_limit * 1.5 THEN 'medium'
      ELSE 'low'
    END,
    FORMAT('User exceeded daily limit: attempted %s, limit %s (trust level %s)', 
           p_attempted_usage, p_daily_limit, p_trust_level),
    jsonb_build_object(
      'attempted_usage', p_attempted_usage,
      'daily_limit', p_daily_limit,
      'trust_level', p_trust_level,
      'excess_amount', p_attempted_usage - p_daily_limit
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 5. 创建获取安全统计的函数
CREATE OR REPLACE FUNCTION get_security_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
  total_events BIGINT,
  events_by_type JSONB,
  events_by_severity JSONB,
  top_suspicious_ips JSONB,
  daily_trends JSONB
) AS $$
DECLARE
  start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  start_date := NOW() - (days_back || ' days')::INTERVAL;
  
  -- 总事件数
  SELECT COUNT(*) INTO total_events
  FROM security_events 
  WHERE created_at >= start_date;
  
  -- 按类型统计
  SELECT jsonb_object_agg(event_type, event_count) INTO events_by_type
  FROM (
    SELECT event_type, COUNT(*) as event_count
    FROM security_events 
    WHERE created_at >= start_date
    GROUP BY event_type
  ) t;
  
  -- 按严重程度统计
  SELECT jsonb_object_agg(severity, event_count) INTO events_by_severity
  FROM (
    SELECT severity, COUNT(*) as event_count
    FROM security_events 
    WHERE created_at >= start_date
    GROUP BY severity
  ) t;
  
  -- 可疑IP统计（前10名）
  SELECT jsonb_object_agg(ip_address, event_count) INTO top_suspicious_ips
  FROM (
    SELECT ip_address::TEXT, COUNT(*) as event_count
    FROM security_events 
    WHERE created_at >= start_date
    GROUP BY ip_address
    ORDER BY event_count DESC
    LIMIT 10
  ) t;
  
  -- 每日趋势
  SELECT jsonb_object_agg(event_date, event_count) INTO daily_trends
  FROM (
    SELECT DATE(created_at) as event_date, COUNT(*) as event_count
    FROM security_events 
    WHERE created_at >= start_date
    GROUP BY DATE(created_at)
    ORDER BY event_date
  ) t;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建自动清理旧记录的函数
CREATE OR REPLACE FUNCTION cleanup_old_security_events(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_date := NOW() - (days_to_keep || ' days')::INTERVAL;
  
  DELETE FROM security_events 
  WHERE created_at < cutoff_date;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建检测可疑活动的函数
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  hours_back INTEGER DEFAULT 1
)
RETURNS TABLE(
  is_suspicious BOOLEAN,
  risk_score INTEGER,
  event_count BIGINT,
  high_severity_count BIGINT
) AS $$
DECLARE
  start_time TIMESTAMP WITH TIME ZONE;
  total_events BIGINT := 0;
  high_events BIGINT := 0;
  calculated_risk_score INTEGER := 0;
BEGIN
  start_time := NOW() - (hours_back || ' hours')::INTERVAL;
  
  -- 统计指定时间内的事件
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE severity IN ('high', 'critical'))
  INTO total_events, high_events
  FROM security_events
  WHERE created_at >= start_time
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_ip_address IS NULL OR ip_address = p_ip_address);
  
  -- 计算风险分数
  calculated_risk_score := 
    (total_events * 1) +           -- 每个事件 +1 分
    (high_events * 5);             -- 高危事件 +5 分
  
  -- 判断是否可疑（风险分数 >= 10 或高危事件 >= 3）
  RETURN QUERY SELECT 
    (calculated_risk_score >= 10 OR high_events >= 3),
    calculated_risk_score,
    total_events,
    high_events;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建定时清理任务（如果支持 pg_cron）
-- 注意：这需要 pg_cron 扩展，在 Supabase 中可能不可用
-- SELECT cron.schedule('cleanup-security-events', '0 2 * * *', 'SELECT cleanup_old_security_events(90);');

-- 9. 添加注释
COMMENT ON TABLE security_events IS '安全事件记录表，用于监控和分析系统安全状况';
COMMENT ON COLUMN security_events.event_type IS '事件类型：rate_limit_exceeded, invalid_input, unauthorized_access 等';
COMMENT ON COLUMN security_events.severity IS '严重程度：low, medium, high, critical';
COMMENT ON COLUMN security_events.metadata IS '事件相关的额外信息，JSON格式';

-- 10. 创建视图用于常见查询
CREATE OR REPLACE VIEW recent_security_events AS
SELECT 
  id,
  user_id,
  ip_address,
  event_type,
  severity,
  description,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_ago
FROM security_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

COMMENT ON VIEW recent_security_events IS '最近24小时的安全事件视图';

-- 验证表创建
SELECT 'Security events table created successfully' as status;
