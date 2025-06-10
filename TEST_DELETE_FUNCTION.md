# 🧪 测试删除功能

## 📋 测试删除函数是否正常工作

在 Supabase SQL Editor 中执行以下测试：

### 1. 检查删除函数是否存在
```sql
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname = 'remove_log_entry';
```

**预期结果**: 应该返回函数名和参数数量

### 2. 测试删除函数（需要真实用户ID）
```sql
-- 首先查看现有的日志数据
SELECT 
  user_id,
  date,
  jsonb_pretty(log_data->'foodEntries') as food_entries,
  jsonb_array_length(log_data->'foodEntries') as food_count
FROM daily_logs 
WHERE log_data->'foodEntries' IS NOT NULL 
  AND jsonb_array_length(log_data->'foodEntries') > 0
LIMIT 5;
```

### 3. 如果有数据，测试删除功能
```sql
-- 替换为实际的用户ID、日期和log_id
SELECT * FROM remove_log_entry(
  'your-user-id'::uuid,
  '2025-01-09'::date,
  'food',
  'your-log-id'
);
```

### 4. 验证删除结果
```sql
-- 检查删除后的数据
SELECT 
  jsonb_pretty(log_data->'foodEntries') as food_entries_after_delete,
  jsonb_array_length(log_data->'foodEntries') as food_count_after
FROM daily_logs 
WHERE user_id = 'your-user-id' 
  AND date = '2025-01-09';
```

## 🔧 前端修复说明

已修复的问题：
1. ✅ `handleDeleteEntry` 现在使用 `removeEntry` 函数
2. ✅ 添加了 `removeEntry` 到 useSync 导入
3. ✅ 删除操作现在会同步到服务器
4. ✅ 本地UI立即更新

## 🚀 测试步骤

1. **重启应用** - 确保新代码生效
2. **多端测试**:
   - 设备A: 添加2个食物条目
   - 设备B: 刷新，确认看到2个条目
   - 设备B: 删除1个条目
   - 设备A: 刷新，应该只看到1个条目

## 📊 预期结果

删除操作现在应该：
- ✅ 本地立即生效
- ✅ 同步到服务器
- ✅ 其他设备刷新后看到删除结果
- ✅ 控制台显示删除成功日志

## 🔍 调试信息

如果删除仍然不工作，检查：

1. **浏览器控制台**:
   ```
   [Sync] Removing food entry xxx for date: 2025-01-09
   [Sync] Successfully removed food entry xxx
   ```

2. **网络请求**:
   - 检查 `/api/sync/logs/remove-entry` 请求
   - 确认返回状态码 200

3. **数据库日志**:
   - 在 Supabase Dashboard > Logs 中查看
   - 确认 `remove_log_entry` 函数被调用

## ⚠️ 常见问题

### 问题1: 函数不存在
```
ERROR: function remove_log_entry does not exist
```
**解决**: 重新执行迁移脚本

### 问题2: 权限错误
```
ERROR: permission denied for function remove_log_entry
```
**解决**: 
```sql
GRANT EXECUTE ON FUNCTION remove_log_entry(UUID, DATE, TEXT, TEXT) TO service_role;
```

### 问题3: 前端错误
```
TypeError: removeEntry is not a function
```
**解决**: 确认已正确导入 `removeEntry` 函数
