-- 🚨 快速修复：解决函数返回类型冲突
-- 如果你遇到 "cannot change return type of existing function" 错误，请先执行这个脚本

-- 1. 删除所有可能冲突的旧函数
-- ============================

DROP FUNCTION IF EXISTS upsert_log_patch(UUID, DATE, JSONB, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS merge_arrays_by_log_id(JSONB, JSONB);
DROP FUNCTION IF EXISTS remove_log_entry(UUID, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS atomic_usage_check_and_increment(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS decrement_usage_count(UUID, TEXT);

-- 也删除可能的其他签名版本
DROP FUNCTION IF EXISTS upsert_log_patch(UUID, DATE, JSONB);
DROP FUNCTION IF EXISTS atomic_usage_check_and_increment(UUID, TEXT);
DROP FUNCTION IF EXISTS decrement_usage_count(UUID);

-- 2. 检查清理结果
-- ===============

SELECT 
  CASE 
    WHEN count(*) = 0 THEN '✅ All conflicting functions removed successfully'
    ELSE '⚠️ Some functions still exist: ' || string_agg(proname, ', ')
  END as cleanup_status
FROM pg_proc 
WHERE proname IN (
  'merge_arrays_by_log_id',
  'upsert_log_patch', 
  'remove_log_entry',
  'atomic_usage_check_and_increment',
  'decrement_usage_count'
);

-- 3. 提示下一步
-- =============

SELECT '🚀 Now you can safely run the complete-sync-migration-fixed.sql script!' as next_step;
