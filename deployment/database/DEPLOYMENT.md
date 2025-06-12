# Snapifit AI Database Deployment Guide

## 📋 概述

本指南提供了 Snapifit AI 数据库的完整部署步骤。数据库基于 2025-06-10 从 Supabase 生产环境导出的真实结构。

## 📁 文件说明

### 🚀 部署文件
- `deploy.sql` - **完整部署**（结构 + 生产数据）
- `deploy_schema_only.sql` - **仅结构部署**（适合开发环境）

### 📦 源文件
- `complete_backup.sql` - 完整备份（50KB，结构+数据）
- `schema.sql` - 数据库结构（50KB，18个函数+4个触发器）
- `data.sql` - 生产数据（13KB）

## 🎯 部署场景

### 场景1：生产环境部署（包含数据）

```bash
# 1. 创建数据库
createdb snapfit_ai

# 2. 部署完整数据库
psql -d snapfit_ai -f deployment/database/deploy.sql

# 3. 验证部署
psql -d snapfit_ai -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

**预期结果**：
- ✅ 6个表
- ✅ 18个函数
- ✅ 4个触发器
- ✅ 生产数据

### 场景2：开发环境部署（仅结构）

```bash
# 1. 创建开发数据库
createdb snapfit_ai_dev

# 2. 部署数据库结构
psql -d snapfit_ai_dev -f deployment/database/deploy_schema_only.sql

# 3. 验证部署
psql -d snapfit_ai_dev -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;"
```

**预期结果**：
- ✅ 6个表（空表）
- ✅ 18个函数
- ✅ 4个触发器
- ❌ 无数据

### 场景3：测试环境部署

```bash
# 1. 创建测试数据库
createdb snapfit_ai_test

# 2. 部署结构
psql -d snapfit_ai_test -f database/deploy_schema_only.sql

# 3. 添加测试数据（可选）
psql -d snapfit_ai_test -f database/data.sql
```

## 🔧 详细步骤

### 第一步：环境准备

```bash
# 检查 PostgreSQL 版本（推荐 15+）
psql --version

# 检查连接
psql -c "SELECT version();"

# 确保有创建数据库权限
psql -c "SELECT current_user, session_user;"
```

### 第二步：选择部署方式

#### 方式A：一键完整部署

```bash
# 创建并部署完整数据库
createdb snapfit_ai && psql -d snapfit_ai -f database/deploy.sql
```

#### 方式B：分步部署

```bash
# 1. 创建数据库
createdb snapfit_ai

# 2. 部署结构
psql -d snapfit_ai -f database/schema.sql

# 3. 导入数据（可选）
psql -d snapfit_ai -f database/data.sql
```

### 第三步：验证部署

```bash
# 连接数据库
psql -d snapfit_ai

# 检查表
\dt

# 检查函数
\df

# 检查关键函数
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN (
  'atomic_usage_check_and_increment',
  'upsert_log_patch',
  'jsonb_deep_merge',
  'get_user_profile'
) ORDER BY routine_name;

# 检查数据
SELECT
  schemaname,
  tablename,
  n_tup_ins as inserted_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public';
```

## 🔍 验证清单

### ✅ 必须验证的项目

1. **表结构**
   ```sql
   SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
   -- 预期：6
   ```

2. **函数数量**
   ```sql
   SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';
   -- 预期：18
   ```

3. **触发器数量**
   ```sql
   SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';
   -- 预期：4
   ```

4. **关键函数测试**
   ```sql
   -- 测试 JSON 合并函数
   SELECT jsonb_deep_merge('{"a": 1}'::jsonb, '{"b": 2}'::jsonb);

   -- 测试用户配置函数
   SELECT get_user_profile('00000000-0000-0000-0000-000000000000'::uuid);
   ```

### 📊 预期的数据库对象

| 对象类型 | 数量 | 说明 |
|---------|------|------|
| 表 | 6 | users, user_profiles, shared_keys, daily_logs, ai_memories, security_events |
| 函数 | 18 | 完整业务逻辑 |
| 触发器 | 4 | 自动时间戳更新 |
| 索引 | 15+ | 性能优化 |
| 约束 | 10+ | 数据完整性 |

## 🚨 故障排除

### 常见问题

1. **权限错误**
   ```bash
   # 解决方案：使用超级用户或授予权限
   sudo -u postgres psql -d snapfit_ai -f database/deploy.sql
   ```

2. **函数创建失败**
   ```bash
   # 检查 PostgreSQL 版本
   psql -c "SELECT version();"

   # 确保支持所需扩展
   psql -d snapfit_ai -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
   ```

3. **数据导入错误**
   ```bash
   # 检查字符编码
   psql -d snapfit_ai -c "SHOW client_encoding;"

   # 设置正确编码
   psql -d snapfit_ai -c "SET client_encoding = 'UTF8';"
   ```

### 调试命令

```bash
# 详细错误信息
psql -d snapfit_ai -f deployment/database/deploy.sql -v ON_ERROR_STOP=1

# 检查日志
tail -f /var/log/postgresql/postgresql-*.log

# 验证特定函数
psql -d snapfit_ai -c "\df atomic_usage_check_and_increment"
```

## 🔄 更新流程

### 从生产环境更新

```bash
# 1. 导出最新结构（在 Ubuntu 服务器）
supabase db dump --linked -p "PASSWORD" -f schema_latest.sql

# 2. 备份当前数据库
pg_dump snapfit_ai > backup_$(date +%Y%m%d).sql

# 3. 更新结构
psql -d snapfit_ai -f schema_latest.sql
```

## 📝 部署记录

### 部署日志模板

```
部署日期：2025-06-10
部署环境：[生产/开发/测试]
数据库名：snapfit_ai
PostgreSQL版本：15.x
部署文件：deploy.sql
部署结果：[成功/失败]
验证结果：
- 表数量：6 ✅
- 函数数量：18 ✅
- 触发器数量：4 ✅
- 关键函数测试：✅
备注：
```

## 🎉 部署完成

部署成功后，您的 Snapifit AI 数据库将包含：

- ✅ **完整的表结构**（6个表）
- ✅ **所有业务逻辑函数**（18个函数）
- ✅ **自动化触发器**（4个触发器）
- ✅ **生产级索引和约束**
- ✅ **可选的生产数据**

数据库现在可以支持 Snapifit AI 应用的所有功能！
