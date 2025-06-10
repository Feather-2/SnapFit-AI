-- 数据库迁移脚本：更新每日调用限制范围
-- 执行日期：请在执行前备份数据库

-- 第一步：更新表的默认值
ALTER TABLE shared_keys ALTER COLUMN daily_limit SET DEFAULT 150;

-- 第二步：更新现有记录中小于150的daily_limit值
UPDATE shared_keys 
SET daily_limit = 150 
WHERE daily_limit < 150;

-- 第三步：验证更新结果
SELECT 
  id, 
  name, 
  daily_limit,
  CASE 
    WHEN daily_limit = 999999 THEN '无限制'
    WHEN daily_limit >= 150 AND daily_limit <= 99999 THEN '正常范围'
    ELSE '需要调整'
  END as limit_status,
  CASE 
    WHEN daily_limit = 999999 THEN '无限'
    ELSE CONCAT(FLOOR(daily_limit / 150), ' 人')
  END as estimated_users
FROM shared_keys
ORDER BY daily_limit DESC;

-- 第四步：检查是否有需要手动处理的记录
SELECT COUNT(*) as records_need_adjustment
FROM shared_keys 
WHERE daily_limit < 150 AND daily_limit != 999999;

-- 第五步：显示每日限制分布统计
SELECT 
  CASE 
    WHEN daily_limit = 999999 THEN '无限制'
    WHEN daily_limit >= 10000 THEN '10000+ (66+ 人)'
    WHEN daily_limit >= 5000 THEN '5000-9999 (33-66 人)'
    WHEN daily_limit >= 1500 THEN '1500-4999 (10-33 人)'
    WHEN daily_limit >= 750 THEN '750-1499 (5-10 人)'
    WHEN daily_limit >= 300 THEN '300-749 (2-5 人)'
    WHEN daily_limit >= 150 THEN '150-299 (1-2 人)'
    ELSE '< 150 (需要调整)'
  END as limit_range,
  COUNT(*) as count
FROM shared_keys
GROUP BY 
  CASE 
    WHEN daily_limit = 999999 THEN '无限制'
    WHEN daily_limit >= 10000 THEN '10000+ (66+ 人)'
    WHEN daily_limit >= 5000 THEN '5000-9999 (33-66 人)'
    WHEN daily_limit >= 1500 THEN '1500-4999 (10-33 人)'
    WHEN daily_limit >= 750 THEN '750-1499 (5-10 人)'
    WHEN daily_limit >= 300 THEN '300-749 (2-5 人)'
    WHEN daily_limit >= 150 THEN '150-299 (1-2 人)'
    ELSE '< 150 (需要调整)'
  END
ORDER BY 
  CASE 
    WHEN daily_limit = 999999 THEN 1
    WHEN daily_limit >= 10000 THEN 2
    WHEN daily_limit >= 5000 THEN 3
    WHEN daily_limit >= 1500 THEN 4
    WHEN daily_limit >= 750 THEN 5
    WHEN daily_limit >= 300 THEN 6
    WHEN daily_limit >= 150 THEN 7
    ELSE 8
  END;
