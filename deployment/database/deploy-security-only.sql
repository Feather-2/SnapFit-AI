-- SnapFit AI 安全系统独立部署脚本
-- 仅部署安全相关功能，适用于现有数据库升级
--
-- 使用方法：
--   psql -d your_database -f deployment/database/deploy-security-only.sql
--
-- 注意：此脚本会备份现有的 security_events 表数据

-- =========================================
-- SnapFit AI Security System Deployment
-- Version: 1.0.0
-- Date: 2025-01-01
-- =========================================

-- 检查数据库连接
-- Checking database connection...
SELECT
  current_database() as database_name,
  current_user as current_user,
  version() as postgresql_version,
  now() as deployment_time;

-- 检查必要的表是否存在
-- Checking prerequisites...

DO $$
DECLARE
    users_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
    ) INTO users_exists;

    IF NOT users_exists THEN
        RAISE EXCEPTION 'Users table not found. Please deploy the main database schema first.';
    ELSE
        RAISE NOTICE '✅ Users table found';
    END IF;
END $$;

-- 部署安全系统
-- Deploying security system...
\i database/security-upgrade.sql

-- 验证部署
-- Security deployment completed!
-- Verifying security installation...

-- 检查表
-- Security tables:
SELECT
  tablename as table_name,
  tableowner as owner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('security_events', 'ip_bans')
ORDER BY tablename;

-- 检查函数
-- Security functions:
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    -- Check log_limit_violation
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines
    WHERE routine_name = 'log_limit_violation' AND routine_schema = 'public';

    IF func_count > 0 THEN
        RAISE NOTICE '✅ log_limit_violation (Limit violation logging)';
    ELSE
        RAISE NOTICE '❌ log_limit_violation (MISSING)';
    END IF;

    -- Check is_ip_banned
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines
    WHERE routine_name = 'is_ip_banned' AND routine_schema = 'public';

    IF func_count > 0 THEN
        RAISE NOTICE '✅ is_ip_banned (IP ban checking)';
    ELSE
        RAISE NOTICE '❌ is_ip_banned (MISSING)';
    END IF;

    -- Check auto_unban_expired_ips
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines
    WHERE routine_name = 'auto_unban_expired_ips' AND routine_schema = 'public';

    IF func_count > 0 THEN
        RAISE NOTICE '✅ auto_unban_expired_ips (Automatic unban)';
    ELSE
        RAISE NOTICE '❌ auto_unban_expired_ips (MISSING)';
    END IF;

    -- Check get_ban_statistics
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines
    WHERE routine_name = 'get_ban_statistics' AND routine_schema = 'public';

    IF func_count > 0 THEN
        RAISE NOTICE '✅ get_ban_statistics (Ban statistics)';
    ELSE
        RAISE NOTICE '❌ get_ban_statistics (MISSING)';
    END IF;
END $$;

-- 检查索引
-- Security indexes:
SELECT
  indexname as index_name,
  tablename as table_name
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('security_events', 'ip_bans')
ORDER BY tablename, indexname;

-- 测试基本功能
-- Testing basic functionality...

DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Test IP ban check for a non-existent IP
    SELECT * INTO test_result FROM is_ip_banned('192.168.1.1'::INET);

    IF test_result.is_banned = FALSE THEN
        RAISE NOTICE '✅ IP ban check working (test IP not banned)';
    ELSE
        RAISE NOTICE '❌ IP ban check failed';
    END IF;

    -- Test ban statistics
    SELECT * INTO test_result FROM get_ban_statistics();

    IF test_result.total_active IS NOT NULL THEN
        RAISE NOTICE '✅ Ban statistics working (% active bans)', test_result.total_active;
    ELSE
        RAISE NOTICE '❌ Ban statistics failed';
    END IF;
END $$;

-- =========================================
-- 🎉 SnapFit AI Security System deployment completed successfully!
--
-- 📋 Deployment summary:
--   ✅ Enhanced security_events table
--   ✅ IP bans table with automatic expiration
--   ✅ Security monitoring functions
--   ✅ Automatic unban functionality
--   ✅ All indexes and constraints
--
-- 🔒 Security features now available:
--   • Real-time security event logging
--   • Automatic IP banning based on rules
--   • Manual IP ban management
--   • Automatic expiration of temporary bans
--   • Comprehensive security statistics
--
-- ⚙️  Next steps:
--   1. Set ADMIN_USER_IDS environment variable
--   2. Update your application middleware
--   3. Test the IP ban functionality
--   4. Configure monitoring and alerts
--
-- 🚀 Your SnapFit AI security system is ready!
-- =========================================
