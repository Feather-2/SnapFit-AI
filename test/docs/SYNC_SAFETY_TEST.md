# 🧪 数据同步安全性测试指南

## 📋 测试目标

验证新的智能同步机制能够：
1. **防止数据丢失** - 多端同时编辑时不会覆盖数据
2. **正确合并数组** - 基于 `log_id` 智能合并食物和运动条目
3. **安全删除条目** - 删除操作能正确同步到所有设备
4. **处理冲突** - 时间戳冲突时能智能解决

## 🔧 测试前准备

### 1. 部署数据库函数
```sql
-- 在 Supabase SQL Editor 中执行
-- 确保以下函数已创建：
-- ✅ upsert_log_patch()
-- ✅ merge_arrays_by_log_id()  
-- ✅ remove_log_entry()
```

### 2. 验证API端点
- ✅ `/api/sync/logs` (GET/POST)
- ✅ `/api/sync/logs/remove-entry` (POST)

## 🧪 测试场景

### 场景1: 多端同时添加数据

**步骤**：
1. 设备A: 添加一条食物记录 (玉米)
2. 设备B: 同时添加一条运动记录 (跑步)
3. 两设备都同步到服务器

**预期结果**：
- ✅ 两条记录都保留
- ✅ 没有数据丢失
- ✅ 最后同步的设备包含所有数据

**测试数据**：
```json
// 设备A添加
{
  "foodEntries": [{
    "log_id": "food-001",
    "food_name": "玉米棒子",
    "consumed_grams": 200
  }]
}

// 设备B添加  
{
  "exerciseEntries": [{
    "log_id": "exercise-001", 
    "exercise_name": "跑步",
    "duration_minutes": 30
  }]
}

// 合并后应包含两条记录
```

### 场景2: 同一条目的并发编辑

**步骤**：
1. 设备A: 修改食物记录的重量 (200g → 250g)
2. 设备B: 修改同一食物记录的备注
3. 两设备同步

**预期结果**：
- ✅ 后同步的设备获胜
- ✅ 整个条目被最新版本替换
- ✅ 时间戳正确更新

### 场景3: 删除操作同步

**步骤**：
1. 设备A: 删除一条食物记录
2. 设备B: 添加一条新的运动记录
3. 两设备同步

**预期结果**：
- ✅ 食物记录在所有设备上被删除
- ✅ 新运动记录在所有设备上出现
- ✅ 数组长度正确

### 场景4: 离线编辑冲突

**步骤**：
1. 设备A: 离线添加3条记录
2. 设备B: 离线添加2条记录  
3. 设备A先同步
4. 设备B后同步

**预期结果**：
- ✅ 总共5条记录都保留
- ✅ 没有重复的 log_id
- ✅ 时间戳反映最后同步时间

## 🔍 验证方法

### 1. 数据库直接查询
```sql
-- 查看特定日期的日志数据
SELECT 
  user_id,
  date,
  jsonb_array_length(log_data->'foodEntries') as food_count,
  jsonb_array_length(log_data->'exerciseEntries') as exercise_count,
  last_modified
FROM daily_logs 
WHERE date = '2025-06-09'
ORDER BY last_modified DESC;

-- 检查数组内容
SELECT 
  date,
  jsonb_pretty(log_data->'foodEntries') as food_entries,
  jsonb_pretty(log_data->'exerciseEntries') as exercise_entries
FROM daily_logs 
WHERE user_id = 'your-user-id' AND date = '2025-06-09';
```

### 2. 前端控制台监控
```javascript
// 在浏览器控制台中监控同步日志
// 查找以下关键词：
// - "[Sync] Merging arrays"
// - "[Sync] Conflict detected" 
// - "[Sync] Successfully merged"
```

### 3. 网络请求检查
- 检查 `/api/sync/logs` 的请求体
- 验证 `log_data_patch` 字段内容
- 确认响应状态码为 200

## 🚨 常见问题排查

### 问题1: 数据仍然被覆盖
**可能原因**：
- `upsert_log_patch` 函数未正确部署
- 客户端仍使用旧的同步逻辑

**解决方案**：
```sql
-- 检查函数是否存在
SELECT proname FROM pg_proc WHERE proname = 'upsert_log_patch';

-- 重新部署函数
\i database/migrations/add-daily-logs-table.sql
```

### 问题2: log_id 重复
**可能原因**：
- 客户端生成 UUID 逻辑有问题
- 合并函数逻辑错误

**解决方案**：
```javascript
// 检查 log_id 生成
console.log('Generated log_id:', crypto.randomUUID());

// 验证合并逻辑
const merged = mergeEntriesByLogId(localEntries, serverEntries);
console.log('Merged entries:', merged);
```

### 问题3: 删除操作失败
**可能原因**：
- `remove_log_entry` 函数未部署
- API 端点路径错误

**解决方案**：
```bash
# 检查 API 端点
curl -X POST http://localhost:3000/api/sync/logs/remove-entry \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-06-09","entryType":"food","logId":"test-id"}'
```

## ✅ 成功标准

测试通过的标准：
- [ ] 所有场景测试通过
- [ ] 数据库中无重复 log_id
- [ ] 时间戳逻辑正确
- [ ] 删除操作同步成功
- [ ] 无数据丢失事件
- [ ] 前端用户体验良好

## 📊 性能监控

关注以下指标：
- **同步延迟**: < 2秒
- **冲突解决时间**: < 1秒  
- **数据库查询时间**: < 500ms
- **内存使用**: 合并操作不应导致内存泄漏

## 🔮 后续改进

基于测试结果的改进方向：
1. **可视化冲突解决** - 显示合并详情
2. **实时同步** - WebSocket 推送更新
3. **版本历史** - 保留数据变更历史
4. **性能优化** - 减少不必要的同步请求
