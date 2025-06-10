-- 数据库迁移脚本：将 model_name 字段迁移到 available_models 数组字段
-- 执行日期：请在执行前备份数据库

-- 第一步：添加新的 available_models 字段
ALTER TABLE shared_keys ADD COLUMN IF NOT EXISTS available_models text[];

-- 第二步：将现有的 model_name 数据迁移到 available_models 数组中
UPDATE shared_keys
SET available_models = ARRAY[model_name]
WHERE available_models IS NULL AND model_name IS NOT NULL;

-- 第三步：为 available_models 字段设置 NOT NULL 约束（在确认数据迁移完成后）
-- 注意：只有在确认所有数据都已正确迁移后才执行这一步
ALTER TABLE shared_keys ALTER COLUMN available_models SET NOT NULL;

-- 第四步：删除旧的 model_name 字段（可选，建议先保留一段时间作为备份）
-- 注意：只有在确认新字段工作正常后才执行这一步
-- ALTER TABLE shared_keys DROP COLUMN IF EXISTS model_name;

-- 验证迁移结果的查询
SELECT
  id,
  name,
  model_name,
  available_models,
  CASE
    WHEN available_models IS NULL THEN '需要迁移'
    WHEN array_length(available_models, 1) = 0 THEN '空数组'
    ELSE '已迁移'
  END as migration_status
FROM shared_keys
ORDER BY created_at DESC;

-- 检查是否有需要手动处理的记录
SELECT COUNT(*) as records_need_migration
FROM shared_keys
WHERE available_models IS NULL AND model_name IS NOT NULL;
