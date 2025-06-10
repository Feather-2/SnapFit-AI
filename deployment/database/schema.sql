

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'RLS disabled - using application-level access control with ANON_KEY + Service Role pattern. 
Security is enforced in the application layer through NextAuth.js authentication and API-level user validation.';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."atomic_usage_check_and_increment"("p_user_id" "uuid", "p_usage_type" "text", "p_daily_limit" integer) RETURNS TABLE("allowed" boolean, "new_count" integer)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."atomic_usage_check_and_increment"("p_user_id" "uuid", "p_usage_type" "text", "p_daily_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."atomic_usage_check_and_increment"("p_user_id" "uuid", "p_usage_type" "text", "p_daily_limit" integer) IS '原子性使用量检查和递增';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_ai_memories"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 删除30天前未更新的记忆
  DELETE FROM ai_memories
  WHERE last_updated < NOW() - INTERVAL '30 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_ai_memories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_usage_count"("p_user_id" "uuid", "p_usage_type" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."decrement_usage_count"("p_user_id" "uuid", "p_usage_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."decrement_usage_count"("p_user_id" "uuid", "p_usage_type" "text") IS '使用量回滚函数';



CREATE OR REPLACE FUNCTION "public"."get_user_ai_memories"("p_user_id" "uuid") RETURNS TABLE("expert_id" "text", "content" "text", "version" integer, "last_updated" timestamp with time zone)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."get_user_ai_memories"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_profile"("p_user_id" "uuid") RETURNS TABLE("weight" numeric, "height" numeric, "age" integer, "gender" "text", "activity_level" "text", "goal" "text", "target_weight" numeric, "target_calories" integer, "notes" "text", "professional_mode" boolean, "medical_history" "text", "lifestyle" "text", "health_awareness" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."get_user_profile"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_shared_key_usage"("p_user_id" "uuid", "p_days" integer DEFAULT 7) RETURNS TABLE("date" "date", "shared_key_usage" "jsonb", "total_api_calls" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    dl.date,
    COALESCE(dl.log_data->'shared_key_usage', '{}'::jsonb) as shared_key_usage,
    COALESCE((dl.log_data->>'api_call_count')::int, 0) as total_api_calls
  FROM daily_logs dl
  WHERE dl.user_id = p_user_id
    AND dl.date >= CURRENT_DATE - (p_days - 1)
    AND dl.date <= CURRENT_DATE
  ORDER BY dl.date DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_shared_key_usage"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_shared_key_usage"("p_user_id" "uuid", "p_days" integer) IS '获取用户的共享Key使用历史';



CREATE OR REPLACE FUNCTION "public"."get_user_today_usage"("p_user_id" "uuid", "p_usage_type" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  usage_count INTEGER := 0;
BEGIN
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO usage_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  RETURN COALESCE(usage_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_user_today_usage"("p_user_id" "uuid", "p_usage_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_shared_key_usage"("p_user_id" "uuid", "p_shared_key_id" "uuid", "p_model_used" "text", "p_api_endpoint" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_data JSONB;
  shared_key_usage JSONB;
  key_stats JSONB;
BEGIN
  -- 获取当前的 daily_logs 数据
  SELECT COALESCE(log_data, '{}'::jsonb)
  INTO current_data
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- 如果没有记录，初始化为空对象
  IF current_data IS NULL THEN
    current_data := '{}'::jsonb;
  END IF;

  -- 获取或初始化 shared_key_usage 对象
  shared_key_usage := COALESCE(current_data->'shared_key_usage', '{}'::jsonb);

  -- 获取或初始化特定Key的统计
  key_stats := COALESCE(shared_key_usage->p_shared_key_id::text, '{
    "total_calls": 0,
    "successful_calls": 0,
    "models_used": {},
    "endpoints_used": {},
    "last_used_at": null
  }'::jsonb);

  -- 更新统计数据
  key_stats := jsonb_set(key_stats, '{total_calls}',
    to_jsonb((key_stats->>'total_calls')::int + 1));

  key_stats := jsonb_set(key_stats, '{successful_calls}',
    to_jsonb((key_stats->>'successful_calls')::int + 1));

  key_stats := jsonb_set(key_stats, '{last_used_at}',
    to_jsonb(NOW()::text));

  -- 更新模型使用统计
  key_stats := jsonb_set(key_stats,
    ARRAY['models_used', p_model_used],
    to_jsonb(COALESCE((key_stats->'models_used'->>p_model_used)::int, 0) + 1));

  -- 更新端点使用统计
  key_stats := jsonb_set(key_stats,
    ARRAY['endpoints_used', p_api_endpoint],
    to_jsonb(COALESCE((key_stats->'endpoints_used'->>p_api_endpoint)::int, 0) + 1));

  -- 更新 shared_key_usage
  shared_key_usage := jsonb_set(shared_key_usage,
    ARRAY[p_shared_key_id::text],
    key_stats);

  -- 更新 current_data
  current_data := jsonb_set(current_data, '{shared_key_usage}', shared_key_usage);

  -- 同时增加总的 api_call_count
  current_data := jsonb_set(current_data, '{api_call_count}',
    to_jsonb(COALESCE((current_data->>'api_call_count')::int, 0) + 1));

  -- 更新或插入到 daily_logs
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (p_user_id, CURRENT_DATE, current_data)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = EXCLUDED.log_data,
    last_modified = NOW();

END;
$$;


ALTER FUNCTION "public"."increment_shared_key_usage"("p_user_id" "uuid", "p_shared_key_id" "uuid", "p_model_used" "text", "p_api_endpoint" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_shared_key_usage"("p_user_id" "uuid", "p_shared_key_id" "uuid", "p_model_used" "text", "p_api_endpoint" "text") IS '增加用户的共享Key使用统计';



CREATE OR REPLACE FUNCTION "public"."jsonb_deep_merge"("jsonb1" "jsonb", "jsonb2" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."jsonb_deep_merge"("jsonb1" "jsonb", "jsonb2" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."jsonb_deep_merge"("jsonb1" "jsonb", "jsonb2" "jsonb") IS '递归深度合并两个JSONB对象';



CREATE OR REPLACE FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb") IS '智能合并数组，基于log_id去重';



CREATE OR REPLACE FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb", "deleted_ids" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb", "deleted_ids" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_log_entry"("p_user_id" "uuid", "p_date" "date", "p_entry_type" "text", "p_log_id" "text") RETURNS TABLE("success" boolean, "entries_remaining" integer)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."remove_log_entry"("p_user_id" "uuid", "p_date" "date", "p_entry_type" "text", "p_log_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."remove_log_entry"("p_user_id" "uuid", "p_date" "date", "p_entry_type" "text", "p_log_id" "text") IS '安全删除日志条目';



CREATE OR REPLACE FUNCTION "public"."reset_shared_keys_daily"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- 重置所有活跃共享密钥的今日使用量
  UPDATE shared_keys 
  SET usage_count_today = 0, 
      updated_at = NOW() 
  WHERE is_active = true 
    AND usage_count_today > 0;
  
  -- 获取重置的数量
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- 简单的日志记录（使用RAISE NOTICE而不是插入表）
  RAISE NOTICE 'Daily shared keys reset completed. Reset % keys at %', reset_count, NOW();
  
  -- 可选：如果security_events表存在，则记录
  BEGIN
    INSERT INTO security_events (
      event_type, 
      severity, 
      details
    ) VALUES (
      'DAILY_SHARED_KEYS_RESET',
      1,
      jsonb_build_object(
        'reset_count', reset_count,
        'timestamp', NOW()
      )
    );
  EXCEPTION 
    WHEN undefined_table THEN
      -- 如果表不存在，忽略错误
      RAISE NOTICE 'security_events table not found, skipping log insertion';
  END;
END;
$$;


ALTER FUNCTION "public"."reset_shared_keys_daily"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ai_memories_modified"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.last_updated = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ai_memories_modified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profiles_modified"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_profiles_modified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_ai_memories"("p_user_id" "uuid", "p_memories" "jsonb") RETURNS TABLE("result_expert_id" "text", "success" boolean, "error_message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  expert_key TEXT;
  memory_data JSONB;
BEGIN
  -- 遍历传入的记忆数据
  FOR expert_key, memory_data IN SELECT * FROM jsonb_each(p_memories)
  LOOP
    BEGIN
      -- 验证内容长度
      IF char_length(memory_data->>'content') > 500 THEN
        RETURN QUERY SELECT expert_key::TEXT, FALSE, 'Content exceeds 500 characters'::TEXT;
        CONTINUE;
      END IF;

      -- 插入或更新记忆
      INSERT INTO ai_memories (user_id, expert_id, content, version, last_updated)
      VALUES (
        p_user_id,
        expert_key,
        memory_data->>'content',
        COALESCE((memory_data->>'version')::INTEGER, 1),
        COALESCE((memory_data->>'lastUpdated')::TIMESTAMP WITH TIME ZONE, NOW())
      )
      ON CONFLICT (user_id, expert_id)
      DO UPDATE SET
        content = EXCLUDED.content,
        version = GREATEST(ai_memories.version, EXCLUDED.version),
        last_updated = GREATEST(ai_memories.last_updated, EXCLUDED.last_updated);

      RETURN QUERY SELECT expert_key::TEXT, TRUE, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT expert_key::TEXT, FALSE, SQLERRM::TEXT;
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."upsert_ai_memories"("p_user_id" "uuid", "p_memories" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_log_patch"("p_user_id" "uuid", "p_date" "date", "p_log_data_patch" "jsonb", "p_last_modified" timestamp with time zone, "p_based_on_modified" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("success" boolean, "conflict_resolved" boolean, "final_modified" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."upsert_log_patch"("p_user_id" "uuid", "p_date" "date", "p_log_data_patch" "jsonb", "p_last_modified" timestamp with time zone, "p_based_on_modified" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_log_patch"("p_user_id" "uuid", "p_date" "date", "p_log_data_patch" "jsonb", "p_last_modified" timestamp with time zone, "p_based_on_modified" timestamp with time zone) IS 'Updated function with proper optimistic locking. Uses based_on_modified parameter for conflict detection instead of the new timestamp, preventing the bypass of conflict detection mechanism.';



CREATE OR REPLACE FUNCTION "public"."upsert_user_profile"("p_user_id" "uuid", "p_weight" numeric DEFAULT NULL::numeric, "p_height" numeric DEFAULT NULL::numeric, "p_age" integer DEFAULT NULL::integer, "p_gender" "text" DEFAULT NULL::"text", "p_activity_level" "text" DEFAULT NULL::"text", "p_goal" "text" DEFAULT NULL::"text", "p_target_weight" numeric DEFAULT NULL::numeric, "p_target_calories" integer DEFAULT NULL::integer, "p_notes" "text" DEFAULT NULL::"text", "p_professional_mode" boolean DEFAULT NULL::boolean, "p_medical_history" "text" DEFAULT NULL::"text", "p_lifestyle" "text" DEFAULT NULL::"text", "p_health_awareness" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result_record RECORD;
BEGIN
  -- 插入或更新用户档案
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


ALTER FUNCTION "public"."upsert_user_profile"("p_user_id" "uuid", "p_weight" numeric, "p_height" numeric, "p_age" integer, "p_gender" "text", "p_activity_level" "text", "p_goal" "text", "p_target_weight" numeric, "p_target_calories" integer, "p_notes" "text", "p_professional_mode" boolean, "p_medical_history" "text", "p_lifestyle" "text", "p_health_awareness" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expert_id" character varying(50) NOT NULL,
    "content" "text" NOT NULL,
    "version" integer DEFAULT 1,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_content_length" CHECK (("char_length"("content") <= 500))
);


ALTER TABLE "public"."ai_memories" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_memories" IS 'AI memories - access controlled at application layer via user_id filtering';



COMMENT ON COLUMN "public"."ai_memories"."user_id" IS '用户ID，关联users表';



COMMENT ON COLUMN "public"."ai_memories"."expert_id" IS '专家ID，如general、nutrition、fitness等';



COMMENT ON COLUMN "public"."ai_memories"."content" IS 'AI记忆内容，限制500字符';



COMMENT ON COLUMN "public"."ai_memories"."version" IS '版本号，用于跟踪更新';



COMMENT ON COLUMN "public"."ai_memories"."last_updated" IS '最后更新时间';



CREATE TABLE IF NOT EXISTS "public"."daily_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "log_data" "jsonb" NOT NULL,
    "last_modified" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_logs" IS 'User daily logs - access controlled at application layer via user_id filtering';



COMMENT ON COLUMN "public"."daily_logs"."user_id" IS '关联到 auth.users 表，标识日志的所属用户。';



COMMENT ON COLUMN "public"."daily_logs"."date" IS '日志对应的具体日期。';



COMMENT ON COLUMN "public"."daily_logs"."log_data" IS '存储完整日志内容的 JSON 对象。';



COMMENT ON COLUMN "public"."daily_logs"."last_modified" IS '最后修改时间戳，用于同步时的冲突解决。';



CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" bigint NOT NULL,
    "event_type" character varying(50) NOT NULL,
    "user_id" "uuid",
    "shared_key_id" "uuid",
    "severity" smallint DEFAULT 1,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."security_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."security_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."security_events_id_seq" OWNED BY "public"."security_events"."id";



CREATE TABLE IF NOT EXISTS "public"."shared_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "base_url" "text" NOT NULL,
    "api_key_encrypted" "text" NOT NULL,
    "daily_limit" integer DEFAULT 150,
    "description" "text",
    "tags" "text"[],
    "is_active" boolean DEFAULT true,
    "usage_count_today" integer DEFAULT 0,
    "total_usage_count" integer DEFAULT 0,
    "last_used_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "available_models" "text"[] NOT NULL
);


ALTER TABLE "public"."shared_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."shared_keys" IS 'Shared API keys - access controlled at application layer';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "weight" numeric(5,2),
    "height" numeric(5,2),
    "age" integer,
    "gender" character varying(20),
    "activity_level" character varying(50),
    "goal" character varying(50),
    "target_weight" numeric(5,2),
    "target_calories" integer,
    "notes" "text",
    "professional_mode" boolean DEFAULT false,
    "medical_history" "text",
    "lifestyle" "text",
    "health_awareness" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS '用户档案表，存储用户的个人信息和健康目标';



COMMENT ON COLUMN "public"."user_profiles"."user_id" IS '用户ID，关联users表';



COMMENT ON COLUMN "public"."user_profiles"."weight" IS '体重(kg)';



COMMENT ON COLUMN "public"."user_profiles"."height" IS '身高(cm)';



COMMENT ON COLUMN "public"."user_profiles"."age" IS '年龄';



COMMENT ON COLUMN "public"."user_profiles"."gender" IS '性别';



COMMENT ON COLUMN "public"."user_profiles"."activity_level" IS '活动水平';



COMMENT ON COLUMN "public"."user_profiles"."goal" IS '健康目标';



COMMENT ON COLUMN "public"."user_profiles"."target_weight" IS '目标体重(kg)';



COMMENT ON COLUMN "public"."user_profiles"."target_calories" IS '目标卡路里';



COMMENT ON COLUMN "public"."user_profiles"."notes" IS '备注';



COMMENT ON COLUMN "public"."user_profiles"."professional_mode" IS '专业模式';



COMMENT ON COLUMN "public"."user_profiles"."medical_history" IS '病史';



COMMENT ON COLUMN "public"."user_profiles"."lifestyle" IS '生活方式';



COMMENT ON COLUMN "public"."user_profiles"."health_awareness" IS '健康意识';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "linux_do_id" "text",
    "username" "text",
    "avatar_url" "text",
    "email" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "display_name" "text",
    "trust_level" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "is_silenced" boolean DEFAULT false,
    "last_login_at" timestamp without time zone,
    "login_count" integer DEFAULT 0
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'User data - access controlled at application layer';



ALTER TABLE ONLY "public"."security_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."security_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_memories"
    ADD CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_memories"
    ADD CONSTRAINT "ai_memories_user_expert_unique" UNIQUE ("user_id", "expert_id");



ALTER TABLE ONLY "public"."ai_memories"
    ADD CONSTRAINT "ai_memories_user_id_expert_id_key" UNIQUE ("user_id", "expert_id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_user_date_unique" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_keys"
    ADD CONSTRAINT "shared_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_keys"
    ADD CONSTRAINT "shared_keys_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "unique_log_per_user_per_day" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_linux_do_id_key" UNIQUE ("linux_do_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ai_memories_expert_id" ON "public"."ai_memories" USING "btree" ("expert_id");



CREATE INDEX "idx_ai_memories_last_updated" ON "public"."ai_memories" USING "btree" ("last_updated");



CREATE INDEX "idx_ai_memories_user_expert" ON "public"."ai_memories" USING "btree" ("user_id", "expert_id");



CREATE INDEX "idx_ai_memories_user_id" ON "public"."ai_memories" USING "btree" ("user_id");



CREATE INDEX "idx_daily_logs_date" ON "public"."daily_logs" USING "btree" ("date");



CREATE INDEX "idx_daily_logs_last_modified" ON "public"."daily_logs" USING "btree" ("last_modified");



CREATE INDEX "idx_daily_logs_user_date" ON "public"."daily_logs" USING "btree" ("user_id", "date");



CREATE INDEX "idx_daily_logs_user_id" ON "public"."daily_logs" USING "btree" ("user_id");



CREATE INDEX "idx_security_events_created" ON "public"."security_events" USING "btree" ("created_at");



CREATE INDEX "idx_security_events_type" ON "public"."security_events" USING "btree" ("event_type");



CREATE INDEX "idx_shared_keys_active" ON "public"."shared_keys" USING "btree" ("is_active", "usage_count_today", "daily_limit");



CREATE INDEX "idx_shared_keys_user" ON "public"."shared_keys" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_updated_at" ON "public"."user_profiles" USING "btree" ("updated_at");



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_users_active" ON "public"."users" USING "btree" ("is_active");



CREATE INDEX "idx_users_last_login" ON "public"."users" USING "btree" ("last_login_at");



CREATE INDEX "idx_users_linux_do_id" ON "public"."users" USING "btree" ("linux_do_id");



CREATE INDEX "idx_users_trust_level" ON "public"."users" USING "btree" ("trust_level");



CREATE OR REPLACE TRIGGER "trigger_update_ai_memories_modified" BEFORE UPDATE ON "public"."ai_memories" FOR EACH ROW EXECUTE FUNCTION "public"."update_ai_memories_modified"();



CREATE OR REPLACE TRIGGER "trigger_update_user_profiles_modified" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profiles_modified"();



ALTER TABLE ONLY "public"."ai_memories"
    ADD CONSTRAINT "ai_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_keys"
    ADD CONSTRAINT "shared_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."atomic_usage_check_and_increment"("p_user_id" "uuid", "p_usage_type" "text", "p_daily_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."atomic_usage_check_and_increment"("p_user_id" "uuid", "p_usage_type" "text", "p_daily_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."atomic_usage_check_and_increment"("p_user_id" "uuid", "p_usage_type" "text", "p_daily_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_ai_memories"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_ai_memories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_ai_memories"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_usage_count"("p_user_id" "uuid", "p_usage_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_usage_count"("p_user_id" "uuid", "p_usage_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_usage_count"("p_user_id" "uuid", "p_usage_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_ai_memories"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_ai_memories"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_ai_memories"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_shared_key_usage"("p_user_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_shared_key_usage"("p_user_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_shared_key_usage"("p_user_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_today_usage"("p_user_id" "uuid", "p_usage_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_today_usage"("p_user_id" "uuid", "p_usage_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_today_usage"("p_user_id" "uuid", "p_usage_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_shared_key_usage"("p_user_id" "uuid", "p_shared_key_id" "uuid", "p_model_used" "text", "p_api_endpoint" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_shared_key_usage"("p_user_id" "uuid", "p_shared_key_id" "uuid", "p_model_used" "text", "p_api_endpoint" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_shared_key_usage"("p_user_id" "uuid", "p_shared_key_id" "uuid", "p_model_used" "text", "p_api_endpoint" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb_deep_merge"("jsonb1" "jsonb", "jsonb2" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb_deep_merge"("jsonb1" "jsonb", "jsonb2" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb_deep_merge"("jsonb1" "jsonb", "jsonb2" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb", "deleted_ids" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb", "deleted_ids" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_arrays_by_log_id"("existing_array" "jsonb", "new_array" "jsonb", "deleted_ids" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_log_entry"("p_user_id" "uuid", "p_date" "date", "p_entry_type" "text", "p_log_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_log_entry"("p_user_id" "uuid", "p_date" "date", "p_entry_type" "text", "p_log_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_log_entry"("p_user_id" "uuid", "p_date" "date", "p_entry_type" "text", "p_log_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_shared_keys_daily"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_shared_keys_daily"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_shared_keys_daily"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ai_memories_modified"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ai_memories_modified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ai_memories_modified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profiles_modified"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profiles_modified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profiles_modified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_ai_memories"("p_user_id" "uuid", "p_memories" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_ai_memories"("p_user_id" "uuid", "p_memories" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_ai_memories"("p_user_id" "uuid", "p_memories" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_log_patch"("p_user_id" "uuid", "p_date" "date", "p_log_data_patch" "jsonb", "p_last_modified" timestamp with time zone, "p_based_on_modified" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_log_patch"("p_user_id" "uuid", "p_date" "date", "p_log_data_patch" "jsonb", "p_last_modified" timestamp with time zone, "p_based_on_modified" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_log_patch"("p_user_id" "uuid", "p_date" "date", "p_log_data_patch" "jsonb", "p_last_modified" timestamp with time zone, "p_based_on_modified" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_user_profile"("p_user_id" "uuid", "p_weight" numeric, "p_height" numeric, "p_age" integer, "p_gender" "text", "p_activity_level" "text", "p_goal" "text", "p_target_weight" numeric, "p_target_calories" integer, "p_notes" "text", "p_professional_mode" boolean, "p_medical_history" "text", "p_lifestyle" "text", "p_health_awareness" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_user_profile"("p_user_id" "uuid", "p_weight" numeric, "p_height" numeric, "p_age" integer, "p_gender" "text", "p_activity_level" "text", "p_goal" "text", "p_target_weight" numeric, "p_target_calories" integer, "p_notes" "text", "p_professional_mode" boolean, "p_medical_history" "text", "p_lifestyle" "text", "p_health_awareness" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_user_profile"("p_user_id" "uuid", "p_weight" numeric, "p_height" numeric, "p_age" integer, "p_gender" "text", "p_activity_level" "text", "p_goal" "text", "p_target_weight" numeric, "p_target_calories" integer, "p_notes" "text", "p_professional_mode" boolean, "p_medical_history" "text", "p_lifestyle" "text", "p_health_awareness" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."ai_memories" TO "anon";
GRANT ALL ON TABLE "public"."ai_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_memories" TO "service_role";



GRANT ALL ON TABLE "public"."daily_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_logs" TO "service_role";



GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."security_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."security_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."security_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shared_keys" TO "anon";
GRANT ALL ON TABLE "public"."shared_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
