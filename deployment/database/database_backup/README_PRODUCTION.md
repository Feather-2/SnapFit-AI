# Snapifit AI Database (Production Version)

## 概述

本目录包含 Snapifit AI 的完整数据库结构，基于 2025-06-10 从 Supabase 生产环境导出的真实数据库。

## 文件结构

### 🚀 生产环境文件（推荐使用）
- `schema_production.sql` - 完整的生产数据库结构
- `setup_production.sql` - 生产环境安装脚本
- `README_PRODUCTION.md` - 本文档

### 📦 历史文件（已备份）
- `init.sql` - 原始表结构文件（已过时）
- `functions.sql` - 原始函数文件（已过时）
- `triggers.sql` - 原始触发器文件（已过时）
- `setup.sql` - 原始安装脚本（已过时）
- `migrations/` - 历史迁移文件（保留作为参考）

## 生产环境统计

### 📊 导出统计（2025-06-10）
- **函数**: 18 个（完整业务逻辑）
- **触发器**: 4 个（自动时间戳更新）
- **表**: 6 个（完整数据结构）
- **Schema 文件大小**: 50KB
- **数据文件大小**: 13KB

### ✅ 关键功能确认
- `atomic_usage_check_and_increment` - 使用量原子控制
- `upsert_log_patch` - 日志更新（乐观锁）
- `jsonb_deep_merge` - JSON 深度合并
- `get_user_profile` - 用户配置管理
- `merge_arrays_by_log_id` - 智能数组合并
- `cleanup_old_ai_memories` - AI 记忆清理

### 📋 数据库表
1. `users` - 用户账户（Linux.do OAuth）
2. `user_profiles` - 用户健康档案
3. `shared_keys` - 社区共享 API 密钥
4. `daily_logs` - 用户日常记录
5. `ai_memories` - AI 对话记忆
6. `security_events` - 安全审计日志

## 安装说明

### 🚀 快速安装（推荐）

```bash
# 使用生产环境 schema
psql -d your_database -f database/setup_production.sql
```

### 📋 详细步骤

1. **准备数据库**
   ```bash
   createdb snapfit_ai
   ```

2. **更新 schema 文件**
   ```bash
   # 从 Ubuntu 导出复制实际 schema
   cp ~/snapfit-export/database_backup/schema.sql database/schema_production.sql
   ```

3. **执行安装**
   ```bash
   psql -d snapfit_ai -f database/setup_production.sql
   ```

4. **验证安装**
   ```sql
   -- 检查函数数量
   SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';

   -- 检查触发器数量
   SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';

   -- 检查表数量
   SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
   ```

## 更新流程

### 🔄 从生产环境更新

1. **导出最新 schema**
   ```bash
   # 在 Ubuntu 服务器上
   cd ~/snapfit-export
   supabase db dump --linked -p "PASSWORD" -f database_backup/schema_latest.sql
   ```

2. **更新本地文件**
   ```bash
   # 复制到项目
   cp ~/snapfit-export/database_backup/schema_latest.sql database/schema_production.sql
   ```

3. **测试更新**
   ```bash
   # 在测试数据库中验证
   psql -d test_database -f database/setup_production.sql
   ```

## 开发说明

### 🔧 本地开发

```bash
# 创建开发数据库
createdb snapfit_ai_dev

# 安装 schema
psql -d snapfit_ai_dev -f database/setup_production.sql

# 验证安装
psql -d snapfit_ai_dev -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;"
```

### 🧪 测试

```bash
# 运行验证查询
psql -d snapfit_ai_dev -f database/validation-queries.sql
```

## 迁移说明

### 📦 从旧版本迁移

如果您使用的是旧的 `init.sql` + `functions.sql` + `triggers.sql` 结构：

1. **备份现有数据**
   ```bash
   pg_dump your_database > backup_before_migration.sql
   ```

2. **使用新的生产 schema**
   ```bash
   # 删除旧结构（谨慎操作）
   psql -d your_database -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

   # 安装新结构
   psql -d your_database -f database/setup_production.sql

   # 恢复数据（如果需要）
   psql -d your_database -f your_data_backup.sql
   ```

## 故障排除

### ❌ 常见问题

1. **函数缺失**
   - 确保 `schema_production.sql` 包含实际的生产 schema
   - 检查文件是否从 Ubuntu 导出正确复制

2. **触发器不工作**
   - 验证触发器函数是否存在
   - 检查表权限设置

3. **权限问题**
   - 确保数据库用户有足够权限
   - 检查 RLS 策略设置

### 🔍 调试命令

```sql
-- 检查所有函数
SELECT routine_name, routine_type FROM information_schema.routines
WHERE routine_schema = 'public' ORDER BY routine_name;

-- 检查所有触发器
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public' ORDER BY trigger_name;

-- 检查表结构
\dt public.*

-- 测试关键函数
SELECT atomic_usage_check_and_increment('test-key', 1);
```

## 版本历史

- **v2.0.0** (2025-06-10) - 基于生产环境导出的完整 schema
- **v1.0.0** (2024-xx-xx) - 原始手动维护的分离文件结构

## 联系信息

如有问题，请检查：
1. 生产环境导出是否最新
2. 文件复制是否正确
3. 数据库权限是否充足
