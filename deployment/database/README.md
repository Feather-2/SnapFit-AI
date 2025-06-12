# Snapifit AI Database

## 🎯 概述

Snapifit AI 数据库基于 2025-06-10 从 Supabase 生产环境导出的完整结构，包含所有业务逻辑函数、触发器和生产数据。

## 📊 数据库统计

- **表**: 7 个（users, user_profiles, shared_keys, daily_logs, ai_memories, security_events, ip_bans）
- **函数**: 22 个（完整业务逻辑 + 安全功能）
- **触发器**: 5 个（自动时间戳更新 + 安全触发器）
- **数据**: 清洁安装（无测试数据）
- **安全**: IP封禁系统 + 实时监控

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

# 方式3：仅安全系统升级（现有数据库）
# 推荐使用纯SQL版本（兼容性更好）
psql -d existing_database -f deployment/database/security-upgrade-pure.sql

# 或者使用psql版本（需要psql客户端）
psql -d existing_database -f deployment/database/deploy-security-only.sql

# 方式4：修复现有安全事件记录（可选）
psql -d existing_database -f deployment/database/fix-security-events.sql

# 方式5：添加用户封禁系统
psql -d existing_database -f deployment/database/add-user-bans-table.sql
```

## 📁 文件结构

```
database/
├── 🚀 部署文件
│   ├── deploy.sql                 # 清洁安装（仅结构，推荐）
│   ├── deploy_schema_only.sql     # 仅结构部署（开发环境）
│   ├── deploy-security-only.sql   # 安全系统独立部署（psql版本）
│   ├── security-upgrade.sql       # 安全系统升级脚本（psql版本）
│   ├── security-upgrade-pure.sql  # 安全系统升级脚本（纯SQL版本，推荐）
│   ├── fix-security-events.sql   # 修复安全事件记录脚本
│   ├── add-user-bans-table.sql   # 用户封禁系统脚本
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

| 部署类型           | 命令                                  | 用途               | 包含数据      |
| ------------------ | ------------------------------------- | ------------------ | ------------- |
| **清洁安装** | `./quick_deploy.sh`                 | 生产环境（推荐）   | ❌            |
| **仅结构**   | `./quick_deploy.sh -t schema`       | 开发环境           | ❌            |
| **开发设置** | `./quick_deploy.sh -t dev`          | 开发环境           | ❌ + 开发用户 |
| **安全升级** | `psql -f security-upgrade-pure.sql` | 现有数据库升级     | 保持现有      |
| **修复事件** | `psql -f fix-security-events.sql`   | 修复错误的事件记录 | 保持现有      |
| **用户封禁** | `psql -f add-user-bans-table.sql`   | 添加用户封禁功能   | 保持现有      |

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

-- 预期结果：7 tables, 22 functions, 5 triggers
```

## 🔍 关键功能

### 核心业务函数

- `atomic_usage_check_and_increment` - API 使用量原子控制
- `upsert_log_patch` - 日志更新（乐观锁机制）
- `jsonb_deep_merge` - JSON 深度合并工具
- `get_user_profile` - 用户配置管理
- `merge_arrays_by_log_id` - 智能数组合并
- `cleanup_old_ai_memories` - AI 记忆自动清理

### 安全系统函数

- `log_limit_violation` - 记录限额违规事件
- `is_ip_banned` - 检查IP是否被封禁
- `auto_unban_expired_ips` - 自动解封过期IP
- `get_ban_statistics` - 获取封禁统计信息

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

### 基础安全

- **参数化查询**: 防止 SQL 注入
- **数据验证**: 输入数据完整性检查
- **审计日志**: security_events 表记录所有操作
- **权限控制**: 基于角色的访问控制

### IP封禁系统 🆕

- **自动封禁**: 基于规则的自动IP封禁
- **手动管理**: 管理员手动封禁/解封功能
- **临时封禁**: 支持临时和永久封禁
- **自动过期**: 临时封禁自动解除
- **实时监控**: 安全事件实时记录和分析

### 多层速率限制规则

#### 同步API多层限制

| 限制层级         | 用户限制 | IP限制 | 说明             |
| ---------------- | -------- | ------ | ---------------- |
| **每秒**   | 3次      | -      | 防止瞬间爆发请求 |
| **每分钟** | 30次     | 100次  | 防止持续滥用     |
| **每小时** | 300次    | 1000次 | 长期使用限制     |

#### 其他API限制

| API类型 | 限制 | 时间窗口 | 说明         |
| ------- | ---- | -------- | ------------ |
| AI API  | 10次 | 每分钟   | AI相关接口   |
| 上传API | 3次  | 每分钟   | 文件上传接口 |
| 管理API | 20次 | 每分钟   | 管理员接口   |
| 一般API | 30次 | 每分钟   | 其他API接口  |

### 请求大小限制

| API类型         | 大小限制 | 说明                 |
| --------------- | -------- | -------------------- |
| Settings API    | 100KB    | 用户设置和配置       |
| Shared Keys API | 50KB     | 共享密钥管理         |
| Chat API        | 10MB     | 聊天消息（支持图片） |
| Upload API      | 50MB     | 文件上传             |
| Admin API       | 200KB    | 管理员操作           |
| Sync API        | 500KB    | 数据同步             |
| AI API          | 5MB      | AI相关请求           |
| 默认限制        | 1MB      | 其他API              |

### 字段长度限制

#### 设置页面字段

| 字段类型 | 最大长度            | 说明         |
| -------- | ------------------- | ------------ |
| API密钥  | 200字符             | API密钥字段  |
| 描述     | 1000字符            | 一般描述字段 |
| 备注     | 2000字符            | 用户备注     |
| 生活方式 | 3000字符            | 生活方式描述 |
| 医疗历史 | 5000字符            | 医疗历史记录 |
| 标签     | 50字符/个，最多10个 | 标签系统     |

#### 主页字段

| 字段类型 | 最大长度  | 说明         |
| -------- | --------- | ------------ |
| 聊天消息 | 10000字符 | 单条聊天消息 |
| 食物记录 | 3000字符  | 食物描述     |
| 运动记录 | 3000字符  | 运动描述     |
| 食物名称 | 200字符   | 食物名称     |
| 运动名称 | 200字符   | 运动名称     |
| 每日状态 | 1000字符  | 每日状态描述 |

#### 数值范围限制

| 数值类型 | 范围         | 说明            |
| -------- | ------------ | --------------- |
| 体重     | 20-500 kg    | 用户体重        |
| 身高     | 50-300 cm    | 用户身高        |
| 年龄     | 1-150 岁     | 用户年龄        |
| 卡路里   | 0-10000 kcal | 食物/运动卡路里 |
| 运动时长 | 0-1440 分钟  | 最多24小时      |
| 重量     | 0-10000 g    | 食物重量        |

#### 同步数据限制

| 限制类型       | 限制值    | 说明               |
| -------------- | --------- | ------------------ |
| 每次同步日志数 | 100条     | 单次同步最大日志数 |
| 单条日志大小   | 50KB      | 单条日志最大大小   |
| 文本字段长度   | 10000字符 | 日志中文本字段     |
| 图片数量       | 5张/消息  | 聊天消息图片数     |
| 图片大小       | 500KB/张  | 单张图片大小       |

### Base URL 黑名单限制

#### 被封禁的官方API域名

封禁了一些官方源站，原因是在社区中，鼓励使用第三方源站来分流，
并防止服务器被官方Ban掉。

这个特性会在自部署版本中去掉。

#### 封禁原因说明

| 域名类型            | 封禁原因           | 影响             |
| ------------------- | ------------------ | ---------------- |
| **AI官方API** | 防止社区被官方封禁 | 保护用户账号安全 |
| **政府域名**  | 避免敏感访问       | 降低合规风险     |
| **教育机构**  | 可能有访问限制     | 避免连接问题     |
| **金融机构**  | 安全考虑           | 防止误用         |

#### URL验证规则

| 规则类型             | 要求        | 说明                         |
| -------------------- | ----------- | ---------------------------- |
| **协议**       | HTTP/HTTPS  | 只支持HTTP和HTTPS协议        |
| **格式**       | 有效URL格式 | 必须是正确的URL格式          |
| **本地地址**   | 禁止        | 不允许localhost、127.0.0.1等 |
| **黑名单域名** | 禁止        | 不允许使用被封禁的域名       |
| **第三方服务** | 允许        | 除黑名单外的其他域名均可使用 |

### IP自动封禁规则

| 事件类型     | 阈值 | 时间窗口 | 封禁时长 | 严重程度 |
| ------------ | ---- | -------- | -------- | -------- |
| 速率限制违规 | 5次  | 10分钟   | 30分钟   | medium   |
| 无效输入攻击 | 20次 | 30分钟   | 2小时    | medium   |
| 未授权访问   | 5次  | 30分钟   | 4小时    | high     |
| 暴力破解     | 3次  | 15分钟   | 永久     | critical |
| 数据注入     | 2次  | 60分钟   | 永久     | critical |

### 用户自动封禁规则

| 事件类型     | 阈值 | 时间窗口 | 封禁时长 | 严重程度 |
| ------------ | ---- | -------- | -------- | -------- |
| 速率限制违规 | 10次 | 30分钟   | 1小时    | medium   |
| 无效输入攻击 | 15次 | 60分钟   | 2小时    | medium   |
| 未授权访问   | 3次  | 30分钟   | 4小时    | high     |
| 暴力破解     | 2次  | 15分钟   | 永久     | critical |
| 数据注入     | 1次  | 60分钟   | 永久     | critical |
| API滥用      | 20次 | 60分钟   | 3小时    | high     |

## 📞 支持

如遇问题：

1. 查看 [DEPLOYMENT.md](DEPLOYMENT.md) 详细指南
2. 检查 PostgreSQL 日志
3. 验证文件完整性
4. 确认 PostgreSQL 版本兼容性

## 🎉 部署成功

部署成功后，您将拥有：

- ✅ 完整的 Snapifit AI 数据库
- ✅ 所有业务逻辑函数
- ✅ 自动化触发器
- ✅ 生产级性能优化
- ✅ 完整的数据完整性保护

数据库现在可以支持 Snapifit AI 应用的所有功能！
