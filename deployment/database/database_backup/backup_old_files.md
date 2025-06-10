# 数据库文件备份记录

## 备份时间
2025-06-10

## 备份原因
使用从 Supabase 生产环境导出的完整数据库结构替换原有的手动维护文件

## 原有文件列表
- `init.sql` - 原始表结构初始化文件
- `functions.sql` - 原始函数定义文件  
- `triggers.sql` - 原始触发器定义文件
- `schema.txt` - 原始结构概览文件
- `setup.sql` - 原始安装脚本

## 新文件来源
从 Supabase 项目 `vdjnnaunrtjhfnpuarrw` 导出：
- 18个函数（包含所有业务逻辑）
- 4个触发器（自动更新时间戳等）
- 6个表（完整的数据库结构）
- 完整的索引和约束

## 导出统计
- 函数: 18 个
- 触发器: 4 个  
- 表: 6 个
- Schema 文件大小: 50KB
- 数据文件大小: 13KB

## 关键函数确认
✅ atomic_usage_check_and_increment - 使用量控制
✅ upsert_log_patch - 日志更新（乐观锁）
✅ jsonb_deep_merge - JSON深度合并
✅ get_user_profile - 用户配置获取

## 备份位置
原有文件已重命名为 `.backup` 后缀，保留在同一目录中。
