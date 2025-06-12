-- Snapifit AI 安全系统升级脚本 (纯SQL版本)
-- 添加IP封禁功能和增强安全事件表
-- 执行前请备份数据库
--
-- 使用方法：
--   方式1: psql -d database_name -f security-upgrade-pure.sql
--   方式2: 在数据库管理工具中直接执行此文件内容

-- ========================================
-- 1. 备份现有数据并升级 security_events 表
-- ========================================

-- 备份现有数据（如果有的话）
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'security_events') THEN
        -- 创建备份表
        EXECUTE 'CREATE TABLE security_events_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS') || ' AS SELECT * FROM security_events';
        RAISE NOTICE 'Existing security_events data backed up';

        -- 删除旧表
        DROP TABLE security_events CASCADE;
        RAISE NOTICE 'Old security_events table dropped';
    END IF;
END $$;

-- 创建新的 security_events 表
CREATE TABLE security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 约束检查
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'rate_limit_exceeded',
    'invalid_input',
    'unauthorized_access',
    'suspicious_activity',
    'brute_force_attempt',
    'data_injection_attempt',
    'file_upload_violation',
    'api_abuse',
    'privilege_escalation_attempt',
    'system_maintenance'
  ))
);

-- 创建索引
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_ip_created ON security_events(ip_address, created_at);
CREATE INDEX idx_security_events_user_time ON security_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX idx_security_events_type_severity ON security_events(event_type, severity);

-- ========================================
-- 2. 创建 IP 封禁表
-- ========================================

CREATE TABLE ip_bans (
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

-- 创建索引
CREATE UNIQUE INDEX idx_ip_bans_active_ip ON ip_bans(ip_address) WHERE is_active = TRUE;
CREATE INDEX idx_ip_bans_ip_address ON ip_bans(ip_address);
CREATE INDEX idx_ip_bans_banned_at ON ip_bans(banned_at);
CREATE INDEX idx_ip_bans_expires_at ON ip_bans(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_ip_bans_is_active ON ip_bans(is_active);
CREATE INDEX idx_ip_bans_ban_type ON ip_bans(ban_type);
CREATE INDEX idx_ip_bans_severity ON ip_bans(severity);
CREATE INDEX idx_ip_bans_active_expires ON ip_bans(is_active, expires_at);
CREATE INDEX idx_ip_bans_type_severity ON ip_bans(ban_type, severity);

-- ========================================
-- 3. 创建安全相关函数
-- ========================================

-- 记录限额违规的函数
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

-- 自动解封过期IP的函数
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

  -- 记录解封事件到系统日志
  IF unbanned_count > 0 THEN
    INSERT INTO security_events (
      ip_address,
      event_type,
      severity,
      description,
      metadata
    ) VALUES (
      '0.0.0.0'::INET,
      'system_maintenance',
      'low',
      'Automatically unbanned expired IPs',
      jsonb_build_object('unbanned_count', unbanned_count, 'unban_reason', 'expired')
    );
  END IF;

  RETURN unbanned_count;
END;
$$ LANGUAGE plpgsql;

-- 检查IP是否被封禁的函数
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

-- 获取封禁统计的函数
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

-- ========================================
-- 4. 创建触发器
-- ========================================

-- 自动更新 ip_bans 表的 updated_at 字段
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

-- ========================================
-- 5. 设置权限
-- ========================================

-- 禁用 RLS（与现有架构保持一致）
ALTER TABLE security_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE ip_bans DISABLE ROW LEVEL SECURITY;

-- 设置表权限
GRANT SELECT ON security_events TO anon;
GRANT SELECT ON security_events TO authenticated;
GRANT ALL ON security_events TO service_role;

GRANT SELECT ON ip_bans TO anon;
GRANT SELECT ON ip_bans TO authenticated;
GRANT ALL ON ip_bans TO service_role;

-- ========================================
-- 6. 添加注释
-- ========================================

COMMENT ON TABLE security_events IS '安全事件记录表，用于监控和分析系统安全状况';
COMMENT ON COLUMN security_events.event_type IS '事件类型：rate_limit_exceeded, invalid_input, unauthorized_access 等';
COMMENT ON COLUMN security_events.severity IS '严重程度：low, medium, high, critical';
COMMENT ON COLUMN security_events.metadata IS '事件相关的额外信息，JSON格式';

COMMENT ON TABLE ip_bans IS 'IP封禁记录表，用于管理被封禁的IP地址';
COMMENT ON COLUMN ip_bans.ip_address IS '被封禁的IP地址';
COMMENT ON COLUMN ip_bans.reason IS '封禁原因';
COMMENT ON COLUMN ip_bans.severity IS '严重程度：low, medium, high, critical';
COMMENT ON COLUMN ip_bans.ban_type IS '封禁类型：manual(手动), automatic(自动), temporary(临时)';
COMMENT ON COLUMN ip_bans.expires_at IS '过期时间，NULL表示永久封禁';
COMMENT ON COLUMN ip_bans.metadata IS '封禁相关的额外信息，JSON格式';

-- ========================================
-- 7. 记录升级完成（使用系统事件类型）
-- ========================================

-- 不记录到安全事件表，因为这不是安全威胁
-- 升级完成信息通过 NOTICE 输出即可

-- 验证安装
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
BEGIN
    -- 检查表
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN ('security_events', 'ip_bans') AND table_schema = 'public';

    -- 检查函数
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_name IN ('log_limit_violation', 'is_ip_banned', 'auto_unban_expired_ips', 'get_ban_statistics')
    AND routine_schema = 'public';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Snapifit AI Security System Upgrade Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables created: % (expected: 2)', table_count;
    RAISE NOTICE 'Functions created: % (expected: 4)', function_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Security features now available:';
    RAISE NOTICE '• Real-time security event logging';
    RAISE NOTICE '• Automatic IP banning based on rules';
    RAISE NOTICE '• Manual IP ban management';
    RAISE NOTICE '• Automatic expiration of temporary bans';
    RAISE NOTICE '• Comprehensive security statistics';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Set ADMIN_USER_IDS environment variable';
    RAISE NOTICE '2. Update your application middleware';
    RAISE NOTICE '3. Test the IP ban functionality';
    RAISE NOTICE '========================================';
END $$;
