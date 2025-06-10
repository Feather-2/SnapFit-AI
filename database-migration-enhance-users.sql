-- 数据库迁移脚本：增强users表结构
-- 执行日期：请在执行前备份数据库

-- 第一步：添加新字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_level integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_silenced boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp without time zone;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;

-- 第二步：添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_users_linux_do_id ON users(linux_do_id);
CREATE INDEX IF NOT EXISTS idx_users_trust_level ON users(trust_level);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- 第三步：更新现有数据（如果需要）
-- 将username复制到display_name（如果display_name为空）
UPDATE users 
SET display_name = username 
WHERE display_name IS NULL AND username IS NOT NULL;

-- 第四步：验证迁移结果
SELECT 
  id,
  linux_do_id,
  username,
  display_name,
  email,
  trust_level,
  is_active,
  is_silenced,
  last_login_at,
  login_count,
  created_at,
  updated_at
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- 第五步：检查表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
