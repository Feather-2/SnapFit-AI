-- 创建IP封禁表
-- 用于管理被封禁的IP地址

-- 1. 创建IP封禁表
CREATE TABLE IF NOT EXISTS ip_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL表示永久封禁
  is_active BOOLEAN DEFAULT TRUE,
  ban_type TEXT NOT NULL CHECK (ban_type IN ('manual', 'automatic', 'temporary')),
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL, -- 管理员ID（手动封禁时）
  unbanned_at TIMESTAMP WITH TIME ZONE,
  unban_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建索引以优化查询性能
CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_bans_active_ip ON ip_bans(ip_address) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ip_bans_ip_address ON ip_bans(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_bans_banned_at ON ip_bans(banned_at);
CREATE INDEX IF NOT EXISTS idx_ip_bans_expires_at ON ip_bans(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_bans_is_active ON ip_bans(is_active);
CREATE INDEX IF NOT EXISTS idx_ip_bans_ban_type ON ip_bans(ban_type);
CREATE INDEX IF NOT EXISTS idx_ip_bans_severity ON ip_bans(severity);

-- 3. 创建复合索引用于常见查询
CREATE INDEX IF NOT EXISTS idx_ip_bans_active_expires ON ip_bans(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_ip_bans_type_severity ON ip_bans(ban_type, severity);

-- 4. 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_ip_bans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ip_bans_updated_at
  BEFORE UPDATE ON ip_bans
  FOR EACH ROW
  EXECUTE FUNCTION update_ip_bans_updated_at();

-- 5. 创建自动解封过期IP的函数
CREATE OR REPLACE FUNCTION auto_unban_expired_ips()
RETURNS INTEGER AS $$
DECLARE
  unbanned_count INTEGER;
BEGIN
  -- 自动解封过期的IP
  UPDATE ip_bans 
  SET 
    is_active = FALSE,
    unbanned_at = NOW(),
    unban_reason = 'expired'
  WHERE 
    is_active = TRUE 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS unbanned_count = ROW_COUNT;
  
  -- 记录解封事件到安全日志
  INSERT INTO security_events (
    ip_address,
    event_type,
    severity,
    description,
    metadata
  )
  SELECT 
    ip_address,
    'suspicious_activity',
    'low',
    'IP automatically unbanned due to expiration',
    jsonb_build_object('unban_reason', 'expired', 'unbanned_count', unbanned_count)
  FROM ip_bans 
  WHERE unbanned_at = (SELECT MAX(unbanned_at) FROM ip_bans WHERE unban_reason = 'expired')
  LIMIT 1;
  
  RETURN unbanned_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建检查IP是否被封禁的函数
CREATE OR REPLACE FUNCTION is_ip_banned(check_ip INET)
RETURNS TABLE(
  is_banned BOOLEAN,
  ban_id UUID,
  reason TEXT,
  severity TEXT,
  banned_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- 首先自动解封过期的IP
  PERFORM auto_unban_expired_ips();
  
  -- 检查IP是否被封禁
  RETURN QUERY
  SELECT 
    TRUE as is_banned,
    ib.id as ban_id,
    ib.reason,
    ib.severity,
    ib.banned_at,
    ib.expires_at
  FROM ip_bans ib
  WHERE ib.ip_address = check_ip 
    AND ib.is_active = TRUE
  LIMIT 1;
  
  -- 如果没有找到封禁记录，返回未封禁状态
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, NULL::TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建自动封禁检查函数
CREATE OR REPLACE FUNCTION check_auto_ban_rules(check_ip INET)
RETURNS TABLE(
  should_ban BOOLEAN,
  rule_matched TEXT,
  event_count BIGINT,
  ban_duration INTEGER,
  severity TEXT
) AS $$
DECLARE
  rule RECORD;
  event_count BIGINT;
  time_window TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 检查是否已经被封禁
  IF EXISTS (SELECT 1 FROM ip_bans WHERE ip_address = check_ip AND is_active = TRUE) THEN
    RETURN QUERY SELECT FALSE, 'already_banned'::TEXT, 0::BIGINT, 0, 'low'::TEXT;
    RETURN;
  END IF;
  
  -- 定义自动封禁规则（与TypeScript中的规则保持一致）
  FOR rule IN 
    VALUES 
      ('rate_limit_exceeded', 10, 60, 60, 'medium'),
      ('invalid_input', 20, 30, 120, 'medium'),
      ('unauthorized_access', 5, 30, 240, 'high'),
      ('brute_force_attempt', 3, 15, 0, 'critical'),
      ('data_injection_attempt', 2, 60, 0, 'critical'),
      ('api_abuse', 15, 60, 180, 'high')
  LOOP
    -- 计算时间窗口
    time_window := NOW() - (rule.column2 || ' minutes')::INTERVAL;
    
    -- 统计指定时间窗口内的事件数量
    SELECT COUNT(*) INTO event_count
    FROM security_events
    WHERE ip_address = check_ip
      AND event_type = rule.column1
      AND created_at >= time_window;
    
    -- 检查是否达到阈值
    IF event_count >= rule.column2 THEN
      RETURN QUERY SELECT 
        TRUE,
        rule.column1,
        event_count,
        rule.column4,
        rule.column5;
      RETURN;
    END IF;
  END LOOP;
  
  -- 没有匹配的规则
  RETURN QUERY SELECT FALSE, 'no_rule_matched'::TEXT, 0::BIGINT, 0, 'low'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建封禁统计函数
CREATE OR REPLACE FUNCTION get_ban_statistics()
RETURNS TABLE(
  total_active BIGINT,
  total_expired BIGINT,
  manual_bans BIGINT,
  automatic_bans BIGINT,
  recent_bans BIGINT,
  by_severity JSONB
) AS $$
DECLARE
  one_day_ago TIMESTAMP WITH TIME ZONE;
BEGIN
  one_day_ago := NOW() - INTERVAL '24 hours';
  
  -- 总活跃封禁数
  SELECT COUNT(*) INTO total_active
  FROM ip_bans 
  WHERE is_active = TRUE;
  
  -- 总过期封禁数
  SELECT COUNT(*) INTO total_expired
  FROM ip_bans 
  WHERE is_active = FALSE;
  
  -- 手动封禁数
  SELECT COUNT(*) INTO manual_bans
  FROM ip_bans 
  WHERE ban_type = 'manual';
  
  -- 自动封禁数
  SELECT COUNT(*) INTO automatic_bans
  FROM ip_bans 
  WHERE ban_type = 'automatic';
  
  -- 最近24小时封禁数
  SELECT COUNT(*) INTO recent_bans
  FROM ip_bans 
  WHERE banned_at >= one_day_ago;
  
  -- 按严重程度统计
  SELECT jsonb_object_agg(severity, ban_count) INTO by_severity
  FROM (
    SELECT severity, COUNT(*) as ban_count
    FROM ip_bans
    WHERE is_active = TRUE
    GROUP BY severity
  ) t;
  
  RETURN QUERY SELECT 
    get_ban_statistics.total_active,
    get_ban_statistics.total_expired,
    get_ban_statistics.manual_bans,
    get_ban_statistics.automatic_bans,
    get_ban_statistics.recent_bans,
    get_ban_statistics.by_severity;
END;
$$ LANGUAGE plpgsql;

-- 9. 创建清理旧封禁记录的函数
CREATE OR REPLACE FUNCTION cleanup_old_ban_records(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_date := NOW() - (days_to_keep || ' days')::INTERVAL;
  
  -- 只删除非活跃的旧记录
  DELETE FROM ip_bans 
  WHERE is_active = FALSE 
    AND (unbanned_at < cutoff_date OR (unbanned_at IS NULL AND banned_at < cutoff_date));
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 10. 创建视图用于常见查询
CREATE OR REPLACE VIEW active_ip_bans AS
SELECT 
  id,
  ip_address,
  reason,
  severity,
  ban_type,
  banned_at,
  expires_at,
  CASE 
    WHEN expires_at IS NULL THEN 'permanent'
    WHEN expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END as status,
  EXTRACT(EPOCH FROM (COALESCE(expires_at, NOW() + INTERVAL '100 years') - NOW()))/3600 as hours_remaining
FROM ip_bans
WHERE is_active = TRUE
ORDER BY banned_at DESC;

-- 11. 创建定时任务（如果支持 pg_cron）
-- 注意：这需要 pg_cron 扩展，在某些环境中可能不可用
-- SELECT cron.schedule('auto-unban-expired', '*/5 * * * *', 'SELECT auto_unban_expired_ips();');
-- SELECT cron.schedule('cleanup-old-bans', '0 3 * * *', 'SELECT cleanup_old_ban_records(365);');

-- 12. 添加注释
COMMENT ON TABLE ip_bans IS 'IP封禁记录表，用于管理被封禁的IP地址';
COMMENT ON COLUMN ip_bans.ip_address IS '被封禁的IP地址';
COMMENT ON COLUMN ip_bans.reason IS '封禁原因';
COMMENT ON COLUMN ip_bans.severity IS '严重程度：low, medium, high, critical';
COMMENT ON COLUMN ip_bans.ban_type IS '封禁类型：manual(手动), automatic(自动), temporary(临时)';
COMMENT ON COLUMN ip_bans.expires_at IS '过期时间，NULL表示永久封禁';
COMMENT ON COLUMN ip_bans.metadata IS '封禁相关的额外信息，JSON格式';

COMMENT ON VIEW active_ip_bans IS '活跃IP封禁记录视图，包含状态和剩余时间信息';

-- 验证表创建
SELECT 'IP bans table and functions created successfully' as status;
