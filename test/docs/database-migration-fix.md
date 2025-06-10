# 数据库迁移修复指南

## 🚨 **问题描述**

系统报错：
```
Database error in usage check: {
  code: 'PGRST202',
  details: 'Could not find the function public.atomic_usage_check_and_increment(p_daily_limit, p_usage_type, p_user_id) in the schema cache'
}
```

这表示数据库中缺少限额控制的核心函数。

## 🔧 **解决方案**

### **方法1: 在 Supabase Dashboard 中执行**

1. **登录 Supabase Dashboard**
   - 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - 选择你的项目

2. **打开 SQL Editor**
   - 在左侧菜单中点击 "SQL Editor"
   - 点击 "New query"

3. **执行迁移脚本**
   - 复制 `database/migrations/create-usage-functions.sql` 文件的内容
   - 粘贴到 SQL Editor 中
   - 点击 "Run" 执行

4. **验证执行结果**
   - 如果成功，会看到 "✅ atomic_usage_check_and_increment function created successfully"
   - 如果失败，检查错误信息并修复

### **方法2: 使用 Supabase CLI**

```bash
# 1. 安装 Supabase CLI（如果还没有）
npm install -g supabase

# 2. 登录到 Supabase
supabase login

# 3. 链接到你的项目
supabase link --project-ref YOUR_PROJECT_REF

# 4. 执行迁移
supabase db push

# 或者直接执行 SQL 文件
psql -h YOUR_DB_HOST -U postgres -d postgres -f database/migrations/create-usage-functions.sql
```

### **方法3: 手动创建函数**

如果上述方法都不可行，可以手动在 Supabase SQL Editor 中执行以下核心函数：

```sql
-- 创建核心限额检查函数
CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_user_id UUID,
  p_usage_type TEXT,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, new_count INTEGER) AS $$
DECLARE
  current_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  -- 获取当前使用量
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE;

  -- 检查限额
  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  -- 递增计数
  new_count := current_count + 1;

  -- 更新记录
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    jsonb_build_object(p_usage_type, new_count)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = daily_logs.log_data || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW();

  RETURN QUERY SELECT TRUE, new_count;
END;
$$ LANGUAGE plpgsql;

-- 创建回滚函数
CREATE OR REPLACE FUNCTION decrement_usage_count(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  IF current_count > 0 THEN
    new_count := current_count - 1;

    UPDATE daily_logs
    SET log_data = log_data || jsonb_build_object(
      p_usage_type,
      new_count
    ),
    last_modified = NOW()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    RETURN new_count;
  END IF;

  RETURN current_count;
END;
$$ LANGUAGE plpgsql;
```

## 🧪 **验证修复**

执行迁移后，可以通过以下方式验证：

### **1. 检查函数是否存在**
```sql
SELECT proname, proargnames 
FROM pg_proc 
WHERE proname IN ('atomic_usage_check_and_increment', 'decrement_usage_count');
```

应该返回两个函数的信息。

### **2. 测试函数调用**
```sql
-- 测试限额检查函数（使用一个测试用户ID）
SELECT * FROM atomic_usage_check_and_increment(
  'test-user-id'::UUID, 
  'conversation_count', 
  40
);
```

### **3. 检查表是否存在**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'daily_logs';
```

## 🚀 **重启应用**

完成数据库迁移后：

1. **重启开发服务器**
   ```bash
   npm run dev
   # 或
   yarn dev
   ```

2. **测试AI功能**
   - 尝试使用文本解析功能
   - 尝试使用对话功能
   - 检查是否还有限额错误

## 📋 **常见问题**

### **Q: 执行迁移时报错 "relation 'daily_logs' does not exist"**
A: 需要先创建 `daily_logs` 表。执行完整的 `database/migrations/create-usage-functions.sql` 文件。

### **Q: 函数创建成功但仍然报错**
A: 可能是权限问题。确保服务角色有执行函数的权限：
```sql
GRANT EXECUTE ON FUNCTION atomic_usage_check_and_increment(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_usage_count(UUID, TEXT) TO service_role;
```

### **Q: 如何回滚这些更改？**
A: 如果需要回滚，可以执行：
```sql
DROP FUNCTION IF EXISTS atomic_usage_check_and_increment(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS decrement_usage_count(UUID, TEXT);
DROP TABLE IF EXISTS daily_logs;
```

## 🎯 **执行后的效果**

修复完成后，系统将具备：

- ✅ **严格的限额控制** - 用户无法超过每日限额
- ✅ **原子性操作** - 并发安全的使用计数
- ✅ **错误回滚** - AI失败时自动回滚计数
- ✅ **实时监控** - 完整的使用量统计

现在所有AI功能都应该可以正常工作，并且受到严格的限额控制！🛡️
