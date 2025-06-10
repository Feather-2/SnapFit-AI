-- 数据库迁移脚本：移除 model_name 字段，使用 available_models 数组
-- 执行日期：请在执行前备份数据库

-- 第一步：确保 available_models 字段存在且有数据
-- 如果 available_models 为空但 model_name 有值，先迁移数据
UPDATE shared_keys 
SET available_models = ARRAY[model_name] 
WHERE (available_models IS NULL OR array_length(available_models, 1) IS NULL) 
  AND model_name IS NOT NULL;

-- 第二步：为 available_models 字段设置 NOT NULL 约束
ALTER TABLE shared_keys ALTER COLUMN available_models SET NOT NULL;

-- 第三步：删除 model_name 字段
ALTER TABLE shared_keys DROP COLUMN model_name;

-- 第四步：更新默认的 daily_limit 值
ALTER TABLE shared_keys ALTER COLUMN daily_limit SET DEFAULT 150;

-- 验证迁移结果
SELECT 
  id, 
  name, 
  available_models,
  daily_limit,
  CASE 
    WHEN available_models IS NULL THEN '错误：字段为空'
    WHEN array_length(available_models, 1) = 0 THEN '错误：空数组'
    WHEN array_length(available_models, 1) > 0 THEN '正常'
    ELSE '未知状态'
  END as migration_status
FROM shared_keys
ORDER BY created_at DESC
LIMIT 10;

-- 检查是否还有问题记录
SELECT COUNT(*) as total_records,
       COUNT(CASE WHEN available_models IS NOT NULL AND array_length(available_models, 1) > 0 THEN 1 END) as valid_records
FROM shared_keys;
