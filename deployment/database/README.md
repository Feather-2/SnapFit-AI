# SnapFit AI Database

## 🎯 概述

SnapFit AI 数据库基于 2025-06-10 从 Supabase 生产环境导出的完整结构，包含所有业务逻辑函数、触发器和生产数据。

## 📊 数据库统计

- **表**: 6 个（users, user_profiles, shared_keys, daily_logs, ai_memories, security_events）
- **函数**: 18 个（完整业务逻辑）
- **触发器**: 4 个（自动时间戳更新）
- **数据**: 清洁安装（无测试数据）

## 🚀 快速开始

### 一键部署（推荐）

```bash
# 给脚本执行权限
chmod +x deployment/database/quick_deploy.sh

# 清洁安装（仅结构，推荐）
./deployment/database/quick_deploy.sh

# 开发环境设置
./deployment/database/quick_deploy.sh -n snapfit_ai_dev -t dev

# 测试环境
./deployment/database/quick_deploy.sh -n snapfit_ai_test -t schema
```

### 手动部署

```bash
# 方式1：清洁安装（推荐）
createdb snapfit_ai
psql -d snapfit_ai -f deployment/database/deploy.sql

# 方式2：仅结构（开发环境）
createdb snapfit_ai_dev
psql -d snapfit_ai_dev -f deployment/database/deploy_schema_only.sql
```

## 📁 文件结构

```
database/
├── 🚀 部署文件
│   ├── deploy.sql                 # 清洁安装（仅结构，推荐）
│   ├── deploy_schema_only.sql     # 仅结构部署（开发环境）
│   └── quick_deploy.sh           # 一键部署脚本
├── 📦 源文件（从生产环境导出）
│   ├── complete_backup.sql       # 完整备份（50KB，含测试数据）
│   └── schema.sql                # 数据库结构（50KB）
├── 📚 文档
│   ├── README.md                 # 本文档
│   └── DEPLOYMENT.md             # 详细部署指南
└── 📋 历史文件（已备份）
    ├── init.sql                  # 原始表结构
    ├── functions.sql             # 原始函数
    ├── triggers.sql              # 原始触发器
    └── migrations/               # 历史迁移
```

## 🔧 部署选项

| 部署类型 | 命令 | 用途 | 包含数据 |
|---------|------|------|----------|
| **清洁安装** | `./quick_deploy.sh` | 生产环境（推荐） | ❌ |
| **仅结构** | `./quick_deploy.sh -t schema` | 开发环境 | ❌ |
| **开发设置** | `./quick_deploy.sh -t dev` | 开发环境 | ❌ + 开发用户 |

## ✅ 验证部署

```bash
# 连接数据库
psql -d snapfit_ai

# 检查对象数量
SELECT
  'Tables' as type, COUNT(*) as count
FROM information_schema.tables WHERE table_schema = 'public'
UNION ALL
SELECT
  'Functions' as type, COUNT(*) as count
FROM information_schema.routines WHERE routine_schema = 'public'
UNION ALL
SELECT
  'Triggers' as type, COUNT(*) as count
FROM information_schema.triggers WHERE trigger_schema = 'public';

-- 预期结果：6 tables, 18 functions, 4 triggers
```

## 🔍 关键功能

### 核心业务函数
- `atomic_usage_check_and_increment` - API 使用量原子控制
- `upsert_log_patch` - 日志更新（乐观锁机制）
- `jsonb_deep_merge` - JSON 深度合并工具
- `get_user_profile` - 用户配置管理
- `merge_arrays_by_log_id` - 智能数组合并
- `cleanup_old_ai_memories` - AI 记忆自动清理

### 自动化触发器
- `trigger_update_ai_memories_modified` - AI 记忆更新时间
- `trigger_update_user_profiles_modified` - 用户配置更新时间

## 🔄 更新流程

### 从生产环境同步

```bash
# 1. 在 Ubuntu 服务器导出最新结构
cd ~/snapfit-export
supabase db dump --linked -p "PASSWORD" -f database_backup/schema_latest.sql

# 2. 复制到项目
cp database_backup/schema_latest.sql /path/to/project/database/schema.sql

# 3. 重新部署
./deployment/database/quick_deploy.sh -n snapfit_ai_updated
```

## 🚨 故障排除

### 常见问题

1. **权限错误**
   ```bash
   sudo -u postgres ./database/quick_deploy.sh
   ```

2. **数据库已存在**
   ```bash
   # 脚本会提示是否删除重建
   ./database/quick_deploy.sh  # 选择 'y' 重建
   ```

3. **函数创建失败**
   ```bash
   # 检查 PostgreSQL 版本（需要 12+）
   psql --version
   ```

### 调试命令

```bash
# 详细错误信息
psql -d snapfit_ai -f database/deploy.sql -v ON_ERROR_STOP=1

# 检查特定函数
psql -d snapfit_ai -c "\df atomic_usage_check_and_increment"

# 查看表结构
psql -d snapfit_ai -c "\d+ users"
```

## 📈 性能优化

数据库包含生产级优化：

- **索引**: 15+ 个性能索引
- **约束**: 完整的数据完整性约束
- **触发器**: 自动化的时间戳管理
- **函数**: 优化的业务逻辑函数

## 🔐 安全特性

- **参数化查询**: 防止 SQL 注入
- **数据验证**: 输入数据完整性检查
- **审计日志**: security_events 表记录所有操作
- **权限控制**: 基于角色的访问控制

## 📞 支持

如遇问题：

1. 查看 [DEPLOYMENT.md](DEPLOYMENT.md) 详细指南
2. 检查 PostgreSQL 日志
3. 验证文件完整性
4. 确认 PostgreSQL 版本兼容性

## 🎉 部署成功

部署成功后，您将拥有：

- ✅ 完整的 SnapFit AI 数据库
- ✅ 所有业务逻辑函数
- ✅ 自动化触发器
- ✅ 生产级性能优化
- ✅ 完整的数据完整性保护

数据库现在可以支持 SnapFit AI 应用的所有功能！
