-- 创建用户档案表
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight DECIMAL(5,2),
  height DECIMAL(5,2),
  age INTEGER,
  gender VARCHAR(20),
  activity_level VARCHAR(50),
  goal VARCHAR(50),
  target_weight DECIMAL(5,2),
  target_calories INTEGER,
  notes TEXT,
  professional_mode BOOLEAN DEFAULT FALSE,
  medical_history TEXT,
  lifestyle TEXT,
  health_awareness TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保每个用户只有一个档案
  UNIQUE(user_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles(updated_at);

-- 添加注释
COMMENT ON TABLE user_profiles IS '用户档案表，存储用户的个人信息和健康目标';
COMMENT ON COLUMN user_profiles.user_id IS '用户ID，关联users表';
COMMENT ON COLUMN user_profiles.weight IS '体重(kg)';
COMMENT ON COLUMN user_profiles.height IS '身高(cm)';
COMMENT ON COLUMN user_profiles.age IS '年龄';
COMMENT ON COLUMN user_profiles.gender IS '性别';
COMMENT ON COLUMN user_profiles.activity_level IS '活动水平';
COMMENT ON COLUMN user_profiles.goal IS '健康目标';
COMMENT ON COLUMN user_profiles.target_weight IS '目标体重(kg)';
COMMENT ON COLUMN user_profiles.target_calories IS '目标卡路里';
COMMENT ON COLUMN user_profiles.notes IS '备注';
COMMENT ON COLUMN user_profiles.professional_mode IS '专业模式';
COMMENT ON COLUMN user_profiles.medical_history IS '病史';
COMMENT ON COLUMN user_profiles.lifestyle IS '生活方式';
COMMENT ON COLUMN user_profiles.health_awareness IS '健康意识';

-- 创建更新updated_at的触发器
CREATE OR REPLACE FUNCTION update_user_profiles_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profiles_modified
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_modified();

-- 创建RPC函数用于获取用户档案
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS TABLE(
  weight DECIMAL,
  height DECIMAL,
  age INTEGER,
  gender TEXT,
  activity_level TEXT,
  goal TEXT,
  target_weight DECIMAL,
  target_calories INTEGER,
  notes TEXT,
  professional_mode BOOLEAN,
  medical_history TEXT,
  lifestyle TEXT,
  health_awareness TEXT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
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
$$ LANGUAGE plpgsql;

-- 创建RPC函数用于更新用户档案
CREATE OR REPLACE FUNCTION upsert_user_profile(
  p_user_id UUID,
  p_weight DECIMAL DEFAULT NULL,
  p_height DECIMAL DEFAULT NULL,
  p_age INTEGER DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_activity_level TEXT DEFAULT NULL,
  p_goal TEXT DEFAULT NULL,
  p_target_weight DECIMAL DEFAULT NULL,
  p_target_calories INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_professional_mode BOOLEAN DEFAULT NULL,
  p_medical_history TEXT DEFAULT NULL,
  p_lifestyle TEXT DEFAULT NULL,
  p_health_awareness TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
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
$$ LANGUAGE plpgsql;
