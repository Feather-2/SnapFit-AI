-- 修复AI记忆RPC函数中的列名歧义问题

-- 删除旧的函数
DROP FUNCTION IF EXISTS upsert_ai_memories(UUID, JSONB);

-- 重新创建修复后的函数
CREATE OR REPLACE FUNCTION upsert_ai_memories(
  p_user_id UUID,
  p_memories JSONB
)
RETURNS TABLE(result_expert_id TEXT, success BOOLEAN, error_message TEXT) AS $$
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
$$ LANGUAGE plpgsql;

-- 测试函数
SELECT * FROM upsert_ai_memories(
  'bab422e3-ce99-4970-bc9a-f67bdc87df10'::UUID,
  '{"general": {"content": "测试记忆内容", "version": 1, "lastUpdated": "2024-01-01T00:00:00Z"}}'::JSONB
);
