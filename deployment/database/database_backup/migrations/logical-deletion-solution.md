# 🗑️ 逻辑删除解决方案

## 问题描述

**当前删除冲突问题**：
- A端删除条目 → 服务器删除成功
- B、C端不知道这个删除操作 → 条目仍然存在
- 下次B、C端同步时，可能会把已删除的条目重新"复活"

## 解决方案：逻辑删除（墓碑记录）

### 1. **核心思想**

不直接从数组中删除条目，而是：
1. **保留原始数据**：条目仍然存在于数组中
2. **添加删除标记**：在 `deletedFoodIds` 或 `deletedExerciseIds` 数组中记录已删除的ID
3. **过滤显示**：前端显示时过滤掉已删除的条目
4. **同步传播**：删除标记会同步到所有设备

### 2. **数据结构变更**

#### **DailyLog 类型更新**
```typescript
export interface DailyLog {
  // ... 现有字段 ...
  deletedFoodIds?: string[]     // 已删除的食物条目ID列表
  deletedExerciseIds?: string[] // 已删除的运动条目ID列表
}
```

#### **数据库存储示例**
```json
{
  "foodEntries": [
    {"log_id": "food1", "name": "Apple"},
    {"log_id": "food2", "name": "Banana"},
    {"log_id": "food3", "name": "Orange"}
  ],
  "deletedFoodIds": ["food2"],  // Banana被删除了
  "exerciseEntries": [
    {"log_id": "ex1", "name": "Running"},
    {"log_id": "ex2", "name": "Swimming"}
  ],
  "deletedExerciseIds": ["ex1"] // Running被删除了
}
```

### 3. **实现细节**

#### **A. 删除操作流程**
1. **本地删除**：从UI数组中移除条目
2. **添加墓碑**：将ID添加到 `deletedFoodIds` 或 `deletedExerciseIds`
3. **同步推送**：通过 `pushData` 推送删除信息
4. **服务器合并**：服务器智能合并删除标记

#### **B. 数据拉取流程**
1. **服务器返回**：包含完整数据和删除标记
2. **本地过滤**：根据删除标记过滤条目
3. **UI显示**：只显示未删除的条目

#### **C. 冲突解决**
- **编辑vs删除**：如果条目被删除，编辑操作被忽略
- **删除vs编辑**：删除优先，编辑的条目仍然被标记为删除
- **重复删除**：删除标记去重，避免重复

### 4. **优势**

✅ **完全解决删除传播问题**：所有设备都能收到删除信息
✅ **数据安全**：原始数据不丢失，可以恢复
✅ **冲突处理**：明确的删除优先策略
✅ **向后兼容**：旧数据仍然可以正常工作
✅ **性能友好**：只需要简单的数组过滤

### 5. **实施步骤**

#### **步骤1：数据库函数更新**
```sql
-- 执行 database/migrations/fix-optimistic-lock.sql
-- 包含更新的 merge_arrays_by_log_id 和 upsert_log_patch 函数
```

#### **步骤2：前端类型更新**
```typescript
// lib/types.ts 已更新
// 添加了 deletedFoodIds 和 deletedExerciseIds 字段
```

#### **步骤3：删除逻辑更新**
```typescript
// hooks/use-sync.ts 中的 removeEntry 函数已更新
// 使用逻辑删除而不是物理删除
```

#### **步骤4：数据过滤更新**
```typescript
// hooks/use-sync.ts 中的 pullData 函数已更新
// 自动过滤已删除的条目
```

### 6. **测试场景**

#### **场景1：基本删除传播**
1. 设备A删除一个食物条目
2. 设备B手动同步
3. 验证：设备B上该条目消失

#### **场景2：编辑vs删除冲突**
1. 设备A删除条目X
2. 设备B编辑条目X
3. 验证：条目X保持删除状态

#### **场景3：离线删除同步**
1. 设备A离线，删除条目Y
2. 设备A重新上线，自动同步
3. 其他设备同步后，条目Y消失

### 7. **清理策略（可选）**

为了避免删除标记无限增长，可以考虑：

#### **定期清理**
- 删除超过30天的墓碑记录
- 只保留最近的删除标记

#### **智能清理**
- 如果原始条目已经不存在，可以移除对应的删除标记
- 在数据合并时自动清理无效的删除标记

### 8. **监控和调试**

#### **日志输出**
```
[Sync] Successfully removed food entry food123 using logical deletion
[Sync] Filtered 2 deleted entries from foodEntries array
[Sync] Conflict resolved: keeping deletion for entry food456
```

#### **数据验证**
- 检查删除标记的一致性
- 验证过滤逻辑的正确性
- 监控删除标记的增长情况

---

## 总结

这个逻辑删除解决方案彻底解决了多设备删除同步问题，同时保持了数据的完整性和系统的稳定性。通过墓碑记录机制，我们确保删除操作能够正确传播到所有设备，避免了"删除复活"的问题。
