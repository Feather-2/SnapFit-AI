-- SnapFit AI 数据库功能测试脚本
-- 验证所有复杂功能是否正常工作

-- ========================================
-- 1. 测试数据准备
-- ========================================

-- 创建测试用户
INSERT INTO users (id, username, display_name, email, trust_level, is_active)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test_user_1',
  'Test User 1',
  'test1@example.com',
  1,
  true
) ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email;

INSERT INTO users (id, username, display_name, email, trust_level, is_active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'test_user_2',
  'Test User 2',
  'test2@example.com',
  2,
  true
) ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email;

-- ========================================
-- 2. 测试乐观锁和日志合并
-- ========================================

\echo '🧪 Testing optimistic locking and log merging...'

-- 测试1: 基本日志创建
SELECT upsert_log_patch(
  '11111111-1111-1111-1111-111111111111'::uuid,
  CURRENT_DATE,
  '{"foodEntries": [{"log_id": "food1", "name": "Apple", "calories": 95}], "exerciseEntries": [{"log_id": "ex1", "name": "Running", "duration": 30}]}'::jsonb,
  NOW(),
  NULL
);

-- 测试2: 模拟并发更新（应该触发智能合并）
SELECT upsert_log_patch(
  '11111111-1111-1111-1111-111111111111'::uuid,
  CURRENT_DATE,
  '{"foodEntries": [{"log_id": "food2", "name": "Banana", "calories": 105}]}'::jsonb,
  NOW() - INTERVAL '1 minute',  -- 模拟基于旧版本的更新
  NOW() - INTERVAL '2 minutes'  -- based_on_modified
);

-- 测试3: 逻辑删除
SELECT upsert_log_patch(
  '11111111-1111-1111-1111-111111111111'::uuid,
  CURRENT_DATE,
  '{"deletedFoodIds": ["food1"], "foodEntries": [{"log_id": "food3", "name": "Orange", "calories": 80}]}'::jsonb,
  NOW(),
  NULL
);

-- 验证结果
SELECT 
  date,
  log_data->'foodEntries' as food_entries,
  log_data->'exerciseEntries' as exercise_entries,
  log_data->'deletedFoodIds' as deleted_food_ids,
  last_modified
FROM daily_logs 
WHERE user_id = '11111111-1111-1111-1111-111111111111'
AND date = CURRENT_DATE;

-- ========================================
-- 3. 测试使用量控制
-- ========================================

\echo '🧪 Testing usage control system...'

-- 测试用户使用量控制
SELECT atomic_usage_check_and_increment(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'ai_requests',
  10  -- 每日限制10次
);

-- 多次调用测试
SELECT atomic_usage_check_and_increment(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'ai_requests',
  10
) FROM generate_series(1, 5);

-- 测试超限情况
SELECT atomic_usage_check_and_increment(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'ai_requests',
  10
) FROM generate_series(1, 8);  -- 应该有几次失败

-- 查看使用量
SELECT get_user_today_usage(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'ai_requests'
);

-- ========================================
-- 4. 测试共享密钥功能
-- ========================================

\echo '🧪 Testing shared key management...'

-- 创建测试共享密钥
INSERT INTO shared_keys (
  id,
  user_id,
  name,
  base_url,
  api_key_encrypted,
  available_models,
  daily_limit,
  description,
  is_active
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Test OpenAI Key',
  'https://api.openai.com',
  'encrypted_test_key',
  ARRAY['gpt-3.5-turbo', 'gpt-4'],
  5,
  'Test key for validation',
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  available_models = EXCLUDED.available_models,
  daily_limit = EXCLUDED.daily_limit;

-- 测试共享密钥使用量控制
SELECT atomic_usage_check_and_increment(
  '33333333-3333-3333-3333-333333333333'::uuid,
  1
) FROM generate_series(1, 3);

-- 测试超限
SELECT atomic_usage_check_and_increment(
  '33333333-3333-3333-3333-333333333333'::uuid,
  1
) FROM generate_series(1, 5);  -- 应该有几次失败

-- 查看共享密钥状态
SELECT 
  name,
  usage_count_today,
  daily_limit,
  total_usage_count,
  is_active
FROM shared_keys 
WHERE id = '33333333-3333-3333-3333-333333333333';

-- ========================================
-- 5. 测试AI记忆功能
-- ========================================

\echo '🧪 Testing AI memory management...'

-- 创建AI记忆
SELECT upsert_ai_memories(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'nutrition_expert',
  'User prefers low-carb diet and has lactose intolerance.'
);

SELECT upsert_ai_memories(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'fitness_expert',
  'User enjoys running and strength training, prefers morning workouts.'
);

-- 更新AI记忆（测试版本控制）
SELECT upsert_ai_memories(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'nutrition_expert',
  'User prefers low-carb diet, has lactose intolerance, and wants to gain muscle mass.'
);

-- 查看AI记忆
SELECT * FROM get_user_ai_memories('11111111-1111-1111-1111-111111111111'::uuid);

-- ========================================
-- 6. 测试数据迁移功能
-- ========================================

\echo '🧪 Testing data migration functions...'

-- 测试模型迁移（如果有 model_name 列的话）
SELECT migrate_model_name_to_available_models();

-- ========================================
-- 7. 性能和并发测试
-- ========================================

\echo '🧪 Testing performance and concurrency...'

-- 并发日志更新测试
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..10 LOOP
    PERFORM upsert_log_patch(
      '22222222-2222-2222-2222-222222222222'::uuid,
      CURRENT_DATE,
      jsonb_build_object(
        'foodEntries', 
        jsonb_build_array(
          jsonb_build_object(
            'log_id', 'concurrent_food_' || i,
            'name', 'Test Food ' || i,
            'calories', 100 + i
          )
        )
      ),
      NOW(),
      NULL
    );
  END LOOP;
END $$;

-- 查看并发测试结果
SELECT 
  jsonb_array_length(log_data->'foodEntries') as food_count,
  log_data->'foodEntries'
FROM daily_logs 
WHERE user_id = '22222222-2222-2222-2222-222222222222'
AND date = CURRENT_DATE;

-- ========================================
-- 8. 验证触发器和约束
-- ========================================

\echo '🧪 Testing triggers and constraints...'

-- 测试使用量验证触发器
BEGIN;
  -- 这应该失败（超过限制）
  UPDATE shared_keys 
  SET usage_count_today = 1000 
  WHERE id = '33333333-3333-3333-3333-333333333333';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Expected error caught: %', SQLERRM;
ROLLBACK;

-- 测试负数使用量自动修正
UPDATE shared_keys 
SET usage_count_today = -5 
WHERE id = '33333333-3333-3333-3333-333333333333';

SELECT usage_count_today 
FROM shared_keys 
WHERE id = '33333333-3333-3333-3333-333333333333';

-- ========================================
-- 9. 清理测试数据
-- ========================================

\echo '🧹 Cleaning up test data...'

-- 删除测试数据
DELETE FROM daily_logs WHERE user_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

DELETE FROM ai_memories WHERE user_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

DELETE FROM shared_keys WHERE id = '33333333-3333-3333-3333-333333333333';

DELETE FROM users WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

\echo '✅ All tests completed! Check the output above for any errors.'
