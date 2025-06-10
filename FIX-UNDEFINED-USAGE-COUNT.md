# 🚨 修复 undefined 使用量问题

## 问题描述
错误信息：`今日AI使用次数已达上限 (undefined/150)`

这表明 `currentUsage` 字段为 `undefined`，说明数据库函数返回的数据结构有问题。

## 🔧 立即修复步骤

### 1. 在 Supabase SQL Editor 中执行修复脚本

```sql
-- 重新创建数据库函数，确保返回正确的数据结构
CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_user_id UUID,
  p_usage_type TEXT,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, new_count INTEGER) AS $$
DECLARE
  current_count INTEGER := 0;
  new_count_val INTEGER := 0;
BEGIN
  -- 获取当前使用量，特别处理 null 值
  SELECT COALESCE(
    CASE 
      WHEN (log_data->>p_usage_type) IS NULL THEN 0
      WHEN (log_data->>p_usage_type) = 'null' THEN 0
      WHEN (log_data->>p_usage_type) = '' THEN 0
      ELSE (log_data->>p_usage_type)::int
    END, 
    0
  )
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE;

  -- 如果没有记录，设置为0
  IF NOT FOUND THEN
    current_count := 0;
  END IF;

  -- 确保不是 NULL
  current_count := COALESCE(current_count, 0);

  -- 检查限额
  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  -- 递增
  new_count_val := current_count + 1;

  -- 更新或插入
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object(p_usage_type, new_count_val)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = COALESCE(daily_logs.log_data, '{}'::jsonb) || jsonb_build_object(
      p_usage_type,
      new_count_val
    ),
    last_modified = NOW();

  -- 返回结果
  RETURN QUERY SELECT TRUE, new_count_val;
END;
$$ LANGUAGE plpgsql;

-- 清理所有 null 值
UPDATE daily_logs 
SET log_data = jsonb_set(
  COALESCE(log_data, '{}'::jsonb),
  '{conversation_count}',
  '0'::jsonb
)
WHERE log_data->>'conversation_count' IS NULL 
   OR log_data->>'conversation_count' = 'null'
   OR log_data->>'conversation_count' = '';

-- 测试函数
DO $$
DECLARE
  test_result RECORD;
  test_user_id UUID := gen_random_uuid();
BEGIN
  SELECT * INTO test_result FROM atomic_usage_check_and_increment(
    test_user_id, 
    'conversation_count', 
    150
  );
  
  RAISE NOTICE 'Test result: allowed=%, new_count=%', test_result.allowed, test_result.new_count;
  
  -- 清理测试数据
  DELETE FROM daily_logs WHERE user_id = test_user_id;
END $$;
```

### 2. 重启应用
```bash
# 停止开发服务器 (Ctrl+C)
# 重新启动
npm run dev
```

### 3. 测试验证
1. 刷新页面
2. 尝试使用AI功能
3. 检查错误信息是否还显示 `undefined`

## 🔍 问题分析

### 可能的原因
1. **数据库函数返回格式不正确**
2. **Supabase RPC 调用返回的数据结构变化**
3. **数据解构时字段名不匹配**

### 修复内容
1. **数据库函数**：确保返回正确的字段名和数据类型
2. **应用层**：增强数据解构的容错性
3. **调试日志**：添加详细的调试信息

## 🧪 调试步骤

### 1. 检查数据库函数
```sql
-- 检查函数是否存在
SELECT proname FROM pg_proc WHERE proname = 'atomic_usage_check_and_increment';

-- 测试函数调用
SELECT * FROM atomic_usage_check_and_increment(
  'test-user-id'::UUID, 
  'conversation_count', 
  150
);
```

### 2. 检查应用日志
在浏览器开发者工具的控制台中查看：
```
Database function returned: [object]
```

### 3. 检查数据库数据
```sql
SELECT user_id, date, log_data 
FROM daily_logs 
WHERE date = CURRENT_DATE 
ORDER BY last_modified DESC 
LIMIT 5;
```

## ✅ 修复后的效果

- 🎯 **正确显示使用量** - 例如：`1/150` 而不是 `undefined/150`
- 🛡️ **准确的限额控制** - 正确判断是否超过限额
- 📊 **一致的数据** - 前端和后端显示一致
- 🔍 **详细的调试信息** - 便于排查问题

## 🚨 如果问题仍然存在

### 1. 检查控制台日志
查看是否有 "Database function returned:" 的日志信息

### 2. 手动测试数据库函数
```sql
-- 使用你的实际用户ID测试
SELECT * FROM atomic_usage_check_and_increment(
  'your-actual-user-id'::UUID, 
  'conversation_count', 
  150
);
```

### 3. 检查 Supabase 连接
确保 Supabase 连接正常，没有权限问题

### 4. 重置数据库状态
```sql
-- 如果需要，可以重置今日数据
DELETE FROM daily_logs WHERE date = CURRENT_DATE;
```

执行这些修复后，`undefined` 问题应该完全解决！🚀
