# SnapFit AI 数据库初始化指南

本指南介绍如何从零开始初始化 SnapFit AI 数据库，包括表结构、函数、触发器和定时任务。

## 📁 文件结构

```
database/
├── setup.sql           # 主初始化脚本（交互式）
├── init.sql            # 表结构和基础配置
├── functions.sql       # 业务逻辑函数
└── triggers.sql        # 触发器和定时任务

scripts/
└── setup-database.sh   # 自动化部署脚本
```

## 🚀 快速开始

### 方法1：使用自动化脚本（推荐）

```bash
# 给脚本执行权限
chmod +x scripts/setup-database.sh

# Supabase 初始化
./scripts/setup-database.sh --supabase --demo-data

# PostgreSQL 初始化
./scripts/setup-database.sh --postgresql --url "postgresql://user:pass@localhost:5432/snapfit"

# 强制重新初始化（会删除现有数据）
./scripts/setup-database.sh --postgresql --force --backup
```

### 方法2：手动执行SQL脚本

```bash
# 1. 连接到数据库
psql "your_database_url"

# 2. 执行初始化脚本
\i database/init.sql
\i database/functions.sql
\i database/triggers.sql

# 或者执行完整的设置脚本
\i database/setup.sql
```

## 🔧 环境变量配置

### Supabase
```env
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
```

### PostgreSQL
```env
DATABASE_URL=postgresql://user:password@localhost:5432/snapfit_ai
```

## 📊 数据库结构

### 核心表

| 表名 | 描述 | 主要字段 |
|------|------|----------|
| `users` | 用户账户 | id, linux_do_id, username, trust_level |
| `user_profiles` | 用户健康档案 | user_id, weight, height, goal |
| `shared_keys` | 共享API密钥 | user_id, name, api_key_encrypted, daily_limit |
| `daily_logs` | 每日健康日志 | user_id, date, log_data (JSONB) |
| `ai_memories` | AI对话记忆 | user_id, expert_id, content, version |
| `security_events` | 安全审计日志 | event_type, user_id, details (JSONB) |

### 关键功能

#### 1. 用户管理
- `get_user_profile(user_id)` - 获取用户配置
- `upsert_user_profile(...)` - 更新用户配置

#### 2. 高级日志管理（支持乐观锁）
- `upsert_log_patch(user_id, date, patch_data, last_modified, based_on_modified)` - 乐观锁日志更新
- **乐观锁冲突检测** - 基于时间戳的并发冲突检测
- **智能冲突解决** - 自动合并非冲突数据
- **逻辑删除支持** - 支持 `deletedFoodIds`, `deletedExerciseIds`
- **数组智能合并** - 按 `log_id` 合并食物和运动条目
- **墓碑记录** - 保留删除记录防止数据丢失

#### 3. 双重使用量控制系统
- **基于 daily_logs 的用户使用量控制**:
  - `atomic_usage_check_and_increment(user_id, usage_type, daily_limit)` - 用户级别限额
  - `get_user_today_usage(user_id, usage_type)` - 获取用户使用量
  - `decrement_usage_count(user_id, usage_type)` - 回滚使用量
- **基于 shared_keys 的密钥使用量控制**:
  - `atomic_usage_check_and_increment(shared_key_id)` - 密钥级别限额
  - `reset_shared_keys_daily()` - 每日重置密钥使用量

#### 4. AI记忆管理（版本控制）
- `get_user_ai_memories(user_id)` - 获取AI记忆
- `upsert_ai_memories(user_id, expert_id, content)` - 更新记忆（自动版本控制）
- `cleanup_old_ai_memories(days)` - 清理旧记忆

#### 5. 数据迁移和维护
- `migrate_model_name_to_available_models()` - 模型字段迁移
- `cleanup_and_optimize_database()` - 数据库清理和优化

### 自动化任务

| 任务 | 频率 | 功能 |
|------|------|------|
| `daily-shared-keys-reset` | 每日 00:00 UTC | 重置共享密钥使用量 |
| `weekly-ai-memory-cleanup` | 周日 02:00 UTC | 清理90天前的AI记忆 |
| `monthly-database-cleanup` | 每月1号 03:00 UTC | 数据库清理和优化 |

### 高级特性

#### 🔒 乐观锁机制
- **冲突检测**: 基于 `based_on_modified` 时间戳检测并发修改
- **智能合并**: 非冲突数据自动合并，冲突数据使用最新版本
- **原子性操作**: 使用 `FOR UPDATE` 行锁确保数据一致性

#### 🗑️ 逻辑删除系统
- **墓碑记录**: `deletedFoodIds`, `deletedExerciseIds` 保留删除历史
- **智能过滤**: 合并时自动排除已删除的条目
- **数据恢复**: 支持从删除历史中恢复数据

#### 📊 双重使用量控制
- **用户级别**: 基于 `daily_logs` 表的灵活使用量控制
- **密钥级别**: 基于 `shared_keys` 表的传统使用量控制
- **原子性检查**: 防止并发请求导致的超限问题

#### 🔄 数据迁移支持
- **向后兼容**: 支持从 `model_name` 到 `available_models` 的迁移
- **增量迁移**: 只迁移需要更新的记录
- **错误处理**: 迁移失败时的详细错误报告

## 🔒 安全配置

### RLS策略
- **已禁用** - 使用应用层权限控制
- 适合ANON_KEY + Service Role架构
- 前端可正常访问，后端API控制权限

### 权限设置
```sql
-- anon 角色：前端读取权限
GRANT SELECT ON ALL TABLES TO anon;

-- authenticated 角色：认证用户权限
GRANT SELECT ON ALL TABLES TO authenticated;

-- service_role 角色：完整权限（默认）
```

## 🧪 验证安装

### 1. 检查表结构
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### 2. 检查函数
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### 3. 检查定时任务
```sql
SELECT jobname, schedule, command
FROM cron.job;
```

### 4. 测试核心功能
```sql
-- 运行完整的功能测试套件
\i database/test-functions.sql

-- 或单独测试特定功能：

-- 测试乐观锁
SELECT upsert_log_patch(
  'user-id'::uuid,
  CURRENT_DATE,
  '{"foodEntries": [{"log_id": "food1", "name": "Apple", "calories": 95}]}'::jsonb,
  NOW(),
  NOW() - INTERVAL '1 minute'  -- 模拟基于旧版本的更新
);

-- 测试使用量控制
SELECT atomic_usage_check_and_increment(
  'user-id'::uuid,
  'ai_requests',
  10  -- 每日限制
);

-- 测试AI记忆版本控制
SELECT upsert_ai_memories(
  'user-id'::uuid,
  'nutrition_expert',
  'User prefers low-carb diet.'
);
```

## 🔄 升级和迁移

### 备份数据
```bash
# 完整备份
pg_dump "your_database_url" > backup.sql

# 仅数据备份
pg_dump --data-only "your_database_url" > data_backup.sql
```

### 重新初始化
```bash
# 强制重新初始化（会删除所有数据）
./scripts/setup-database.sh --postgresql --force --backup
```

### 增量更新
```sql
-- 添加新函数或修改现有函数
\i database/functions.sql

-- 更新触发器
\i database/triggers.sql
```

## 🐛 故障排除

### 常见问题

1. **权限错误**
   ```sql
   -- 检查当前用户权限
   SELECT current_user, session_user;

   -- 授予必要权限
   GRANT ALL ON SCHEMA public TO current_user;
   ```

2. **扩展缺失**
   ```sql
   -- 安装必要扩展
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_cron";
   ```

3. **函数冲突**
   ```sql
   -- 删除冲突函数
   DROP FUNCTION IF EXISTS function_name CASCADE;
   ```

4. **定时任务失败**
   ```sql
   -- 检查定时任务状态
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

   -- 重新创建定时任务
   SELECT cron.unschedule('job_name');
   SELECT cron.schedule('job_name', '0 0 * * *', 'SELECT function_name();');
   ```

### 日志查看
```sql
-- 查看安全事件日志
SELECT * FROM security_events
WHERE event_type LIKE '%INIT%'
ORDER BY created_at DESC;

-- 查看系统日志
SELECT * FROM security_events
WHERE event_type IN ('DATABASE_INITIALIZED', 'DATABASE_SETUP_COMPLETED')
ORDER BY created_at DESC;
```

## 📈 性能优化

### 索引优化
```sql
-- 检查索引使用情况
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;

-- 分析表统计信息
ANALYZE;
```

### 查询优化
```sql
-- 启用查询计划分析
EXPLAIN ANALYZE SELECT * FROM daily_logs WHERE user_id = 'test-id';
```

## 🔗 相关文档

- [Docker部署指南](DOCKER.md)
- [数据库切换指南](DATABASE-SWITCH-GUIDE.md)
- [Supabase配置指南](SUPABASE-CONFIG.md)

---

如有问题，请查看故障排除部分或提交Issue。
