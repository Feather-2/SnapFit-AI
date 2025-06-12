-- Snapifit AI 触发器和定时任务初始化脚本

-- ========================================
-- 1. 触发器函数
-- ========================================

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AI记忆版本管理触发器函数
CREATE OR REPLACE FUNCTION manage_ai_memory_version()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果内容发生变化，增加版本号
  IF TG_OP = 'UPDATE' AND OLD.content != NEW.content THEN
    NEW.version = OLD.version + 1;
    NEW.last_updated = NOW();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.version = 1;
    NEW.last_updated = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 用户登录统计触发器函数
CREATE OR REPLACE FUNCTION update_user_login_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在 last_login_at 字段被更新时触发
  IF TG_OP = 'UPDATE' AND NEW.last_login_at != OLD.last_login_at THEN
    NEW.login_count = COALESCE(OLD.login_count, 0) + 1;
    NEW.updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 共享密钥使用量验证触发器函数
CREATE OR REPLACE FUNCTION validate_shared_key_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- 确保使用量不超过限制
  IF NEW.usage_count_today > NEW.daily_limit THEN
    RAISE EXCEPTION 'Usage count (%) cannot exceed daily limit (%)',
      NEW.usage_count_today, NEW.daily_limit;
  END IF;

  -- 确保使用量不为负数
  IF NEW.usage_count_today < 0 THEN
    NEW.usage_count_today = 0;
  END IF;

  IF NEW.total_usage_count < 0 THEN
    NEW.total_usage_count = 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 日志数据验证触发器函数
CREATE OR REPLACE FUNCTION validate_daily_log_data()
RETURNS TRIGGER AS $$
BEGIN
  -- 确保 log_data 不为 null
  IF NEW.log_data IS NULL THEN
    NEW.log_data = '{}'::jsonb;
  END IF;

  -- 更新 last_modified 时间戳
  NEW.last_modified = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 安全事件记录触发器函数
CREATE OR REPLACE FUNCTION log_security_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type_name TEXT;
  event_details JSONB;
BEGIN
  -- 根据操作类型确定事件名称
  CASE TG_OP
    WHEN 'INSERT' THEN event_type_name = TG_TABLE_NAME || '_CREATED';
    WHEN 'UPDATE' THEN event_type_name = TG_TABLE_NAME || '_UPDATED';
    WHEN 'DELETE' THEN event_type_name = TG_TABLE_NAME || '_DELETED';
  END CASE;

  -- 构建事件详情
  CASE TG_TABLE_NAME
    WHEN 'shared_keys' THEN
      event_details = jsonb_build_object(
        'key_id', COALESCE(NEW.id, OLD.id),
        'key_name', COALESCE(NEW.name, OLD.name),
        'user_id', COALESCE(NEW.user_id, OLD.user_id),
        'is_active', COALESCE(NEW.is_active, OLD.is_active)
      );
    WHEN 'users' THEN
      event_details = jsonb_build_object(
        'user_id', COALESCE(NEW.id, OLD.id),
        'username', COALESCE(NEW.username, OLD.username),
        'linux_do_id', COALESCE(NEW.linux_do_id, OLD.linux_do_id)
      );
    ELSE
      event_details = jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP
      );
  END CASE;

  -- 插入安全事件记录
  INSERT INTO security_events (
    event_type,
    user_id,
    shared_key_id,
    severity,
    details
  ) VALUES (
    event_type_name,
    CASE WHEN TG_TABLE_NAME = 'users' THEN COALESCE(NEW.id, OLD.id) ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'shared_keys' THEN COALESCE(NEW.id, OLD.id) ELSE NULL END,
    1,
    event_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. 创建触发器
-- ========================================

-- 用户表触发器
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 用户配置表触发器
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 共享密钥表触发器
DROP TRIGGER IF EXISTS trigger_shared_keys_updated_at ON shared_keys;
CREATE TRIGGER trigger_shared_keys_updated_at
  BEFORE UPDATE ON shared_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 共享密钥使用量验证触发器
DROP TRIGGER IF EXISTS trigger_shared_keys_usage_validation ON shared_keys;
CREATE TRIGGER trigger_shared_keys_usage_validation
  BEFORE INSERT OR UPDATE ON shared_keys
  FOR EACH ROW
  EXECUTE FUNCTION validate_shared_key_usage();

-- 日志数据验证触发器
DROP TRIGGER IF EXISTS trigger_daily_logs_validation ON daily_logs;
CREATE TRIGGER trigger_daily_logs_validation
  BEFORE INSERT OR UPDATE ON daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION validate_daily_log_data();

-- AI记忆表触发器
DROP TRIGGER IF EXISTS trigger_ai_memories_version ON ai_memories;
CREATE TRIGGER trigger_ai_memories_version
  BEFORE INSERT OR UPDATE ON ai_memories
  FOR EACH ROW
  EXECUTE FUNCTION manage_ai_memory_version();

-- 安全事件记录触发器（可选，根据需要启用）
-- 注意：这些触发器会记录所有数据变更，可能产生大量日志

-- 用户表安全事件触发器
DROP TRIGGER IF EXISTS trigger_users_security_log ON users;
CREATE TRIGGER trigger_users_security_log
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_security_event();

-- 共享密钥表安全事件触发器
DROP TRIGGER IF EXISTS trigger_shared_keys_security_log ON shared_keys;
CREATE TRIGGER trigger_shared_keys_security_log
  AFTER INSERT OR UPDATE OR DELETE ON shared_keys
  FOR EACH ROW
  EXECUTE FUNCTION log_security_event();

-- ========================================
-- 3. 定时任务设置
-- ========================================

-- 删除现有的定时任务（如果存在）
SELECT cron.unschedule('daily-shared-keys-reset') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-shared-keys-reset'
);

SELECT cron.unschedule('weekly-ai-memory-cleanup') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-ai-memory-cleanup'
);

SELECT cron.unschedule('monthly-database-cleanup') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monthly-database-cleanup'
);

-- 每日重置共享密钥使用量（UTC 00:00）
SELECT cron.schedule(
  'daily-shared-keys-reset',
  '0 0 * * *',
  'SELECT reset_shared_keys_daily();'
);

-- 每周清理旧的AI记忆（周日 02:00 UTC）
SELECT cron.schedule(
  'weekly-ai-memory-cleanup',
  '0 2 * * 0',
  'SELECT cleanup_old_ai_memories(90);'
);

-- 每月数据库清理和优化（每月1号 03:00 UTC）
SELECT cron.schedule(
  'monthly-database-cleanup',
  '0 3 1 * *',
  'SELECT cleanup_and_optimize_database();'
);

-- ========================================
-- 4. 函数权限设置
-- ========================================

-- 授予必要的函数执行权限
GRANT EXECUTE ON FUNCTION get_user_profile TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_user_profile TO service_role;
GRANT EXECUTE ON FUNCTION upsert_log_patch TO service_role;
GRANT EXECUTE ON FUNCTION get_user_ai_memories TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_ai_memories TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_ai_memories TO service_role;
GRANT EXECUTE ON FUNCTION atomic_usage_check_and_increment TO service_role;
GRANT EXECUTE ON FUNCTION decrement_usage_count TO service_role;
GRANT EXECUTE ON FUNCTION increment_shared_key_usage TO service_role;
GRANT EXECUTE ON FUNCTION get_user_shared_key_usage TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_today_usage TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION reset_shared_keys_daily TO service_role;

-- 辅助函数权限
GRANT EXECUTE ON FUNCTION jsonb_deep_merge TO service_role;
GRANT EXECUTE ON FUNCTION merge_arrays_by_log_id TO service_role;

-- ========================================
-- 5. 验证设置
-- ========================================

DO $$
DECLARE
  trigger_count INTEGER;
  cron_count INTEGER;
  function_count INTEGER;
BEGIN
  -- 检查触发器数量
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public';

  -- 检查定时任务数量
  SELECT COUNT(*) INTO cron_count
  FROM cron.job
  WHERE jobname LIKE '%shared-keys%' OR jobname LIKE '%memory-cleanup%';

  -- 检查函数数量
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

  RAISE NOTICE '=== 初始化验证 ===';
  RAISE NOTICE 'Triggers created: %', trigger_count;
  RAISE NOTICE 'Cron jobs scheduled: %', cron_count;
  RAISE NOTICE 'Functions available: %', function_count;

  -- 记录初始化完成事件
  INSERT INTO security_events (event_type, severity, details)
  VALUES (
    'DATABASE_TRIGGERS_INITIALIZED',
    1,
    jsonb_build_object(
      'triggers', trigger_count,
      'cron_jobs', cron_count,
      'functions', function_count,
      'timestamp', NOW()
    )
  );

  RAISE NOTICE '✅ 触发器和定时任务初始化完成';
END $$;
