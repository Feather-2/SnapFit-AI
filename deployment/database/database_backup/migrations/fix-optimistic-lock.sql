-- 🔧 修复乐观锁检查逻辑
-- 这个迁移修复了 upsert_log_patch 函数中的乐观锁检查缺陷
--
-- 问题：之前的实现使用新创建的时间戳进行冲突检查，导致冲突检测失效
-- 解决：添加 based_on_modified 参数，使用客户端基于的版本时间戳进行正确的冲突检测

-- 1. 更新 upsert_log_patch 函数以支持正确的乐观锁检查
-- ================================================================

CREATE OR REPLACE FUNCTION upsert_log_patch(
  p_user_id UUID,
  p_date DATE,
  p_log_data_patch JSONB,
  p_last_modified TIMESTAMP WITH TIME ZONE,
  p_based_on_modified TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, conflict_resolved BOOLEAN, final_modified TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
  current_modified TIMESTAMP WITH TIME ZONE;
  current_data JSONB;
  merged_data JSONB;
  conflict_detected BOOLEAN := FALSE;
BEGIN
  -- 🔒 获取当前记录（带行锁）
  SELECT last_modified, log_data INTO current_modified, current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date
  FOR UPDATE;

  -- 🔍 检测冲突：使用基于的版本时间戳进行检查
  -- 如果提供了 p_based_on_modified，则使用它进行冲突检测
  -- 否则回退到旧的逻辑（向后兼容）
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

  IF conflict_detected THEN
    -- 🧠 智能合并策略
    merged_data := COALESCE(current_data, '{}'::jsonb);

    -- 对于数组字段，使用智能合并
    IF p_log_data_patch ? 'foodEntries' THEN
      merged_data := jsonb_set(
        merged_data,
        '{foodEntries}',
        merge_arrays_by_log_id(
          current_data->'foodEntries',
          p_log_data_patch->'foodEntries'
        )
      );
    END IF;

    IF p_log_data_patch ? 'exerciseEntries' THEN
      merged_data := jsonb_set(
        merged_data,
        '{exerciseEntries}',
        merge_arrays_by_log_id(
          current_data->'exerciseEntries',
          p_log_data_patch->'exerciseEntries'
        )
      );
    END IF;

    -- 对于非数组字段，使用补丁覆盖
    merged_data := merged_data || (p_log_data_patch - 'foodEntries' - 'exerciseEntries');

  ELSE
    -- 无冲突，直接合并
    merged_data := COALESCE(current_data, '{}'::jsonb);

    -- 安全合并数组字段
    IF p_log_data_patch ? 'foodEntries' THEN
      merged_data := jsonb_set(
        merged_data,
        '{foodEntries}',
        merge_arrays_by_log_id(
          current_data->'foodEntries',
          p_log_data_patch->'foodEntries'
        )
      );
    END IF;

    IF p_log_data_patch ? 'exerciseEntries' THEN
      merged_data := jsonb_set(
        merged_data,
        '{exerciseEntries}',
        merge_arrays_by_log_id(
          current_data->'exerciseEntries',
          p_log_data_patch->'exerciseEntries'
        )
      );
    END IF;

    -- 合并其他字段
    merged_data := merged_data || (p_log_data_patch - 'foodEntries' - 'exerciseEntries');
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
END;
$$ LANGUAGE plpgsql;

-- 2. 测试函数更新
-- ================

DO $$
BEGIN
  -- 检查函数是否正确更新
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'upsert_log_patch'
    AND p.pronargs = 5  -- 现在应该有5个参数
    AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE '✅ upsert_log_patch function updated successfully with optimistic lock fix';
  ELSE
    RAISE EXCEPTION '❌ Failed to update upsert_log_patch function';
  END IF;
END;
$$;

-- 3. 添加注释说明
-- ================

COMMENT ON FUNCTION upsert_log_patch(UUID, DATE, JSONB, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS
'Updated function with proper optimistic locking. Uses based_on_modified parameter for conflict detection instead of the new timestamp, preventing the bypass of conflict detection mechanism.';

-- 4. 添加逻辑删除支持（墓碑记录）
-- =====================================

-- 更新 merge_arrays_by_log_id 函数以支持逻辑删除
CREATE OR REPLACE FUNCTION merge_arrays_by_log_id(
  existing_array JSONB,
  new_array JSONB,
  deleted_ids JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
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
  -- 如果任一数组为空，返回另一个（但要过滤已删除的）
  IF existing_array IS NULL OR jsonb_array_length(existing_array) = 0 THEN
    IF new_array IS NULL OR jsonb_array_length(new_array) = 0 THEN
      RETURN '[]'::jsonb;
    END IF;
    -- 过滤已删除的条目
    IF deleted_ids IS NOT NULL AND jsonb_array_length(deleted_ids) > 0 THEN
      SELECT array_agg(value::text) INTO deleted_ids_array
      FROM jsonb_array_elements_text(deleted_ids);

      SELECT jsonb_agg(item)
      INTO result
      FROM jsonb_array_elements(new_array) AS item
      WHERE NOT (deleted_ids_array @> ARRAY[item->>'log_id']);

      RETURN COALESCE(result, '[]'::jsonb);
    END IF;
    RETURN new_array;
  END IF;

  IF new_array IS NULL OR jsonb_array_length(new_array) = 0 THEN
    -- 过滤已删除的条目
    IF deleted_ids IS NOT NULL AND jsonb_array_length(deleted_ids) > 0 THEN
      SELECT array_agg(value::text) INTO deleted_ids_array
      FROM jsonb_array_elements_text(deleted_ids);

      SELECT jsonb_agg(item)
      INTO result
      FROM jsonb_array_elements(existing_array) AS item
      WHERE NOT (deleted_ids_array @> ARRAY[item->>'log_id']);

      RETURN COALESCE(result, '[]'::jsonb);
    END IF;
    RETURN existing_array;
  END IF;

  -- 获取已删除的ID列表
  IF deleted_ids IS NOT NULL AND jsonb_array_length(deleted_ids) > 0 THEN
    SELECT array_agg(value::text) INTO deleted_ids_array
    FROM jsonb_array_elements_text(deleted_ids);
  ELSE
    deleted_ids_array := ARRAY[]::TEXT[];
  END IF;

  -- 获取现有和新数组的所有ID
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

  -- 为每个ID选择最新版本
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
$$ LANGUAGE plpgsql;

-- 更新 upsert_log_patch 函数以支持逻辑删除
CREATE OR REPLACE FUNCTION upsert_log_patch(
  p_user_id UUID,
  p_date DATE,
  p_log_data_patch JSONB,
  p_last_modified TIMESTAMP WITH TIME ZONE,
  p_based_on_modified TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, conflict_resolved BOOLEAN, final_modified TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
  current_modified TIMESTAMP WITH TIME ZONE;
  current_data JSONB;
  merged_data JSONB;
  conflict_detected BOOLEAN := FALSE;
  deleted_food_ids JSONB;
  deleted_exercise_ids JSONB;
BEGIN
  -- 🔒 获取当前记录（带行锁）
  SELECT last_modified, log_data INTO current_modified, current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date
  FOR UPDATE;

  -- 🔍 检测冲突：使用基于的版本时间戳进行检查
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

  -- 提取删除的ID列表
  deleted_food_ids := COALESCE(current_data->'deletedFoodIds', '[]'::jsonb);
  deleted_exercise_ids := COALESCE(current_data->'deletedExerciseIds', '[]'::jsonb);

  -- 如果补丁包含新的删除ID，合并它们
  IF p_log_data_patch ? 'deletedFoodIds' THEN
    deleted_food_ids := deleted_food_ids || p_log_data_patch->'deletedFoodIds';
  END IF;

  IF p_log_data_patch ? 'deletedExerciseIds' THEN
    deleted_exercise_ids := deleted_exercise_ids || p_log_data_patch->'deletedExerciseIds';
  END IF;

  IF conflict_detected THEN
    -- 🧠 智能合并策略（支持逻辑删除）
    merged_data := COALESCE(current_data, '{}'::jsonb);

    -- 对于数组字段，使用支持逻辑删除的智能合并
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

    -- 对于非数组字段，使用补丁覆盖
    merged_data := merged_data || (p_log_data_patch - 'foodEntries' - 'exerciseEntries' - 'deletedFoodIds' - 'deletedExerciseIds');

  ELSE
    -- 无冲突，直接合并（支持逻辑删除）
    merged_data := COALESCE(current_data, '{}'::jsonb);

    -- 安全合并数组字段
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

    -- 合并其他字段
    merged_data := merged_data || (p_log_data_patch - 'foodEntries' - 'exerciseEntries' - 'deletedFoodIds' - 'deletedExerciseIds');
  END IF;

  -- 确保 merged_data 不为空
  IF merged_data IS NULL THEN
    merged_data := '{}'::jsonb;
  END IF;

  -- 保存删除的ID列表
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
END;
$$ LANGUAGE plpgsql;
