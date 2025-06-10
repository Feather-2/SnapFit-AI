# IndexedDB同步延迟问题分析

## 🔍 问题描述

当从云端同步数据到IndexedDB时，今日汇总中的卡路里摄入和运动消耗可能出现更新不及时的问题。

## 🏗️ 当前架构分析

### 数据流向
```
云端数据 → pullData() → batchSave() → IndexedDB → ??? → UI更新
```

### 关键组件

1. **DailySummary组件** (`components/daily-summary.tsx`)
   - 显示卡路里摄入、运动消耗、净卡路里等
   - 接收props: `summary`, `calculatedBMR`, `calculatedTDEE`

2. **首页状态管理** (`app/[locale]/page.tsx`)
   - `dailyLog` state包含summary数据
   - `loadDailyLog()` 函数从IndexedDB加载数据

3. **云同步机制** (`hooks/use-sync.ts`)
   - `pullData()` 从云端拉取数据
   - `batchSave()` 批量保存到IndexedDB

## ❌ 问题根因分析

### 1. **缺少数据变化监听机制**

**问题**: IndexedDB的`batchSave()`操作是静默的，不会主动通知React组件数据已更新。

```typescript
// hooks/use-indexed-db.ts:221-265
const batchSave = useCallback(async (items: any[]): Promise<void> => {
  // ... 批量保存逻辑
  transaction.oncomplete = () => {
    resolve(); // ✅ 操作完成，但没有通知机制
  };
}, [db, storeName]);
```

**影响**: 
- IndexedDB数据已更新
- React组件状态未更新
- UI显示旧数据

### 2. **React状态与IndexedDB数据不同步**

**问题**: 首页的`dailyLog` state只在特定时机更新：

```typescript
// app/[locale]/page.tsx:198-200
useEffect(() => {
  loadDailyLog(selectedDate); // 只在日期变化时加载
}, [selectedDate, loadDailyLog]);
```

**触发时机**:
- ✅ 日期变化时
- ✅ 强制刷新事件时 (`forceDataRefresh`)
- ✅ TEF缓存更新时
- ❌ IndexedDB数据同步时 (缺失!)

### 3. **云同步后缺少UI刷新**

**问题**: `pullData()`成功后没有触发UI更新：

```typescript
// hooks/use-sync.ts:259-264
await batchSave(filteredLogs);
console.log(`[Sync] Successfully saved logs to IndexedDB`);
// ❌ 没有触发UI刷新机制
if (!isPartOfFullSync) {
  toast({ title: t('success.pullTitle'), ... });
}
```

### 4. **事件机制不完整**

**现有事件**: 只有删除操作触发`forceDataRefresh`事件

```typescript
// hooks/use-sync.ts:574
window.dispatchEvent(new CustomEvent('forceDataRefresh', { detail: { date } }));
```

**缺失**: 数据同步完成后的刷新事件

## 🔧 解决方案

### 方案1: 在pullData后触发刷新事件

```typescript
// hooks/use-sync.ts
const pullData = useCallback(async (isPartOfFullSync = false) => {
  // ... 现有逻辑
  
  await batchSave(filteredLogs);
  
  // 🔥 新增: 触发数据刷新事件
  if (logsToUpdate.length > 0) {
    logsToUpdate.forEach(log => {
      window.dispatchEvent(new CustomEvent('forceDataRefresh', { 
        detail: { date: log.date } 
      }));
    });
  }
}, []);
```

### 方案2: 使用IndexedDB变化监听

```typescript
// hooks/use-indexed-db.ts
const batchSave = useCallback(async (items: any[]): Promise<void> => {
  // ... 现有逻辑
  
  transaction.oncomplete = () => {
    // 🔥 新增: 触发数据变化事件
    items.forEach(item => {
      if (item.date) {
        window.dispatchEvent(new CustomEvent('indexedDBDataChanged', {
          detail: { storeName, date: item.date, data: item }
        }));
      }
    });
    resolve();
  };
}, []);
```

### 方案3: 使用React Context + 事件总线

```typescript
// contexts/data-sync-context.tsx
const DataSyncContext = createContext({
  triggerRefresh: (date: string) => {},
  lastSyncTime: null
});

// 在首页监听context变化
const { lastSyncTime } = useContext(DataSyncContext);
useEffect(() => {
  if (lastSyncTime) {
    loadDailyLog(selectedDate);
  }
}, [lastSyncTime]);
```

### 方案4: 优化现有forceDataRefresh机制

```typescript
// hooks/use-sync.ts
const pullData = useCallback(async (isPartOfFullSync = false) => {
  // ... 现有逻辑
  
  await batchSave(filteredLogs);
  
  // 🔥 使用现有事件机制
  const updatedDates = new Set(logsToUpdate.map(log => log.date));
  updatedDates.forEach(date => {
    window.dispatchEvent(new CustomEvent('forceDataRefresh', { 
      detail: { date, source: 'cloudSync' } 
    }));
  });
}, []);
```

## 🎯 推荐解决方案

**推荐使用方案4**，原因：
1. ✅ 利用现有的`forceDataRefresh`事件机制
2. ✅ 最小化代码变更
3. ✅ 保持架构一致性
4. ✅ 易于测试和调试

## 🔄 实施步骤

1. **修改pullData函数**：在batchSave后触发刷新事件
2. **测试同步场景**：验证云端数据变化后UI及时更新
3. **添加日志**：便于调试同步问题
4. **性能优化**：避免重复刷新同一日期

## 📊 预期效果

修复后的数据流：
```
云端数据 → pullData() → batchSave() → IndexedDB → forceDataRefresh事件 → loadDailyLog() → UI更新
```

用户体验改善：
- ✅ 云同步后立即看到最新数据
- ✅ 多设备数据一致性
- ✅ 减少用户困惑和重复操作
