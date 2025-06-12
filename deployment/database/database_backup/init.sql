-- Snapifit AI 数据库初始化脚本
-- 基于当前生产环境的完整数据库结构

-- ========================================
-- 1. 启用必要的扩展
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ========================================
-- 2. 创建序列
-- ========================================
CREATE SEQUENCE IF NOT EXISTS security_events_id_seq;

-- ========================================
-- 3. 创建表结构
-- ========================================

-- 用户表
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  linux_do_id text UNIQUE,
  username text,
  avatar_url text,
  email text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  display_name text,
  trust_level integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_silenced boolean DEFAULT false,
  last_login_at timestamp without time zone,
  login_count integer DEFAULT 0,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- 用户配置表
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  weight numeric,
  height numeric,
  age integer,
  gender character varying,
  activity_level character varying,
  goal character varying,
  target_weight numeric,
  target_calories integer,
  notes text,
  professional_mode boolean DEFAULT false,
  medical_history text,
  lifestyle text,
  health_awareness text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- 共享密钥表（支持多模型）
CREATE TABLE IF NOT EXISTS public.shared_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  base_url text NOT NULL,
  api_key_encrypted text NOT NULL,
  available_models text[] NOT NULL DEFAULT '{}',
  daily_limit integer DEFAULT 150,
  description text,
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  usage_count_today integer DEFAULT 0,
  total_usage_count integer DEFAULT 0,
  last_used_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT shared_keys_pkey PRIMARY KEY (id),
  CONSTRAINT shared_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- 日志表
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  log_data jsonb NOT NULL,
  last_modified timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_logs_pkey PRIMARY KEY (id),
  CONSTRAINT daily_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- AI记忆表
CREATE TABLE IF NOT EXISTS public.ai_memories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  expert_id character varying NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 500),
  version integer DEFAULT 1,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_memories_pkey PRIMARY KEY (id),
  CONSTRAINT ai_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- 安全事件表（完整版）
CREATE TABLE IF NOT EXISTS public.security_events (
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
    'privilege_escalation_attempt'
  ))
);

-- IP封禁表
CREATE TABLE IF NOT EXISTS public.ip_bans (
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

-- ========================================
-- 4. 创建唯一约束
-- ========================================
ALTER TABLE public.ai_memories
ADD CONSTRAINT IF NOT EXISTS ai_memories_user_expert_unique
UNIQUE (user_id, expert_id);

ALTER TABLE public.daily_logs
ADD CONSTRAINT IF NOT EXISTS daily_logs_user_date_unique
UNIQUE (user_id, date);

ALTER TABLE public.shared_keys
ADD CONSTRAINT IF NOT EXISTS shared_keys_user_id_name_key
UNIQUE (user_id, name);

-- ========================================
-- 5. 创建索引
-- ========================================

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_linux_do_id ON public.users(linux_do_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON public.users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_trust_level ON public.users(trust_level);

-- 用户配置表索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON public.user_profiles(updated_at);

-- 共享密钥表索引
CREATE INDEX IF NOT EXISTS idx_shared_keys_user ON public.shared_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_keys_active ON public.shared_keys(is_active, usage_count_today, daily_limit);

-- 日志表索引
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON public.daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON public.daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_last_modified ON public.daily_logs(last_modified);

-- AI记忆表索引
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON public.ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_expert_id ON public.ai_memories(expert_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_expert ON public.ai_memories(user_id, expert_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_last_updated ON public.ai_memories(last_updated);

-- 安全事件表索引
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON public.security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_created ON public.security_events(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user_time ON public.security_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON public.security_events(event_type, severity);

-- IP封禁表索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_bans_active_ip ON public.ip_bans(ip_address) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ip_bans_ip_address ON public.ip_bans(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_bans_banned_at ON public.ip_bans(banned_at);
CREATE INDEX IF NOT EXISTS idx_ip_bans_expires_at ON public.ip_bans(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_bans_is_active ON public.ip_bans(is_active);
CREATE INDEX IF NOT EXISTS idx_ip_bans_ban_type ON public.ip_bans(ban_type);
CREATE INDEX IF NOT EXISTS idx_ip_bans_severity ON public.ip_bans(severity);
CREATE INDEX IF NOT EXISTS idx_ip_bans_active_expires ON public.ip_bans(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_ip_bans_type_severity ON public.ip_bans(ban_type, severity);

-- ========================================
-- 6. 禁用 RLS（适合 ANON_KEY 架构）
-- ========================================
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_bans DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 7. 设置表权限
-- ========================================

-- 授予 anon 角色权限（前端访问）
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.user_profiles TO anon;
GRANT SELECT ON public.shared_keys TO anon;
GRANT SELECT ON public.daily_logs TO anon;
GRANT SELECT ON public.ai_memories TO anon;
GRANT SELECT ON public.security_events TO anon;
GRANT SELECT ON public.ip_bans TO anon;

-- 授予 authenticated 角色权限
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.shared_keys TO authenticated;
GRANT SELECT ON public.daily_logs TO authenticated;
GRANT SELECT ON public.ai_memories TO authenticated;
GRANT SELECT ON public.security_events TO authenticated;
GRANT SELECT ON public.ip_bans TO authenticated;

-- service_role 默认有所有权限

-- ========================================
-- 8. 添加表注释
-- ========================================
COMMENT ON SCHEMA public IS
'Snapifit AI database schema - RLS disabled, using application-level access control';

COMMENT ON TABLE public.users IS 'User accounts from Linux.do OAuth';
COMMENT ON TABLE public.user_profiles IS 'User health profiles and preferences';
COMMENT ON TABLE public.shared_keys IS 'Community shared API keys for AI services';
COMMENT ON TABLE public.daily_logs IS 'User daily health and activity logs';
COMMENT ON TABLE public.ai_memories IS 'AI conversation memories and context';
COMMENT ON TABLE public.security_events IS 'Security events and audit log for monitoring system activity';
COMMENT ON TABLE public.ip_bans IS 'IP address bans for security protection against malicious users';

-- ========================================
-- 9. 初始化完成标记
-- ========================================
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'DATABASE_INITIALIZED',
  1,
  jsonb_build_object(
    'timestamp', NOW(),
    'version', '1.0.0',
    'description', 'Snapifit AI database initialized successfully'
  )
) ON CONFLICT DO NOTHING;
