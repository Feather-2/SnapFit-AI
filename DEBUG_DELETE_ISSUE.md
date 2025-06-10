# 🔧 删除功能调试指南

## 🚨 已修复的问题

**问题**: 日期格式不匹配
- `selectedDate` 是 `Date` 对象
- `removeEntry` 期望字符串格式的日期
- 导致 `getData(date)` 找不到对应的日志

**修复**: 在调用 `removeEntry` 前转换日期格式
```typescript
const dateString = format(selectedDate, "yyyy-MM-dd");
await removeEntry(dateString, type, id);
```

## 🧪 测试步骤

### 1. 重启应用
确保新代码生效

### 2. 测试删除功能
1. **添加食物条目**
   - 在当前日期添加2个食物条目
   - 确认本地显示正常

2. **执行删除操作**
   - 点击删除按钮删除其中一个条目
   - 观察浏览器控制台日志

3. **验证同步**
   - 在另一个设备/浏览器登录同一账号
   - 刷新页面，确认删除已同步

## 📊 预期的控制台日志

**成功的删除操作应该显示**:
```
[Sync] Removing food entry e8ca6a74-6830-4f29-b33a-cfc0a42a6ac3 for date: 2025-01-09
[Sync] Current log for 2025-01-09: {date: "2025-01-09", foodEntries: [...], ...}
[API/SYNC/REMOVE-ENTRY] Removing food entry e8ca6a74-6830-4f29-b33a-cfc0a42a6ac3 for user: xxx, date: 2025-01-09
[API/SYNC/REMOVE-ENTRY] Successfully removed entry. Remaining entries: 1
[Sync] Successfully removed food entry e8ca6a74-6830-4f29-b33a-cfc0a42a6ac3
```

**之前的错误日志**:
```
[Sync] Removing food entry xxx for date: Tue Jun 10 2025 00:30:36 GMT+0800 (中国标准时间)
[Sync] No log found for date: Tue Jun 10 2025 00:30:36 GMT+0800 (中国标准时间)
```

## 🔍 如果仍然有问题

### 检查1: 日期格式
在浏览器控制台运行:
```javascript
// 检查当前选择的日期
console.log('Selected date:', selectedDate);
console.log('Formatted date:', format(selectedDate, "yyyy-MM-dd"));
```

### 检查2: 本地数据
```javascript
// 检查本地是否有对应日期的数据
const { getData } = useIndexedDB("healthLogs");
getData("2025-01-09").then(log => console.log('Local log:', log));
```

### 检查3: 网络请求
- 打开开发者工具 > Network 标签
- 执行删除操作
- 查看 `/api/sync/logs/remove-entry` 请求
- 确认请求体包含正确的日期格式

## 🛠️ 常见问题解决

### 问题1: 仍然显示 "No log found"
**可能原因**: 
- 本地 IndexedDB 中没有对应日期的数据
- 日期格式仍然不正确

**解决方案**:
```typescript
// 在 handleDeleteEntry 中添加调试日志
console.log('Selected date object:', selectedDate);
console.log('Formatted date string:', dateString);
console.log('Daily log date:', dailyLog.date);
```

### 问题2: API 请求失败
**检查**:
- 网络连接
- 用户认证状态
- 服务器日志

### 问题3: 数据库函数错误
**在 Supabase SQL Editor 中测试**:
```sql
-- 检查函数是否存在
SELECT proname FROM pg_proc WHERE proname = 'remove_log_entry';

-- 测试函数调用
SELECT * FROM remove_log_entry(
  'your-user-id'::uuid,
  '2025-01-09'::date,
  'food',
  'test-log-id'
);
```

## ✅ 成功标准

删除功能正常工作的标志:
- [ ] 控制台显示正确的日期格式 (YYYY-MM-DD)
- [ ] 本地 UI 立即更新
- [ ] 网络请求成功 (状态码 200)
- [ ] 其他设备刷新后看到删除结果
- [ ] 数据库中的数据确实被删除

## 🚀 下一步

如果删除功能正常工作:
1. 测试运动条目删除
2. 测试多条目删除
3. 测试离线删除后同步
4. 验证删除操作的撤销机制（如果需要）
