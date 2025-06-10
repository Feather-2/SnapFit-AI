# SnapFit AI 数据库结构验证指南

## 验证步骤

### 1. 获取当前 Supabase 数据库结构

在 Supabase SQL Editor 中执行 `validation-queries.sql` 中的查询，将结果保存为文本文件。

### 2. 关键验证点

#### A. 表结构验证

**必须存在的表：**
- ✅ `users` - 用户账户表
- ✅ `user_profiles` - 用户健康档案表  
- ✅ `shared_keys` - 共享API密钥表
- ✅ `daily_logs` - 每日健康日志表
- ✅ `ai_memories` - AI对话记忆表
- ✅ `security_events` - 安全审计日志表
- ❓ `coach_snapshots` - 教练快照表（TypeScript中有定义，但init.sql中缺失）

#### B. 字段类型验证

**重点检查字段：**

1. **时间戳字段类型**：
   ```sql
   -- users 表中的时间字段应该是什么类型？
   -- init.sql: timestamp without time zone
   -- 其他表: timestamp with time zone
   ```

2. **shared_keys.available_models**：
   ```sql
   -- 应该是 text[] 数组类型
   -- 检查是否支持多模型
   ```

3. **daily_logs.log_data**：
   ```sql
   -- 应该是 jsonb 类型
   -- 支持复杂的健康数据存储
   ```

#### C. 约束验证

**主键约束：**
- 所有表都应该有 UUID 主键
- 使用 `gen_random_uuid()` 作为默认值

**外键约束：**
- `user_profiles.user_id` → `users.id`
- `shared_keys.user_id` → `users.id`  
- `daily_logs.user_id` → `users.id`
- `ai_memories.user_id` → `users.id`

**唯一约束：**
- `users.linux_do_id` - 唯一
- `user_profiles.user_id` - 唯一（一对一关系）
- `daily_logs(user_id, date)` - 复合唯一
- `ai_memories(user_id, expert_id)` - 复合唯一
- `shared_keys(user_id, name)` - 复合唯一

#### D. 索引验证

**性能关键索引：**
```sql
-- 用户表
idx_users_linux_do_id
idx_users_active  
idx_users_trust_level

-- 共享密钥表
idx_shared_keys_active
idx_shared_keys_user

-- 日志表
idx_daily_logs_user_date
idx_daily_logs_last_modified

-- AI记忆表
idx_ai_memories_user_expert
idx_ai_memories_last_updated
```

#### E. 函数验证

**核心业务函数：**
- ✅ `get_user_profile(uuid)` - 获取用户配置
- ✅ `upsert_user_profile(...)` - 更新用户配置
- ✅ `upsert_log_patch(...)` - 日志更新（支持乐观锁）
- ✅ `atomic_usage_check_and_increment(...)` - 原子性使用量控制
- ✅ `get_user_ai_memories(uuid)` - 获取AI记忆
- ✅ `upsert_ai_memories(...)` - 更新AI记忆
- ✅ `reset_shared_keys_daily()` - 每日重置使用量

**辅助函数：**
- ✅ `jsonb_deep_merge(jsonb, jsonb)` - JSONB深度合并
- ✅ `merge_arrays_by_log_id(...)` - 支持逻辑删除的数组合并

### 3. 已知差异和修复建议

#### A. 时间戳类型不一致

**问题：** `users` 表使用 `timestamp without time zone`，其他表使用 `timestamp with time zone`

**修复：** 统一使用 `timestamp with time zone`

```sql
-- 如果需要修复，执行：
ALTER TABLE users 
ALTER COLUMN created_at TYPE timestamp with time zone,
ALTER COLUMN updated_at TYPE timestamp with time zone,
ALTER COLUMN last_login_at TYPE timestamp with time zone;
```

#### B. 缺失的 coach_snapshots 表

**问题：** TypeScript 类型定义中有此表，但 init.sql 中没有

**修复：** 添加表定义到 init.sql

```sql
CREATE TABLE IF NOT EXISTS public.coach_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  conversation_data jsonb NOT NULL,
  model_config jsonb NOT NULL,
  health_data_snapshot jsonb NOT NULL,
  user_rating integer NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coach_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT coach_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
```

### 4. 验证清单

- [ ] 所有表都存在且字段类型正确
- [ ] 所有约束都正确设置
- [ ] 所有索引都存在
- [ ] 所有函数都存在且可执行
- [ ] 触发器正确设置
- [ ] RLS 策略符合预期（当前应该是禁用状态）
- [ ] 扩展正确安装（uuid-ossp, pg_cron）

### 5. 测试建议

验证完结构后，建议进行功能测试：

```sql
-- 测试用户创建
INSERT INTO users (linux_do_id, username) VALUES ('test123', 'testuser');

-- 测试用户配置
SELECT * FROM get_user_profile((SELECT id FROM users WHERE linux_do_id = 'test123'));

-- 测试使用量控制
SELECT * FROM atomic_usage_check_and_increment(
  (SELECT id FROM users WHERE linux_do_id = 'test123'),
  'conversation_count',
  150
);

-- 清理测试数据
DELETE FROM users WHERE linux_do_id = 'test123';
```

## 总结

当前的 `database/init.sql` 基本能够复刻 Supabase 数据库结构，但需要注意：

1. **时间戳类型统一性**
2. **缺失的 coach_snapshots 表**  
3. **RLS 策略的正确配置**
4. **扩展的安装顺序**

建议先在测试环境中验证，确认无误后再用于生产环境迁移。
