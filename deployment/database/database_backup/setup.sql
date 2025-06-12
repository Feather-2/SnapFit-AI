-- Snapifit AI 数据库完整初始化脚本
-- 执行顺序：setup.sql -> init.sql -> functions.sql -> triggers.sql

-- ========================================
-- 1. 数据库信息
-- ========================================
\echo '========================================='
\echo 'Snapifit AI Database Setup'
\echo 'Version: 1.0.0'
\echo 'Date: 2024-01-01'
\echo '========================================='

-- 显示当前数据库信息
SELECT
  current_database() as database_name,
  current_user as current_user,
  version() as postgresql_version;

-- ========================================
-- 2. 执行初始化脚本
-- ========================================

\echo ''
\echo '🔧 Step 1: Creating tables and basic structure...'
\i database/init.sql

\echo ''
\echo '🔧 Step 2: Creating functions...'
\i database/functions.sql

\echo ''
\echo '🔧 Step 3: Creating triggers and cron jobs...'
\i database/triggers.sql

-- ========================================
-- 3. 插入初始数据（可选）
-- ========================================

\echo ''
\echo '🔧 Step 4: Inserting initial data...'

-- 插入系统用户（用于系统操作）
INSERT INTO users (
  id,
  username,
  display_name,
  email,
  trust_level,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system',
  'System User',
  'system@snapfit.ai',
  4,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 插入示例共享密钥（仅用于测试，生产环境请删除）
INSERT INTO shared_keys (
  id,
  user_id,
  name,
  base_url,
  api_key_encrypted,
  available_models,
  daily_limit,
  description,
  tags,
  is_active
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'Demo OpenAI Key',
  'https://api.openai.com',
  'demo_encrypted_key_placeholder',
  ARRAY['gpt-3.5-turbo', 'gpt-4'],
  100,
  'Demo key for testing purposes',
  ARRAY['demo', 'testing'],
  false  -- 设为 false，避免在生产环境被使用
) ON CONFLICT DO NOTHING;

-- ========================================
-- 4. 最终验证
-- ========================================

\echo ''
\echo '🔍 Final verification...'

-- 检查表结构
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 检查函数数量
SELECT
  COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- 检查触发器数量
SELECT
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 检查定时任务
SELECT
  jobname,
  schedule,
  command
FROM cron.job
WHERE jobname LIKE '%shared-keys%' OR jobname LIKE '%memory%';

-- 检查权限设置
SELECT DISTINCT
  grantee,
  COUNT(*) as permission_count
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee
ORDER BY grantee;

-- ========================================
-- 5. 完成标记
-- ========================================

-- 记录初始化完成事件
INSERT INTO security_events (
  event_type,
  severity,
  details
) VALUES (
  'DATABASE_SETUP_COMPLETED',
  1,
  jsonb_build_object(
    'version', '1.0.0',
    'timestamp', NOW(),
    'setup_type', 'complete_initialization'
  )
);

\echo ''
\echo '✅ Database setup completed successfully!'
\echo ''
\echo 'Next steps:'
\echo '1. Configure your application environment variables'
\echo '2. Test the database connection'
\echo '3. Deploy your application'
\echo ''
\echo 'Important notes:'
\echo '- RLS is disabled (using application-level security)'
\echo '- Demo data inserted (disable in production)'
\echo '- Cron jobs scheduled for daily maintenance'
\echo '========================================='
