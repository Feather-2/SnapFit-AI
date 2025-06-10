# 🔍 同步问题调试指南

## 🚨 问题分析

删除操作在一端执行成功，但另一端没有同步，可能的原因：

### 1. **时间戳比较问题**
- 删除操作更新了服务器时间戳
- 但另一端的 `pullData` 没有检测到变化

### 2. **自动同步没有触发**
- 另一端没有执行 `pullData`
- 或者同步被节流机制阻止

### 3. **IndexedDB 缓存问题**
- 本地缓存没有更新
- 时间戳比较使用了错误的本地时间

## 🧪 调试步骤

### 步骤1: 检查删除操作的时间戳更新

在删除操作后，检查数据库中的时间戳：

```sql
-- 在 Supabase SQL Editor 中查询
SELECT 
  user_id,
  date,
  last_modified,
  jsonb_array_length(log_data->'foodEntries') as food_count
FROM daily_logs 
WHERE date = '2025-01-09'  -- 替换为实际日期
ORDER BY last_modified DESC;
```

### 步骤2: 手动触发同步

在另一端的浏览器控制台中：

```javascript
// 手动触发数据拉取
const { pullData } = useSync();
pullData(false).then(() => {
  console.log('Manual sync completed');
  // 刷新页面查看结果
  window.location.reload();
});
```

### 步骤3: 检查本地时间戳

```javascript
// 检查本地 IndexedDB 中的时间戳
const { getData } = useIndexedDB("healthLogs");
getData("2025-01-09").then(log => {
  console.log('Local log timestamp:', log?.last_modified);
  console.log('Local food entries:', log?.foodEntries?.length);
});
```

### 步骤4: 检查服务器数据

```javascript
// 直接查询服务器数据
fetch('/api/sync/logs')
  .then(r => r.json())
  .then(logs => {
    const targetLog = logs.find(log => log.date === '2025-01-09');
    console.log('Server log timestamp:', targetLog?.last_modified);
    console.log('Server food entries:', targetLog?.log_data?.foodEntries?.length);
  });
```

## 🔧 可能的解决方案

### 方案1: 强制刷新本地缓存

在删除操作后，强制触发同步：

```typescript
// 在 handleDeleteEntry 中添加
const handleDeleteEntry = async (id: string, type: "food" | "exercise") => {
  try {
    const dateString = format(selectedDate, "yyyy-MM-dd");
    await removeEntry(dateString, type, id);
    
    // 🔄 强制触发同步以更新其他设备
    setTimeout(() => {
      pullData(false);
    }, 1000);
    
    // ... 其余代码
  } catch (error) {
    // ... 错误处理
  }
};
```

### 方案2: 修复时间戳比较逻辑

检查 `pullData` 中的时间戳比较：

```typescript
// 在 pullData 中添加调试日志
console.log('Server timestamp:', serverLog.last_modified);
console.log('Local timestamp:', localLog.last_modified);
console.log('Should update:', new Date(serverLog.last_modified) > new Date(localLog.last_modified || 0));
```

### 方案3: 清除本地缓存

如果怀疑 IndexedDB 缓存问题：

```javascript
// 清除特定日期的本地缓存
const { deleteData } = useIndexedDB("healthLogs");
deleteData("2025-01-09").then(() => {
  console.log('Local cache cleared');
  // 然后触发同步
  pullData(false);
});
```

## 🎯 快速测试

### 测试1: 验证删除是否到达服务器

```javascript
// 删除操作后立即检查
fetch('/api/sync/logs')
  .then(r => r.json())
  .then(logs => {
    const log = logs.find(l => l.date === '2025-01-09');
    console.log('Server has entries:', log?.log_data?.foodEntries?.length);
  });
```

### 测试2: 验证另一端的本地数据

```javascript
// 在另一端检查本地数据
const { getData } = useIndexedDB("healthLogs");
getData("2025-01-09").then(log => {
  console.log('Local has entries:', log?.foodEntries?.length);
  console.log('Local timestamp:', log?.last_modified);
});
```

### 测试3: 强制同步测试

```javascript
// 强制清除并重新同步
localStorage.removeItem('lastSyncTimestamp');
sessionStorage.removeItem('lastAutoSyncTime');

// 然后触发同步
const { syncAll } = useSync();
syncAll(true); // 手动同步
```

## ✅ 预期结果

正常工作的同步应该：
- [ ] 删除操作更新服务器时间戳
- [ ] 另一端检测到时间戳变化
- [ ] 自动或手动同步拉取新数据
- [ ] 本地 IndexedDB 更新
- [ ] UI 反映删除结果

## 🚀 临时解决方案

如果需要立即解决，可以：

1. **手动刷新页面** - 强制重新加载数据
2. **清除浏览器缓存** - 删除 IndexedDB 数据
3. **手动触发同步** - 使用同步按钮
4. **重新登录** - 强制完整同步
