-- Snapifit AI Database Schema-Only Deployment
-- Version: 2.0.0 (Production Export)
-- Date: 2025-06-10
--
-- This script deploys only the database structure without data
-- Ideal for development environments or fresh installations
--
-- Usage:
--   createdb snapfit_ai_dev
--   psql -d snapfit_ai_dev -f database/deploy_schema_only.sql

\echo '========================================='
\echo 'Snapifit AI Schema-Only Deployment'
\echo 'Version: 2.0.0 (Production Export)'
\echo 'Date: 2025-06-10'
\echo '========================================='

-- Check database connection
\echo ''
\echo '🔍 Checking database connection...'
SELECT
  current_database() as database_name,
  current_user as current_user,
  version() as postgresql_version,
  now() as deployment_time;

-- Deploy database structure only
\echo ''
\echo '🚀 Deploying database structure (schema only)...'
\echo 'This includes:'
\echo '  ✅ 6 tables with all constraints'
\echo '  ✅ 18 business logic functions'
\echo '  ✅ 4 automatic triggers'
\echo '  ✅ All production indexes'
\echo '  ❌ No data (clean installation)'

\i database/schema.sql

-- Verification
\echo ''
\echo '✅ Schema deployment completed!'
\echo '📊 Verifying installation...'

-- Count objects
\echo ''
\echo '📋 Database objects summary:'
SELECT
  'Tables' as object_type,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'

UNION ALL

SELECT
  'Functions' as object_type,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'

UNION ALL

SELECT
  'Triggers' as object_type,
  COUNT(*) as count
FROM information_schema.triggers
WHERE trigger_schema = 'public'

ORDER BY object_type;

-- List all tables
\echo ''
\echo '📋 Tables created:'
SELECT
  tablename as table_name,
  tableowner as owner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all functions
\echo ''
\echo '📋 Functions created:'
SELECT
  routine_name as function_name,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Verify key functions
\echo ''
\echo '🔍 Verifying key business functions:'

DO $$
DECLARE
    func_count INTEGER;
BEGIN
    -- Check atomic_usage_check_and_increment
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines
    WHERE routine_name = 'atomic_usage_check_and_increment' AND routine_schema = 'public';

    IF func_count > 0 THEN
        RAISE NOTICE '✅ atomic_usage_check_and_increment (Usage control)';
    ELSE
        RAISE NOTICE '❌ atomic_usage_check_and_increment (MISSING)';
    END IF;

    -- Check upsert_log_patch
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines
    WHERE routine_name = 'upsert_log_patch' AND routine_schema = 'public';

    IF func_count > 0 THEN
        RAISE NOTICE '✅ upsert_log_patch (Optimistic locking)';
    ELSE
        RAISE NOTICE '❌ upsert_log_patch (MISSING)';
    END IF;

    -- Check jsonb_deep_merge
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines
    WHERE routine_name = 'jsonb_deep_merge' AND routine_schema = 'public';

    IF func_count > 0 THEN
        RAISE NOTICE '✅ jsonb_deep_merge (JSON utilities)';
    ELSE
        RAISE NOTICE '❌ jsonb_deep_merge (MISSING)';
    END IF;

    -- Check get_user_profile
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines
    WHERE routine_name = 'get_user_profile' AND routine_schema = 'public';

    IF func_count > 0 THEN
        RAISE NOTICE '✅ get_user_profile (User management)';
    ELSE
        RAISE NOTICE '❌ get_user_profile (MISSING)';
    END IF;
END $$;

-- Check empty tables
\echo ''
\echo '📊 Table status (should be empty):'
DO $$
DECLARE
    table_name TEXT;
    row_count INTEGER;
BEGIN
    FOR table_name IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
        RAISE NOTICE '📋 %: % rows', table_name, row_count;
    END LOOP;
END $$;

\echo ''
\echo '🎉 Snapifit AI Schema deployment completed successfully!'
\echo ''
\echo '📋 Deployment summary:'
\echo '  ✅ Database structure deployed'
\echo '  ✅ All functions and triggers active'
\echo '  ✅ Tables created (empty)'
\echo '  ✅ All constraints and indexes created'
\echo ''
\echo '🚀 Your Snapifit AI database schema is ready!'
\echo '💡 To add data later, run: psql -d your_database -f database/data.sql'
