# 🚀 数据库迁移执行指南

## 📋 概述

这个迁移将为你的健康应用添加安全的多端同步功能，解决数据覆盖和丢失问题。

## ⚠️ 执行前准备

### 1. **备份数据库**
```sql
-- 在 Supabase Dashboard 中创建备份
-- Settings > Database > Backups > Create backup
```

### 2. **检查当前状态**
```sql
-- 检查现有函数
SELECT proname FROM pg_proc 
WHERE proname IN ('upsert_log_patch', 'merge_arrays_by_log_id');

-- 检查约束
SELECT conname FROM pg_constraint 
WHERE conname LIKE '%daily_logs%';
```

## 🔧 执行步骤

### 步骤1: 登录 Supabase Dashboard
1. 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 "SQL Editor"

### 步骤2: 执行迁移脚本
1. 点击 "New query"
2. 复制 `database/migrations/complete-sync-migration.sql` 的全部内容
3. 粘贴到 SQL Editor 中
4. 点击 "Run" 按钮执行

### 步骤3: 验证执行结果
查看执行日志，应该看到：
```
✅ atomic_usage_check_and_increment function working correctly
✅ merge_arrays_by_log_id function working correctly  
🎉 All migration tests passed successfully!
Migration completed successfully! Functions created: 5
```

## 🔍 验证迁移成功

### 1. 检查函数是否创建
```sql
SELECT 
  proname as function_name,
  pronargs as arg_count
FROM pg_proc 
WHERE proname IN (
  'merge_arrays_by_log_id',
  'upsert_log_patch', 
  'remove_log_entry',
  'atomic_usage_check_and_increment',
  'decrement_usage_count'
)
ORDER BY proname;
```

**预期结果**: 应该返回5个函数

### 2. 检查约束是否添加
```sql
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint 
WHERE conname LIKE '%daily_logs%' OR conname LIKE '%ai_memories%';
```

**预期结果**: 应该包含唯一约束

### 3. 测试函数功能
```sql
-- 测试数组合并
SELECT merge_arrays_by_log_id(
  '[{"log_id": "1", "name": "apple"}]'::jsonb,
  '[{"log_id": "2", "name": "banana"}]'::jsonb
);
```

**预期结果**: 返回合并后的数组

## 🚨 常见问题处理

### 问题1: 权限错误
```
ERROR: permission denied for function xxx
```

**解决方案**:
```sql
-- 手动授权
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
```

### 问题2: 约束冲突
```
ERROR: could not create unique index "daily_logs_user_date_unique"
```

**解决方案**:
```sql
-- 检查重复数据
SELECT user_id, date, count(*) 
FROM daily_logs 
GROUP BY user_id, date 
HAVING count(*) > 1;

-- 如果有重复，需要手动清理
```

### 问题3: 函数已存在
```
ERROR: function "xxx" already exists
```

**解决方案**: 这是正常的，`CREATE OR REPLACE` 会更新现有函数

## 📊 迁移后的新功能

### 1. **智能数组合并**
- 多端同时添加食物/运动记录不会互相覆盖
- 基于 `log_id` 自动去重合并

### 2. **安全删除操作**
- 删除操作会同步到所有设备
- 原子性保证，不会出现部分删除

### 3. **冲突自动解决**
- 时间戳冲突时智能合并
- 保留所有有效数据

### 4. **使用量控制增强**
- 原子性计数，防止并发问题
- 支持回滚操作

## 🔄 回滚方案

如果迁移出现问题，可以执行回滚：

```sql
-- 删除新创建的函数
DROP FUNCTION IF EXISTS merge_arrays_by_log_id(JSONB, JSONB);
DROP FUNCTION IF EXISTS upsert_log_patch(UUID, DATE, JSONB, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS remove_log_entry(UUID, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS atomic_usage_check_and_increment(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS decrement_usage_count(UUID, TEXT);

-- 删除约束（如果需要）
ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_user_date_unique;
ALTER TABLE ai_memories DROP CONSTRAINT IF EXISTS ai_memories_user_expert_unique;
```

## ✅ 迁移完成检查清单

- [ ] 迁移脚本执行成功
- [ ] 5个函数全部创建
- [ ] 约束添加成功
- [ ] 测试函数正常工作
- [ ] 应用重启后同步功能正常
- [ ] 多端测试无数据丢失

## 🚀 下一步

迁移完成后：
1. **重启应用** - 确保新代码生效
2. **测试同步** - 按照 `SYNC_SAFETY_TEST.md` 进行测试
3. **监控日志** - 观察同步性能和错误
4. **用户通知** - 告知用户新的同步功能

## 📞 支持

如果遇到问题：
1. 检查 Supabase 日志
2. 查看应用控制台错误
3. 参考 `SYNC_CONFLICT_RESOLUTION.md` 文档
