-- 数据库迁移执行脚本
-- 请在 Supabase SQL Editor 中按顺序执行以下迁移

-- 1. 创建用户档案表
\i database/migrations/create-user-profiles-table.sql

-- 2. 创建AI记忆表
\i database/migrations/add-ai-memories-table.sql

-- 验证表是否创建成功
SELECT 
  table_name, 
  table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'ai_memories', 'users', 'daily_logs')
ORDER BY table_name;

-- 验证索引是否创建成功
SELECT 
  indexname, 
  tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'ai_memories')
ORDER BY tablename, indexname;

-- 验证RPC函数是否创建成功
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%user_profile%' 
  OR routine_name LIKE '%ai_memor%'
ORDER BY routine_name;
