# 🗄️ 数据库设置指南

## 📋 概述

为了使同步功能正常工作，需要在 Supabase 数据库中创建以下表：

1. `user_profiles` - 用户档案表
2. `ai_memories` - AI记忆表

## 🚀 快速设置

### 方法1: 使用 Supabase Dashboard

1. 登录到 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 **SQL Editor**
4. 按顺序执行以下迁移文件：

#### 步骤1: 创建用户档案表
```sql
-- 复制并执行 database/migrations/create-user-profiles-table.sql 的内容
```

#### 步骤2: 创建AI记忆表
```sql
-- 复制并执行 database/migrations/add-ai-memories-table.sql 的内容
```

### 方法2: 使用 Supabase CLI

```bash
# 如果您使用 Supabase CLI
supabase db reset
supabase migration new create_user_profiles
supabase migration new add_ai_memories
```

## 🔍 验证设置

执行以下查询来验证表是否正确创建：

```sql
-- 检查表是否存在
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'ai_memories', 'users', 'daily_logs')
ORDER BY table_name;

-- 检查索引
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'ai_memories')
ORDER BY tablename, indexname;

-- 检查RPC函数
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_name LIKE '%user_profile%' OR routine_name LIKE '%ai_memor%')
ORDER BY routine_name;
```

## 📊 表结构

### user_profiles 表
- 存储用户的个人信息和健康目标
- 与 `users` 表通过 `user_id` 关联
- 支持体重、身高、年龄、性别等基本信息
- 包含健康目标、活动水平等偏好设置

### ai_memories 表
- 存储AI专家对用户的记忆内容
- 支持版本控制和时间戳
- 每个用户每个专家只能有一条记忆记录
- 内容限制为500字符

## 🔧 故障排除

### 常见问题

1. **表已存在错误**
   - 使用 `CREATE TABLE IF NOT EXISTS` 避免重复创建

2. **权限错误**
   - 确保您有数据库管理员权限

3. **外键约束错误**
   - 确保 `users` 表已存在

### 重置数据库

如果需要重新开始：

```sql
-- 谨慎使用！这将删除所有数据
DROP TABLE IF EXISTS ai_memories CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
```

## 📝 注意事项

- 在生产环境中执行迁移前，请先备份数据库
- 确保应用程序在迁移期间处于维护模式
- 迁移完成后测试所有同步功能

## 🔗 相关文件

- `database/migrations/create-user-profiles-table.sql`
- `database/migrations/add-ai-memories-table.sql`
- `lib/supabase.ts` - 类型定义
- `app/api/sync/` - API端点
