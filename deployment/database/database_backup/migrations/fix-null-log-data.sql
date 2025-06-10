-- 🔧 修复 log_data 为 NULL 的问题
-- 这个脚本解决了 upsert_log_patch 函数中可能产生 NULL log_data 的问题

-- 1. 首先清理现有的 NULL 数据
-- ================================

UPDATE daily_logs 
SET log_data = '{}'::jsonb 
WHERE log_data IS NULL;

-- 2. 重新创建修复后的 upsert_log_patch 函数
-- =============================================

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

  -- 确保 current_data 不为空
  current_data := COALESCE(current_data, '{}'::jsonb);

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

  -- 提取删除的ID列表，确保不为空
  deleted_food_ids := COALESCE(current_data->'deletedFoodIds', '[]'::jsonb);
  deleted_exercise_ids := COALESCE(current_data->'deletedExerciseIds', '[]'::jsonb);

  -- 如果补丁包含新的删除ID，合并它们
  IF p_log_data_patch ? 'deletedFoodIds' THEN
    deleted_food_ids := deleted_food_ids || COALESCE(p_log_data_patch->'deletedFoodIds', '[]'::jsonb);
  END IF;

  IF p_log_data_patch ? 'deletedExerciseIds' THEN
    deleted_exercise_ids := deleted_exercise_ids || COALESCE(p_log_data_patch->'deletedExerciseIds', '[]'::jsonb);
  END IF;

  -- 初始化 merged_data
  merged_data := COALESCE(current_data, '{}'::jsonb);

  IF conflict_detected THEN
    -- 🧠 智能合并策略（支持逻辑删除）
    
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

  -- 最终安全检查：确保数据不为空
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

-- 3. 验证修复
-- ============

DO $$
BEGIN
  -- 检查是否还有 NULL 的 log_data
  IF EXISTS (SELECT 1 FROM daily_logs WHERE log_data IS NULL) THEN
    RAISE EXCEPTION '❌ Still have NULL log_data records';
  ELSE
    RAISE NOTICE '✅ All log_data records are non-NULL';
  END IF;

  -- 检查函数是否正确更新
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'upsert_log_patch'
    AND p.pronargs = 5
    AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE '✅ upsert_log_patch function updated successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to update upsert_log_patch function';
  END IF;
END;
$$;
