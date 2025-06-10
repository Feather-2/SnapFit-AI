# 🔍 调试删除404错误

## 🚨 问题分析

删除API返回404错误，可能的原因：
1. 数据库中没有对应日期的日志
2. 日志中没有对应的 log_id
3. 数据库函数执行失败
4. 日期格式问题

## 🧪 数据库调试步骤

### 1. 检查用户的日志数据
在 Supabase SQL Editor 中执行：

```sql
-- 查看用户的所有日志
SELECT 
  date,
  jsonb_pretty(log_data->'foodEntries') as food_entries,
  jsonb_array_length(log_data->'foodEntries') as food_count
FROM daily_logs 
WHERE user_id = 'f15f7802-e11a-4dc8-b950-363541c429a9'
ORDER BY date DESC
LIMIT 5;
```

### 2. 检查特定日期的数据
```sql
-- 查看2025-06-10的具体数据
SELECT 
  date,
  jsonb_pretty(log_data) as full_log_data
FROM daily_logs 
WHERE user_id = 'f15f7802-e11a-4dc8-b950-363541c429a9'
  AND date = '2025-06-10';
```

### 3. 查找特定的log_id
```sql
-- 查找是否存在指定的log_id
SELECT 
  date,
  item->>'log_id' as log_id,
  item->>'food_name' as food_name
FROM daily_logs,
     jsonb_array_elements(log_data->'foodEntries') as item
WHERE user_id = 'f15f7802-e11a-4dc8-b950-363541c429a9'
  AND item->>'log_id' = '66457db1-6afb-4515-9e1f-a0129bf8cb26';
```

### 4. 测试删除函数
```sql
-- 直接测试删除函数
SELECT * FROM remove_log_entry(
  'f15f7802-e11a-4dc8-b950-363541c429a9'::uuid,
  '2025-06-10'::date,
  'food',
  '66457db1-6afb-4515-9e1f-a0129bf8cb26'
);
```

## 🔧 可能的解决方案

### 方案1: 日期不匹配
如果数据库中的日期是 `2025-01-09` 而不是 `2025-06-10`：

```sql
-- 检查实际的日期
SELECT DISTINCT date 
FROM daily_logs 
WHERE user_id = 'f15f7802-e11a-4dc8-b950-363541c429a9'
ORDER BY date DESC;
```

### 方案2: log_id不存在
如果log_id不存在，检查实际的log_id：

```sql
-- 获取所有食物条目的log_id
SELECT 
  date,
  item->>'log_id' as log_id,
  item->>'food_name' as food_name
FROM daily_logs,
     jsonb_array_elements(log_data->'foodEntries') as item
WHERE user_id = 'f15f7802-e11a-4dc8-b950-363541c429a9'
ORDER BY date DESC;
```

### 方案3: 数据结构问题
检查数据结构是否正确：

```sql
-- 检查foodEntries字段是否存在
SELECT 
  date,
  log_data ? 'foodEntries' as has_food_entries,
  jsonb_typeof(log_data->'foodEntries') as food_entries_type,
  jsonb_array_length(log_data->'foodEntries') as food_count
FROM daily_logs 
WHERE user_id = 'f15f7802-e11a-4dc8-b950-363541c429a9'
  AND date = '2025-06-10';
```

## 📊 前端调试

### 1. 检查发送的数据
在浏览器控制台中：

```javascript
// 检查删除请求的数据
console.log('Delete request data:', {
  date: '2025-06-10',
  entryType: 'food',
  logId: '66457db1-6afb-4515-9e1f-a0129bf8cb26'
});

// 检查本地数据
const { getData } = useIndexedDB("healthLogs");
getData("2025-06-10").then(log => {
  console.log('Local log:', log);
  console.log('Food entries:', log?.foodEntries);
});
```

### 2. 检查日期格式
```javascript
// 检查日期转换
const selectedDate = new Date();
const dateString = format(selectedDate, "yyyy-MM-dd");
console.log('Selected date:', selectedDate);
console.log('Formatted date:', dateString);
```

## 🔍 API响应分析

现在API会返回更详细的信息：
- 当前日志数据
- RPC函数的返回结果
- 失败的具体原因

查看服务器日志中的这些信息：
```
[API/SYNC/REMOVE-ENTRY] Current log data: {...}
[API/SYNC/REMOVE-ENTRY] RPC function result: {...}
[API/SYNC/REMOVE-ENTRY] Delete failed. Result: {...}
```

## ✅ 解决步骤

1. **执行数据库查询** - 确认数据存在
2. **检查日期格式** - 确认日期匹配
3. **验证log_id** - 确认ID正确
4. **测试数据库函数** - 直接测试删除
5. **修复发现的问题** - 根据结果调整代码

## 🎯 预期结果

修复后应该看到：
```
[API/SYNC/REMOVE-ENTRY] Successfully removed entry. Remaining entries: X
POST /api/sync/logs/remove-entry 200
```
