# 🚨 数据库函数缺失 - 快速修复指南

## 问题
```
ERROR: Could not find the function public.atomic_usage_check_and_increment
```

## 🔧 快速修复步骤

### 1. 登录 Supabase Dashboard
- 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
- 选择你的项目

### 2. 打开 SQL Editor
- 点击左侧菜单的 "SQL Editor"
- 点击 "New query"

### 3. 复制并执行以下 SQL

```sql
-- 创建每日使用记录表
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  log_data JSONB NOT NULL DEFAULT '{}',
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);

-- 核心限额检查函数
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
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE
  FOR UPDATE;

  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  new_count := current_count + 1;

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

-- 回滚函数
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

-- 获取使用量函数
CREATE OR REPLACE FUNCTION get_user_today_usage(
  p_user_id UUID, 
  p_usage_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  usage_count INTEGER := 0;
BEGIN
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO usage_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  RETURN COALESCE(usage_count, 0);
END;
$$ LANGUAGE plpgsql;
```

### 4. 点击 "Run" 执行

### 5. 验证成功
如果看到类似以下消息，说明成功：
```
NOTICE: ✅ Functions created successfully
```

### 6. 重启应用
```bash
# 停止开发服务器 (Ctrl+C)
# 然后重新启动
npm run dev
```

## ✅ 完成后测试

1. 尝试使用文本解析功能
2. 尝试使用对话功能
3. 检查是否还有数据库错误

## 🆘 如果仍有问题

1. **检查用户表是否存在**：
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_name = 'users';
   ```

2. **检查函数是否创建成功**：
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'atomic_usage_check_and_increment';
   ```

3. **如果用户表不存在**，需要先创建用户相关的表结构。

现在应该可以正常使用所有AI功能了！🚀
