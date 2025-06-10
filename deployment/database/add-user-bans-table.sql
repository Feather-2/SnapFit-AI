-- 添加用户封禁表
-- 用于管理用户账户的封禁

-- ========================================
-- 1. 创建用户封禁表
-- ========================================

CREATE TABLE IF NOT EXISTS user_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- ========================================
-- 2. 创建索引以优化查询性能
-- ========================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_bans_active_user ON user_bans(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON user_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_banned_at ON user_bans(banned_at);
CREATE INDEX IF NOT EXISTS idx_user_bans_expires_at ON user_bans(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_bans_is_active ON user_bans(is_active);
CREATE INDEX IF NOT EXISTS idx_user_bans_ban_type ON user_bans(ban_type);
CREATE INDEX IF NOT EXISTS idx_user_bans_severity ON user_bans(severity);
CREATE INDEX IF NOT EXISTS idx_user_bans_active_expires ON user_bans(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_bans_type_severity ON user_bans(ban_type, severity);

-- ========================================
-- 3. 创建触发器自动更新 updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_user_bans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_bans_updated_at
  BEFORE UPDATE ON user_bans
  FOR EACH ROW
  EXECUTE FUNCTION update_user_bans_updated_at();

-- ========================================
-- 4. 创建用户封禁相关函数
-- ========================================

-- 自动解封过期用户的函数
CREATE OR REPLACE FUNCTION auto_unban_expired_users()
RETURNS INTEGER AS $$
DECLARE
  unbanned_count INTEGER;
BEGIN
  -- 自动解封过期的用户
  UPDATE user_bans 
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
      'Automatically unbanned expired users',
      jsonb_build_object('unbanned_count', unbanned_count, 'unban_reason', 'expired')
    );
  END IF;
  
  RETURN unbanned_count;
END;
$$ LANGUAGE plpgsql;

-- 检查用户是否被封禁的函数
CREATE OR REPLACE FUNCTION is_user_banned(check_user_id UUID)
RETURNS TABLE(
  is_banned BOOLEAN,
  ban_id UUID,
  reason TEXT,
  severity TEXT,
  banned_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- 首先自动解封过期的用户
  PERFORM auto_unban_expired_users();
  
  -- 检查用户是否被封禁
  RETURN QUERY
  SELECT 
    TRUE as is_banned,
    ub.id as ban_id,
    ub.reason,
    ub.severity,
    ub.banned_at,
    ub.expires_at
  FROM user_bans ub
  WHERE ub.user_id = check_user_id 
    AND ub.is_active = TRUE
  LIMIT 1;
  
  -- 如果没有找到封禁记录，返回未封禁状态
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, NULL::TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 获取用户封禁统计的函数
CREATE OR REPLACE FUNCTION get_user_ban_statistics()
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
  FROM user_bans 
  WHERE is_active = TRUE;
  
  -- 总过期封禁数
  SELECT COUNT(*) INTO total_expired
  FROM user_bans 
  WHERE is_active = FALSE;
  
  -- 手动封禁数
  SELECT COUNT(*) INTO manual_bans
  FROM user_bans 
  WHERE ban_type = 'manual';
  
  -- 自动封禁数
  SELECT COUNT(*) INTO automatic_bans
  FROM user_bans 
  WHERE ban_type = 'automatic';
  
  -- 最近24小时封禁数
  SELECT COUNT(*) INTO recent_bans
  FROM user_bans 
  WHERE banned_at >= one_day_ago;
  
  -- 按严重程度统计
  SELECT jsonb_object_agg(severity, ban_count) INTO by_severity
  FROM (
    SELECT severity, COUNT(*) as ban_count
    FROM user_bans
    WHERE is_active = TRUE
    GROUP BY severity
  ) t;
  
  RETURN QUERY SELECT 
    get_user_ban_statistics.total_active,
    get_user_ban_statistics.total_expired,
    get_user_ban_statistics.manual_bans,
    get_user_ban_statistics.automatic_bans,
    get_user_ban_statistics.recent_bans,
    get_user_ban_statistics.by_severity;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. 设置权限
-- ========================================

-- 禁用 RLS（与现有架构保持一致）
ALTER TABLE user_bans DISABLE ROW LEVEL SECURITY;

-- 设置表权限
GRANT SELECT ON user_bans TO anon;
GRANT SELECT ON user_bans TO authenticated;
GRANT ALL ON user_bans TO service_role;

-- ========================================
-- 6. 添加注释
-- ========================================

COMMENT ON TABLE user_bans IS '用户封禁记录表，用于管理被封禁的用户账户';
COMMENT ON COLUMN user_bans.user_id IS '被封禁的用户ID';
COMMENT ON COLUMN user_bans.reason IS '封禁原因';
COMMENT ON COLUMN user_bans.severity IS '严重程度：low, medium, high, critical';
COMMENT ON COLUMN user_bans.ban_type IS '封禁类型：manual(手动), automatic(自动), temporary(临时)';
COMMENT ON COLUMN user_bans.expires_at IS '过期时间，NULL表示永久封禁';
COMMENT ON COLUMN user_bans.metadata IS '封禁相关的额外信息，JSON格式';

-- ========================================
-- 7. 创建视图用于常见查询
-- ========================================

CREATE OR REPLACE VIEW active_user_bans AS
SELECT 
  ub.id,
  ub.user_id,
  u.username,
  u.email,
  ub.reason,
  ub.severity,
  ub.ban_type,
  ub.banned_at,
  ub.expires_at,
  CASE 
    WHEN ub.expires_at IS NULL THEN 'permanent'
    WHEN ub.expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END as status,
  EXTRACT(EPOCH FROM (COALESCE(ub.expires_at, NOW() + INTERVAL '100 years') - NOW()))/3600 as hours_remaining
FROM user_bans ub
JOIN users u ON ub.user_id = u.id
WHERE ub.is_active = TRUE
ORDER BY ub.banned_at DESC;

COMMENT ON VIEW active_user_bans IS '活跃用户封禁记录视图，包含用户信息和状态';

-- 验证表创建
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
BEGIN
    -- 检查表
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name = 'user_bans' AND table_schema = 'public';
    
    -- 检查函数
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_name IN ('auto_unban_expired_users', 'is_user_banned', 'get_user_ban_statistics')
    AND routine_schema = 'public';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User Bans System Setup Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables created: % (expected: 1)', table_count;
    RAISE NOTICE 'Functions created: % (expected: 3)', function_count;
    RAISE NOTICE '';
    RAISE NOTICE 'User ban features now available:';
    RAISE NOTICE '• User account banning and unbanning';
    RAISE NOTICE '• Automatic user banning based on rules';
    RAISE NOTICE '• Temporary and permanent user bans';
    RAISE NOTICE '• User ban statistics and management';
    RAISE NOTICE '========================================';
END $$;

SELECT 'User bans table and functions created successfully!' as status;
