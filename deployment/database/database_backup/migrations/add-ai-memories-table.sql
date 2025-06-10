-- 创建AI记忆表
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expert_id VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保每个用户每个专家只有一条记忆记录
  UNIQUE(user_id, expert_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_expert_id ON ai_memories(expert_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_expert ON ai_memories(user_id, expert_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_last_updated ON ai_memories(last_updated);

-- 添加注释
COMMENT ON TABLE ai_memories IS 'AI专家记忆表，存储每个专家对用户的记忆内容';
COMMENT ON COLUMN ai_memories.user_id IS '用户ID，关联users表';
COMMENT ON COLUMN ai_memories.expert_id IS '专家ID，如general、nutrition、fitness等';
COMMENT ON COLUMN ai_memories.content IS 'AI记忆内容，限制500字符';
COMMENT ON COLUMN ai_memories.version IS '版本号，用于跟踪更新';
COMMENT ON COLUMN ai_memories.last_updated IS '最后更新时间';

-- 添加内容长度约束
ALTER TABLE ai_memories ADD CONSTRAINT check_content_length CHECK (char_length(content) <= 500);

-- 创建更新last_updated的触发器
CREATE OR REPLACE FUNCTION update_ai_memories_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_memories_modified
  BEFORE UPDATE ON ai_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_memories_modified();

-- 创建RPC函数用于批量更新AI记忆
CREATE OR REPLACE FUNCTION upsert_ai_memories(
  p_user_id UUID,
  p_memories JSONB
)
RETURNS TABLE(result_expert_id TEXT, success BOOLEAN, error_message TEXT) AS $$
DECLARE
  memory_record RECORD;
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

-- 创建获取用户所有AI记忆的函数
CREATE OR REPLACE FUNCTION get_user_ai_memories(p_user_id UUID)
RETURNS TABLE(
  expert_id TEXT,
  content TEXT,
  version INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
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
$$ LANGUAGE plpgsql;

-- 创建清理旧记忆的函数（可选，保留最近30天的记忆）
CREATE OR REPLACE FUNCTION cleanup_old_ai_memories()
RETURNS void AS $$
BEGIN
  -- 删除30天前未更新的记忆
  DELETE FROM ai_memories
  WHERE last_updated < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 创建定时任务（需要pg_cron扩展）
-- SELECT cron.schedule('cleanup-ai-memories', '0 3 * * *', 'SELECT cleanup_old_ai_memories();');
