-- SnapFit AI 数据库函数初始化脚本
-- 包含所有业务逻辑函数，整合了乐观锁、逻辑删除、使用量控制等复杂功能

-- ========================================
-- 1. 核心辅助函数
-- ========================================

-- JSONB 深度合并函数
CREATE OR REPLACE FUNCTION jsonb_deep_merge(jsonb1 jsonb, jsonb2 jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
  v JSONB;
  k TEXT;
BEGIN
  IF jsonb1 IS NULL THEN RETURN jsonb2; END IF;
  IF jsonb2 IS NULL THEN RETURN jsonb1; END IF;

  result := jsonb1;
  FOR k, v IN SELECT * FROM jsonb_each(jsonb2) LOOP
    IF result ? k AND jsonb_typeof(result->k) = 'object' AND jsonb_typeof(v) = 'object' THEN
      result := jsonb_set(result, ARRAY[k], jsonb_deep_merge(result->k, v));
    ELSE
      result := result || jsonb_build_object(k, v);
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- 支持逻辑删除的智能数组合并函数（按 log_id）
CREATE OR REPLACE FUNCTION merge_arrays_by_log_id(
  existing_array jsonb,
  new_array jsonb,
  deleted_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB := '[]'::jsonb;
  existing_item JSONB;
  new_item JSONB;
  existing_ids TEXT[];
  new_ids TEXT[];
  deleted_ids_array TEXT[];
  all_ids TEXT[];
  item_id TEXT;
BEGIN
  -- 处理删除的ID列表
  IF deleted_ids IS NOT NULL AND jsonb_array_length(deleted_ids) > 0 THEN
    SELECT array_agg(value::text) INTO deleted_ids_array
    FROM jsonb_array_elements_text(deleted_ids);
  ELSE
    deleted_ids_array := ARRAY[]::TEXT[];
  END IF;

  -- 如果现有数组为空，返回新数组（过滤已删除的）
  IF existing_array IS NULL OR jsonb_array_length(existing_array) = 0 THEN
    IF new_array IS NULL OR jsonb_array_length(new_array) = 0 THEN
      RETURN '[]'::jsonb;
    END IF;

    SELECT jsonb_agg(item)
    INTO result
    FROM jsonb_array_elements(new_array) AS item
    WHERE NOT (deleted_ids_array @> ARRAY[item->>'log_id']);

    RETURN COALESCE(result, '[]'::jsonb);
  END IF;

  -- 如果新数组为空，返回现有数组（过滤已删除的）
  IF new_array IS NULL OR jsonb_array_length(new_array) = 0 THEN
    SELECT jsonb_agg(item)
    INTO result
    FROM jsonb_array_elements(existing_array) AS item
    WHERE NOT (deleted_ids_array @> ARRAY[item->>'log_id']);

    RETURN COALESCE(result, '[]'::jsonb);
  END IF;

  -- 获取现有和新数组的所有ID（排除已删除的）
  SELECT array_agg(item->>'log_id') INTO existing_ids
  FROM jsonb_array_elements(existing_array) AS item
  WHERE NOT (deleted_ids_array @> ARRAY[item->>'log_id']);

  SELECT array_agg(item->>'log_id') INTO new_ids
  FROM jsonb_array_elements(new_array) AS item
  WHERE NOT (deleted_ids_array @> ARRAY[item->>'log_id']);

  -- 合并所有唯一ID
  SELECT array_agg(DISTINCT id) INTO all_ids
  FROM (
    SELECT unnest(COALESCE(existing_ids, ARRAY[]::TEXT[])) AS id
    UNION
    SELECT unnest(COALESCE(new_ids, ARRAY[]::TEXT[]))
  ) AS combined_ids;

  -- 为每个ID选择最新版本（优先新数组）
  FOR item_id IN SELECT unnest(COALESCE(all_ids, ARRAY[]::TEXT[]))
  LOOP
    -- 跳过已删除的条目
    IF deleted_ids_array @> ARRAY[item_id] THEN
      CONTINUE;
    END IF;

    -- 优先选择新数组中的项目
    SELECT item INTO new_item
    FROM jsonb_array_elements(new_array) AS item
    WHERE item->>'log_id' = item_id
    LIMIT 1;

    IF new_item IS NOT NULL THEN
      result := result || jsonb_build_array(new_item);
    ELSE
      -- 如果新数组中没有，使用现有数组中的
      SELECT item INTO existing_item
      FROM jsonb_array_elements(existing_array) AS item
      WHERE item->>'log_id' = item_id
      LIMIT 1;

      IF existing_item IS NOT NULL THEN
        result := result || jsonb_build_array(existing_item);
      END IF;
    END IF;

    -- 重置变量
    new_item := NULL;
    existing_item := NULL;
  END LOOP;

  RETURN result;
END;
$$;

-- ========================================
-- 2. 用户管理函数
-- ========================================

-- 获取用户配置
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id uuid)
RETURNS TABLE(
  weight numeric,
  height numeric,
  age integer,
  gender text,
  activity_level text,
  goal text,
  target_weight numeric,
  target_calories integer,
  notes text,
  professional_mode boolean,
  medical_history text,
  lifestyle text,
  health_awareness text,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.weight,
    up.height,
    up.age,
    up.gender::TEXT,
    up.activity_level::TEXT,
    up.goal::TEXT,
    up.target_weight,
    up.target_calories,
    up.notes,
    up.professional_mode,
    up.medical_history,
    up.lifestyle,
    up.health_awareness,
    up.updated_at
  FROM user_profiles up
  WHERE up.user_id = p_user_id;
END;
$$;

-- 更新用户配置
CREATE OR REPLACE FUNCTION upsert_user_profile(
  p_user_id uuid,
  p_weight numeric DEFAULT NULL,
  p_height numeric DEFAULT NULL,
  p_age integer DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_activity_level text DEFAULT NULL,
  p_goal text DEFAULT NULL,
  p_target_weight numeric DEFAULT NULL,
  p_target_calories integer DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_professional_mode boolean DEFAULT NULL,
  p_medical_history text DEFAULT NULL,
  p_lifestyle text DEFAULT NULL,
  p_health_awareness text DEFAULT NULL
)
RETURNS TABLE(id uuid, updated_at timestamp with time zone)
LANGUAGE plpgsql
AS $$
DECLARE
  result_record RECORD;
BEGIN
  INSERT INTO user_profiles (
    user_id, weight, height, age, gender, activity_level, goal,
    target_weight, target_calories, notes, professional_mode,
    medical_history, lifestyle, health_awareness
  )
  VALUES (
    p_user_id, p_weight, p_height, p_age, p_gender, p_activity_level, p_goal,
    p_target_weight, p_target_calories, p_notes, p_professional_mode,
    p_medical_history, p_lifestyle, p_health_awareness
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    weight = COALESCE(EXCLUDED.weight, user_profiles.weight),
    height = COALESCE(EXCLUDED.height, user_profiles.height),
    age = COALESCE(EXCLUDED.age, user_profiles.age),
    gender = COALESCE(EXCLUDED.gender, user_profiles.gender),
    activity_level = COALESCE(EXCLUDED.activity_level, user_profiles.activity_level),
    goal = COALESCE(EXCLUDED.goal, user_profiles.goal),
    target_weight = COALESCE(EXCLUDED.target_weight, user_profiles.target_weight),
    target_calories = COALESCE(EXCLUDED.target_calories, user_profiles.target_calories),
    notes = COALESCE(EXCLUDED.notes, user_profiles.notes),
    professional_mode = COALESCE(EXCLUDED.professional_mode, user_profiles.professional_mode),
    medical_history = COALESCE(EXCLUDED.medical_history, user_profiles.medical_history),
    lifestyle = COALESCE(EXCLUDED.lifestyle, user_profiles.lifestyle),
    health_awareness = COALESCE(EXCLUDED.health_awareness, user_profiles.health_awareness),
    updated_at = NOW()
  RETURNING user_profiles.id, user_profiles.updated_at INTO result_record;

  RETURN QUERY SELECT result_record.id, result_record.updated_at;
END;
$$;

-- ========================================
-- 2. 日志管理函数（支持乐观锁和逻辑删除）
-- ========================================

-- 支持乐观锁的日志更新函数
CREATE OR REPLACE FUNCTION upsert_log_patch(
  p_user_id uuid,
  p_date date,
  p_log_data_patch jsonb,
  p_last_modified timestamp with time zone,
  p_based_on_modified timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(success boolean, conflict_resolved boolean, final_modified timestamp with time zone)
LANGUAGE plpgsql
AS $$
DECLARE
  current_modified timestamp with time zone;
  current_data jsonb;
  merged_data jsonb;
  conflict_detected boolean := FALSE;
  deleted_food_ids jsonb;
  deleted_exercise_ids jsonb;
BEGIN
  -- 🔒 获取当前记录（带行锁防止并发冲突）
  SELECT last_modified, log_data INTO current_modified, current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date
  FOR UPDATE;

  -- 🔍 乐观锁冲突检测
  IF current_modified IS NOT NULL THEN
    IF p_based_on_modified IS NOT NULL THEN
      -- ✅ 新的乐观锁逻辑：检查服务器版本是否比客户端基于的版本新
      IF current_modified > p_based_on_modified THEN
        conflict_detected := TRUE;
        RAISE NOTICE 'Conflict detected: server_time=%, client_based_on=%, using smart merge', current_modified, p_based_on_modified;
      END IF;
    ELSE
      -- 🔄 旧的逻辑（向后兼容）
      IF current_modified > p_last_modified THEN
        conflict_detected := TRUE;
        RAISE NOTICE 'Conflict detected (legacy mode): server_time=%, client_time=%', current_modified, p_last_modified;
      END IF;
    END IF;
  END IF;

  -- 提取和合并删除的ID列表
  deleted_food_ids := COALESCE(current_data->'deletedFoodIds', '[]'::jsonb);
  deleted_exercise_ids := COALESCE(current_data->'deletedExerciseIds', '[]'::jsonb);

  -- 如果补丁包含新的删除ID，合并它们
  IF p_log_data_patch ? 'deletedFoodIds' THEN
    deleted_food_ids := deleted_food_ids || p_log_data_patch->'deletedFoodIds';
  END IF;

  IF p_log_data_patch ? 'deletedExerciseIds' THEN
    deleted_exercise_ids := deleted_exercise_ids || p_log_data_patch->'deletedExerciseIds';
  END IF;

  -- 初始化合并数据
  merged_data := COALESCE(current_data, '{}'::jsonb);

  -- 🧠 智能合并策略（支持逻辑删除）
  IF p_log_data_patch ? 'foodEntries' THEN
    merged_data := jsonb_set(
      merged_data,
      '{foodEntries}',
      merge_arrays_by_log_id(
        current_data->'foodEntries',
        p_log_data_patch->'foodEntries',
        deleted_food_ids
      )
    );
  END IF;

  IF p_log_data_patch ? 'exerciseEntries' THEN
    merged_data := jsonb_set(
      merged_data,
      '{exerciseEntries}',
      merge_arrays_by_log_id(
        current_data->'exerciseEntries',
        p_log_data_patch->'exerciseEntries',
        deleted_exercise_ids
      )
    );
  END IF;

  -- 合并其他字段（排除特殊处理的字段）
  merged_data := merged_data || (p_log_data_patch - 'foodEntries' - 'exerciseEntries' - 'deletedFoodIds' - 'deletedExerciseIds');

  -- 确保 merged_data 不为空
  IF merged_data IS NULL THEN
    merged_data := '{}'::jsonb;
  END IF;

  -- 保存删除的ID列表（墓碑记录）
  merged_data := jsonb_set(merged_data, '{deletedFoodIds}', deleted_food_ids);
  merged_data := jsonb_set(merged_data, '{deletedExerciseIds}', deleted_exercise_ids);

  -- 确保最终数据不为空
  IF merged_data IS NULL OR merged_data = 'null'::jsonb THEN
    merged_data := jsonb_build_object(
      'deletedFoodIds', deleted_food_ids,
      'deletedExerciseIds', deleted_exercise_ids
    );
  END IF;

  -- 🔒 原子性更新或插入
  INSERT INTO daily_logs (user_id, date, log_data, last_modified)
  VALUES (
    p_user_id,
    p_date,
    merged_data,
    GREATEST(COALESCE(current_modified, p_last_modified), p_last_modified)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = EXCLUDED.log_data,
    last_modified = EXCLUDED.last_modified;

  -- 返回最终的修改时间
  SELECT last_modified INTO current_modified
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date;

  RETURN QUERY SELECT TRUE, conflict_detected, current_modified;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::timestamp with time zone;
END;
$$;

-- 简化版本的日志更新函数（向后兼容）
CREATE OR REPLACE FUNCTION upsert_log_patch(
  p_user_id uuid,
  p_date date,
  p_patch_data jsonb,
  p_deleted_ids jsonb DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
AS $$
DECLARE
  result_record RECORD;
BEGIN
  -- 调用完整版本的函数
  SELECT * INTO result_record
  FROM upsert_log_patch(p_user_id, p_date, p_patch_data, NOW(), NULL);

  IF result_record.success THEN
    RETURN QUERY SELECT TRUE, 'Log updated successfully'::text;
  ELSE
    RETURN QUERY SELECT FALSE, 'Log update failed'::text;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::text;
END;
$$;

-- ========================================
-- 3. 使用量控制函数（基于 daily_logs 表）
-- ========================================

-- 🔒 原子性使用量检查和递增函数（核心安全控制）
CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_user_id uuid,
  p_usage_type text,
  p_daily_limit integer
)
RETURNS TABLE(allowed boolean, new_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  current_count integer := 0;
  new_count integer := 0;
BEGIN
  -- 🔒 获取当前使用量（带行锁防止并发）
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE; -- 🔒 行级锁确保原子性

  -- 🚫 严格检查限额 - 绝对不允许超过
  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  -- ✅ 未超过限额，原子性递增
  new_count := current_count + 1;

  -- 🔒 原子性更新或插入
  INSERT INTO daily_logs (user_id, date, log_data, last_modified)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object(p_usage_type, new_count),
    NOW()
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = daily_logs.log_data || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW();

  -- ✅ 返回成功结果
  RETURN QUERY SELECT TRUE, new_count;
END;
$$;

-- 🔄 回滚函数（AI请求失败时使用）
CREATE OR REPLACE FUNCTION decrement_usage_count(
  p_user_id uuid,
  p_usage_type text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  current_count integer := 0;
  new_count integer := 0;
BEGIN
  -- 获取当前计数
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- 只有大于0才减少
  IF current_count > 0 THEN
    new_count := current_count - 1;

    UPDATE daily_logs
    SET log_data = log_data || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    RETURN new_count;
  END IF;

  RETURN current_count;
END;
$$;

-- 获取用户今日使用量的函数
CREATE OR REPLACE FUNCTION get_user_today_usage(
  p_user_id uuid,
  p_usage_type text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  usage_count integer := 0;
BEGIN
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO usage_count
  FROM daily_logs
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE;

  RETURN COALESCE(usage_count, 0);
END;
$$;

-- ========================================
-- 4. AI记忆管理函数
-- ========================================

-- 获取用户AI记忆
CREATE OR REPLACE FUNCTION get_user_ai_memories(p_user_id uuid)
RETURNS TABLE(
  expert_id text,
  content text,
  version integer,
  last_updated timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.expert_id::TEXT,
    am.content,
    am.version,
    am.last_updated
  FROM ai_memories am
  WHERE am.user_id = p_user_id
  ORDER BY am.last_updated DESC;
END;
$$;

-- 更新AI记忆
CREATE OR REPLACE FUNCTION upsert_ai_memories(
  p_user_id uuid,
  p_expert_id text,
  p_content text
)
RETURNS TABLE(success boolean, version integer)
LANGUAGE plpgsql
AS $$
DECLARE
  new_version INTEGER;
BEGIN
  INSERT INTO ai_memories (user_id, expert_id, content, version)
  VALUES (p_user_id, p_expert_id, p_content, 1)
  ON CONFLICT (user_id, expert_id)
  DO UPDATE SET
    content = EXCLUDED.content,
    version = ai_memories.version + 1,
    last_updated = NOW()
  RETURNING ai_memories.version INTO new_version;

  RETURN QUERY SELECT true, new_version;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, 0;
END;
$$;

-- 清理旧的AI记忆
CREATE OR REPLACE FUNCTION cleanup_old_ai_memories(days_to_keep integer DEFAULT 90)
RETURNS TABLE(deleted_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  result_count INTEGER;
BEGIN
  DELETE FROM ai_memories
  WHERE last_updated < NOW() - INTERVAL '1 day' * days_to_keep;

  GET DIAGNOSTICS result_count = ROW_COUNT;
  RETURN QUERY SELECT result_count;
END;
$$;

-- ========================================
-- 5. 共享密钥管理函数（保持原有逻辑）
-- ========================================

-- 原子性共享密钥使用量检查和增加
CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_shared_key_id uuid,
  p_increment integer DEFAULT 1
)
RETURNS TABLE(success boolean, current_usage integer, daily_limit integer)
LANGUAGE plpgsql
AS $$
DECLARE
  key_record RECORD;
BEGIN
  -- 使用 FOR UPDATE 锁定行，防止并发问题
  SELECT sk.usage_count_today, sk.daily_limit, sk.is_active
  INTO key_record
  FROM shared_keys sk
  WHERE sk.id = p_shared_key_id
  FOR UPDATE;

  -- 检查密钥是否存在且活跃
  IF NOT FOUND OR NOT key_record.is_active THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  -- 检查是否超过限制
  IF key_record.usage_count_today + p_increment > key_record.daily_limit THEN
    RETURN QUERY SELECT false, key_record.usage_count_today, key_record.daily_limit;
    RETURN;
  END IF;

  -- 增加使用量
  UPDATE shared_keys
  SET
    usage_count_today = usage_count_today + p_increment,
    total_usage_count = total_usage_count + p_increment,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = p_shared_key_id;

  RETURN QUERY SELECT true, key_record.usage_count_today + p_increment, key_record.daily_limit;
END;
$$;

-- 减少使用量（用于错误回滚）
CREATE OR REPLACE FUNCTION decrement_usage_count(
  p_shared_key_id uuid,
  p_decrement integer DEFAULT 1
)
RETURNS TABLE(success boolean, current_usage integer)
LANGUAGE plpgsql
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  UPDATE shared_keys
  SET
    usage_count_today = GREATEST(0, usage_count_today - p_decrement),
    total_usage_count = GREATEST(0, total_usage_count - p_decrement),
    updated_at = NOW()
  WHERE id = p_shared_key_id AND is_active = true
  RETURNING usage_count_today INTO current_count;

  IF FOUND THEN
    RETURN QUERY SELECT true, current_count;
  ELSE
    RETURN QUERY SELECT false, 0;
  END IF;
END;
$$;

-- 增加共享密钥使用量（简化版本）
CREATE OR REPLACE FUNCTION increment_shared_key_usage(p_shared_key_id uuid)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
AS $$
DECLARE
  result_record RECORD;
BEGIN
  SELECT * INTO result_record
  FROM atomic_usage_check_and_increment(p_shared_key_id, 1);

  IF result_record.success THEN
    RETURN QUERY SELECT true, 'Usage incremented successfully'::text;
  ELSE
    RETURN QUERY SELECT false, 'Usage limit exceeded or key inactive'::text;
  END IF;
END;
$$;

-- 获取用户共享密钥使用情况
CREATE OR REPLACE FUNCTION get_user_shared_key_usage(p_user_id uuid)
RETURNS TABLE(
  key_id uuid,
  key_name text,
  usage_count_today integer,
  daily_limit integer,
  usage_percentage numeric,
  last_used_at timestamp without time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sk.id,
    sk.name,
    sk.usage_count_today,
    sk.daily_limit,
    ROUND((sk.usage_count_today::numeric / sk.daily_limit::numeric) * 100, 2),
    sk.last_used_at
  FROM shared_keys sk
  WHERE sk.user_id = p_user_id AND sk.is_active = true
  ORDER BY sk.usage_count_today DESC;
END;
$$;

-- 获取用户今日总使用量
CREATE OR REPLACE FUNCTION get_user_today_usage(p_user_id uuid)
RETURNS TABLE(
  total_usage integer,
  total_limit integer,
  usage_percentage numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_used INTEGER := 0;
  total_allowed INTEGER := 0;
BEGIN
  SELECT
    COALESCE(SUM(usage_count_today), 0),
    COALESCE(SUM(daily_limit), 0)
  INTO total_used, total_allowed
  FROM shared_keys
  WHERE user_id = p_user_id AND is_active = true;

  RETURN QUERY SELECT
    total_used,
    total_allowed,
    CASE
      WHEN total_allowed > 0 THEN ROUND((total_used::numeric / total_allowed::numeric) * 100, 2)
      ELSE 0::numeric
    END;
END;
$$;

-- 重置共享密钥每日使用量
CREATE OR REPLACE FUNCTION reset_shared_keys_daily()
RETURNS TABLE(reset_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE shared_keys
  SET
    usage_count_today = 0,
    updated_at = NOW()
  WHERE usage_count_today > 0;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  -- 记录重置事件
  INSERT INTO security_events (event_type, severity, details)
  VALUES (
    'DAILY_USAGE_RESET',
    1,
    jsonb_build_object(
      'reset_count', affected_rows,
      'timestamp', NOW()
    )
  );

  RETURN QUERY SELECT affected_rows;
END;
$$;

-- ========================================
-- 7. 数据迁移和维护函数
-- ========================================

-- 迁移 model_name 到 available_models 数组
CREATE OR REPLACE FUNCTION migrate_model_name_to_available_models()
RETURNS TABLE(migrated_count integer, error_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  migrated_rows integer := 0;
  error_rows integer := 0;
  key_record RECORD;
BEGIN
  -- 检查是否存在 model_name 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shared_keys'
    AND column_name = 'model_name'
    AND table_schema = 'public'
  ) THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- 迁移数据
  FOR key_record IN
    SELECT id, model_name, available_models
    FROM shared_keys
    WHERE model_name IS NOT NULL
    AND (available_models IS NULL OR array_length(available_models, 1) = 0)
  LOOP
    BEGIN
      UPDATE shared_keys
      SET available_models = ARRAY[key_record.model_name]
      WHERE id = key_record.id;

      migrated_rows := migrated_rows + 1;
    EXCEPTION
      WHEN OTHERS THEN
        error_rows := error_rows + 1;
        RAISE NOTICE 'Error migrating key %: %', key_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT migrated_rows, error_rows;
END;
$$;

-- 清理旧数据和优化函数
CREATE OR REPLACE FUNCTION cleanup_and_optimize_database()
RETURNS TABLE(
  cleaned_logs integer,
  cleaned_memories integer,
  cleaned_events integer,
  optimized_tables integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned_log_count integer := 0;
  cleaned_memory_count integer := 0;
  cleaned_event_count integer := 0;
  table_count integer := 0;
BEGIN
  -- 清理超过6个月的日志（保留重要数据）
  DELETE FROM daily_logs
  WHERE date < CURRENT_DATE - INTERVAL '6 months'
  AND NOT (log_data ? 'important' AND (log_data->>'important')::boolean = true);

  GET DIAGNOSTICS cleaned_log_count = ROW_COUNT;

  -- 清理超过3个月的AI记忆
  SELECT * INTO cleaned_memory_count
  FROM cleanup_old_ai_memories(90);

  -- 清理超过1年的安全事件（保留重要事件）
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '1 year'
  AND severity <= 2;

  GET DIAGNOSTICS cleaned_event_count = ROW_COUNT;

  -- 优化表（重建索引和更新统计信息）
  ANALYZE users;
  ANALYZE user_profiles;
  ANALYZE shared_keys;
  ANALYZE daily_logs;
  ANALYZE ai_memories;
  ANALYZE security_events;

  table_count := 6;

  -- 记录清理事件
  INSERT INTO security_events (event_type, severity, details)
  VALUES (
    'DATABASE_CLEANUP_COMPLETED',
    1,
    jsonb_build_object(
      'cleaned_logs', cleaned_log_count,
      'cleaned_memories', cleaned_memory_count,
      'cleaned_events', cleaned_event_count,
      'optimized_tables', table_count,
      'timestamp', NOW()
    )
  );

  RETURN QUERY SELECT cleaned_log_count, cleaned_memory_count, cleaned_event_count, table_count;
END;
$$;
