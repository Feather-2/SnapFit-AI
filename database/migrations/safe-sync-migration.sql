-- 🔄 安全的同步系统迁移脚本
-- 执行前请备份数据库！
-- 这个版本不会创建测试数据，避免外键约束问题

-- 0. 清理可能存在的旧函数
-- ========================

DROP FUNCTION IF EXISTS upsert_log_patch(UUID, DATE, JSONB, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS merge_arrays_by_log_id(JSONB, JSONB);
DROP FUNCTION IF EXISTS remove_log_entry(UUID, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS atomic_usage_check_and_increment(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS decrement_usage_count(UUID, TEXT);

-- 1. 添加缺少的约束和索引
-- ================================

-- daily_logs 表优化
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'daily_logs_user_date_unique'
    ) THEN
        ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_user_date_unique UNIQUE (user_id, date);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_last_modified ON daily_logs(last_modified);

-- ai_memories 表优化
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ai_memories_user_expert_unique'
    ) THEN
        ALTER TABLE ai_memories ADD CONSTRAINT ai_memories_user_expert_unique UNIQUE (user_id, expert_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_expert_id ON ai_memories(expert_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_last_updated ON ai_memories(last_updated);

-- 2. 创建智能数组合并函数
-- ========================

CREATE OR REPLACE FUNCTION merge_arrays_by_log_id(
  existing_array JSONB,
  new_array JSONB
)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '[]'::jsonb;
  existing_item JSONB;
  new_item JSONB;
  existing_ids TEXT[];
  new_ids TEXT[];
  all_ids TEXT[];
  item_id TEXT;
BEGIN
  IF existing_array IS NULL OR jsonb_array_length(existing_array) = 0 THEN
    RETURN COALESCE(new_array, '[]'::jsonb);
  END IF;

  IF new_array IS NULL OR jsonb_array_length(new_array) = 0 THEN
    RETURN existing_array;
  END IF;

  SELECT array_agg(DISTINCT item->>'log_id') INTO existing_ids
  FROM jsonb_array_elements(existing_array) AS item
  WHERE item->>'log_id' IS NOT NULL;

  SELECT array_agg(DISTINCT item->>'log_id') INTO new_ids
  FROM jsonb_array_elements(new_array) AS item
  WHERE item->>'log_id' IS NOT NULL;

  SELECT array_agg(DISTINCT unnest) INTO all_ids
  FROM unnest(COALESCE(existing_ids, ARRAY[]::TEXT[]) || COALESCE(new_ids, ARRAY[]::TEXT[])) AS unnest;

  FOR item_id IN SELECT unnest(COALESCE(all_ids, ARRAY[]::TEXT[]))
  LOOP
    SELECT item INTO new_item
    FROM jsonb_array_elements(new_array) AS item
    WHERE item->>'log_id' = item_id
    LIMIT 1;

    IF new_item IS NOT NULL THEN
      result := result || jsonb_build_array(new_item);
    ELSE
      SELECT item INTO existing_item
      FROM jsonb_array_elements(existing_array) AS item
      WHERE item->>'log_id' = item_id
      LIMIT 1;

      IF existing_item IS NOT NULL THEN
        result := result || jsonb_build_array(existing_item);
      END IF;
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建JSONB深度合并函数
-- ========================

CREATE OR REPLACE FUNCTION jsonb_deep_merge(jsonb1 JSONB, jsonb2 JSONB)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;

-- 4. 创建安全的日志补丁更新函数 (使用深度合并)
-- ==========================================

CREATE OR REPLACE FUNCTION upsert_log_patch(
  p_user_id UUID,
  p_date DATE,
  p_log_data_patch JSONB,
  p_last_modified TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(success BOOLEAN, conflict_resolved BOOLEAN, final_modified TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
  current_modified TIMESTAMP WITH TIME ZONE;
  current_data JSONB;
  merged_data JSONB;
  conflict_detected BOOLEAN := FALSE;
BEGIN
  SELECT last_modified, log_data INTO current_modified, current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date
  FOR UPDATE;

  IF current_modified IS NOT NULL AND current_modified > p_last_modified THEN
    conflict_detected := TRUE;
    merged_data := COALESCE(current_data, '{}'::jsonb);

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

    -- 使用深度合并来处理其他字段，避免数据丢失
    merged_data := jsonb_deep_merge(merged_data, (p_log_data_patch - 'foodEntries' - 'exerciseEntries'));
  ELSE
    merged_data := COALESCE(current_data, '{}'::jsonb);

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

    -- 使用深度合并来处理其他字段
    merged_data := jsonb_deep_merge(merged_data, (p_log_data_patch - 'foodEntries' - 'exerciseEntries'));
  END IF;

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

  SELECT last_modified INTO current_modified
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date;

  RETURN QUERY SELECT TRUE, conflict_detected, current_modified;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建安全删除条目函数
-- ========================

CREATE OR REPLACE FUNCTION remove_log_entry(
  p_user_id UUID,
  p_date DATE,
  p_entry_type TEXT,
  p_log_id TEXT
)
RETURNS TABLE(success BOOLEAN, entries_remaining INTEGER) AS $$
DECLARE
  current_data JSONB;
  updated_array JSONB;
  field_name TEXT;
BEGIN
  IF p_entry_type = 'food' THEN
    field_name := 'foodEntries';
  ELSIF p_entry_type = 'exercise' THEN
    field_name := 'exerciseEntries';
  ELSE
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  SELECT log_data INTO current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = p_date
  FOR UPDATE;

  IF current_data IS NULL THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  SELECT jsonb_agg(item) INTO updated_array
  FROM jsonb_array_elements(current_data->field_name) AS item
  WHERE item->>'log_id' != p_log_id;

  UPDATE daily_logs
  SET
    log_data = jsonb_set(log_data, ('{' || field_name || '}')::text[], COALESCE(updated_array, '[]'::jsonb)),
    last_modified = NOW()
  WHERE user_id = p_user_id AND date = p_date;

  RETURN QUERY SELECT TRUE, COALESCE(jsonb_array_length(updated_array), 0);
END;
$$ LANGUAGE plpgsql;

-- 6. 创建使用量控制函数
-- ====================

CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_user_id UUID,
  p_usage_type TEXT,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, new_count INTEGER) AS $$
DECLARE
  current_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  SELECT COALESCE(
    CASE
      WHEN (log_data->>p_usage_type) IS NULL THEN 0
      WHEN (log_data->>p_usage_type) = 'null' THEN 0
      ELSE (log_data->>p_usage_type)::int
    END,
    0
  )
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE;

  current_count := COALESCE(current_count, 0);

  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  new_count := current_count + 1;

  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object(p_usage_type, new_count)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = COALESCE(daily_logs.log_data, '{}'::jsonb) || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW();

  RETURN QUERY SELECT TRUE, new_count;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建回滚函数
-- ===============

CREATE OR REPLACE FUNCTION decrement_usage_count(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE;

  new_count := GREATEST(current_count - 1, 0);

  UPDATE daily_logs
  SET
    log_data = COALESCE(log_data, '{}'::jsonb) || jsonb_build_object(p_usage_type, new_count),
    last_modified = NOW()
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- 8. 清理现有数据中的 null 值
-- ===========================

UPDATE daily_logs
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{conversation_count}',
  '0'::jsonb
)
WHERE log_data->>'conversation_count' IS NULL
   OR log_data->>'conversation_count' = 'null';

UPDATE daily_logs
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{api_call_count}',
  '0'::jsonb
)
WHERE log_data->>'api_call_count' IS NULL
   OR log_data->>'api_call_count' = 'null';

UPDATE daily_logs
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{upload_count}',
  '0'::jsonb
)
WHERE log_data->>'upload_count' IS NULL
   OR log_data->>'upload_count' = 'null';

-- 9. 简单验证（不创建测试数据）
-- ============================

DO $$
DECLARE
  merge_result JSONB;
  function_count INTEGER;
BEGIN
  -- 测试数组合并函数
  SELECT merge_arrays_by_log_id(
    '[{"log_id": "1", "name": "test1"}]'::jsonb,
    '[{"log_id": "2", "name": "test2"}]'::jsonb
  ) INTO merge_result;

  IF jsonb_array_length(merge_result) = 2 THEN
    RAISE NOTICE '✅ merge_arrays_by_log_id function working correctly';
  ELSE
    RAISE EXCEPTION '❌ merge_arrays_by_log_id function failed';
  END IF;

  -- 检查所有函数是否创建成功
  SELECT count(*) INTO function_count
  FROM pg_proc
  WHERE proname IN (
    'merge_arrays_by_log_id',
    'jsonb_deep_merge',
    'upsert_log_patch',
    'remove_log_entry',
    'atomic_usage_check_and_increment',
    'decrement_usage_count'
  );

  IF function_count = 6 THEN
    RAISE NOTICE '✅ All 6 functions created successfully';
  ELSE
    RAISE EXCEPTION '❌ Only % functions created, expected 6', function_count;
  END IF;

  RAISE NOTICE '🎉 Migration completed successfully!';
END $$;

-- 10. 设置权限和注释
-- =================

GRANT EXECUTE ON FUNCTION merge_arrays_by_log_id(JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION jsonb_deep_merge(JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_log_patch(UUID, DATE, JSONB, TIMESTAMP WITH TIME ZONE) TO service_role;
GRANT EXECUTE ON FUNCTION remove_log_entry(UUID, DATE, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION atomic_usage_check_and_increment(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_usage_count(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION merge_arrays_by_log_id(JSONB, JSONB) IS '智能合并数组，基于log_id去重';
COMMENT ON FUNCTION jsonb_deep_merge(JSONB, JSONB) IS '递归深度合并两个JSONB对象';
COMMENT ON FUNCTION upsert_log_patch(UUID, DATE, JSONB, TIMESTAMP WITH TIME ZONE) IS '安全的日志补丁更新，支持冲突检测和深度合并';
COMMENT ON FUNCTION remove_log_entry(UUID, DATE, TEXT, TEXT) IS '安全删除日志条目';
COMMENT ON FUNCTION atomic_usage_check_and_increment(UUID, TEXT, INTEGER) IS '原子性使用量检查和递增';
COMMENT ON FUNCTION decrement_usage_count(UUID, TEXT) IS '使用量回滚函数';

-- 🎉 完成！
-- ========

SELECT
  '🎉 Safe migration completed! Functions: ' || count(*) ||
  ' | Ready for production use!' as result
FROM pg_proc
WHERE proname IN (
  'merge_arrays_by_log_id',
  'jsonb_deep_merge',
  'upsert_log_patch',
  'remove_log_entry',
  'atomic_usage_check_and_increment',
  'decrement_usage_count'
);
