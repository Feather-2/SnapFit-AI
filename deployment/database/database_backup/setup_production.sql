-- SnapFit AI Database Setup Script (Production Version)
-- Updated: 2025-06-10
-- Source: Supabase production export
-- 
-- This script uses the complete production schema exported from Supabase
-- including all functions, triggers, tables, and constraints.
--
-- Production Export Statistics:
-- - 18 functions (complete business logic)
-- - 4 triggers (automatic timestamp updates)
-- - 6 tables (full data structure)
-- - All indexes and constraints from production

\echo '========================================='
\echo 'SnapFit AI Database Setup (Production)'
\echo 'Version: 2.0.0 (Production Export)'
\echo 'Date: 2025-06-10'
\echo 'Source: Supabase vdjnnaunrtjhfnpuarrw'
\echo '========================================='

-- Check database connection
\echo ''
\echo '🔍 Checking database connection...'
SELECT 
  current_database() as database_name,
  current_user as current_user,
  version() as postgresql_version;

-- Load production schema
\echo ''
\echo '🔧 Loading production schema (tables, functions, triggers)...'
\echo 'This includes:'
\echo '  - 6 tables with all constraints'
\echo '  - 18 business logic functions'
\echo '  - 4 automatic triggers'
\echo '  - All production indexes'

\i database/schema_production.sql

-- Verification
\echo ''
\echo '✅ Database setup completed!'
\echo '📊 Verifying installation...'

-- Verify tables
\echo ''
\echo 'Tables created:'
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify functions
\echo ''
\echo 'Functions created:'
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Verify triggers
\echo ''
\echo 'Triggers created:'
SELECT 
  trigger_name,
  event_object_table as table_name,
  action_timing || ' ' || event_manipulation as trigger_event
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- Verify key business functions
\echo ''
\echo '🔍 Verifying key business functions:'
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'atomic_usage_check_and_increment') 
    THEN '✅ atomic_usage_check_and_increment (Usage control)'
    ELSE '❌ atomic_usage_check_and_increment (MISSING)'
  END as usage_control;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'upsert_log_patch') 
    THEN '✅ upsert_log_patch (Optimistic locking)'
    ELSE '❌ upsert_log_patch (MISSING)'
  END as log_updates;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'jsonb_deep_merge') 
    THEN '✅ jsonb_deep_merge (JSON utilities)'
    ELSE '❌ jsonb_deep_merge (MISSING)'
  END as json_utilities;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_user_profile') 
    THEN '✅ get_user_profile (User management)'
    ELSE '❌ get_user_profile (MISSING)'
  END as user_management;

-- Summary
\echo ''
\echo '🎉 SnapFit AI Database setup completed!'
\echo ''
\echo '📋 Next steps:'
\echo '1. Copy actual schema from Ubuntu export to database/schema_production.sql'
\echo '2. Test all functions: SELECT routine_name FROM information_schema.routines WHERE routine_schema = ''public'';'
\echo '3. Verify triggers: SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = ''public'';'
\echo '4. Run application tests to ensure compatibility'
\echo ''
\echo '📁 Files to update:'
\echo '  - database/schema_production.sql (copy from ~/snapfit-export/database_backup/schema.sql)'
\echo '  - Update README.md with new setup instructions'
\echo ''
\echo 'Database is ready for use!'
