# 信任等级使用限额系统

## 🎯 **系统概述**

基于用户信任等级的每日对话次数限额系统，确保资源合理分配和用户体验。

### **限额配置**
```
LV0: 0次/天    (新用户，无法使用)
LV1: 40次/天   (信任用户)
LV2: 80次/天   (高级用户)
LV3: 150次/天  (VIP用户)
LV4: 150次/天  (超级VIP)
```

## 🔧 **技术架构**

### **1. 配置管理**

#### **配置文件** (`config/trust-level-limits.ts`)
```typescript
export const TRUST_LEVEL_CONFIGS: Record<number, TrustLevelConfig> = {
  1: {
    level: 1,
    name: "信任用户",
    limits: {
      dailyConversations: 40,  // 🔥 可配置
      dailyApiCalls: 100,
      monthlyUploads: 10
    },
    permissions: {
      canUseSharedService: true,
      canShareKeys: true
    }
  }
  // ... 其他等级
}
```

#### **配置特性**
- ✅ **不写死**: 所有限额都在配置文件中
- ✅ **易修改**: 修改配置文件即可调整限额
- ✅ **类型安全**: TypeScript类型定义
- ✅ **扩展性**: 支持添加新的限额类型

### **2. 数据存储**

#### **daily_logs表结构**
```sql
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  log_data JSONB NOT NULL,  -- 存储使用数据
  last_modified TIMESTAMP,
  UNIQUE(user_id, date)     -- 每用户每天一条记录
);
```

#### **log_data结构**
```json
{
  "conversation_count": 15,
  "api_call_count": 45,
  "upload_count": 3,
  "last_conversation_at": "2024-01-15T10:30:00Z"
}
```

### **3. 使用量管理**

#### **UsageManager类**
```typescript
class UsageManager {
  // 检查是否可以使用
  async checkConversationLimit(userId: string, trustLevel: number)
  
  // 记录使用
  async recordConversationUsage(userId: string)
  
  // 获取统计
  async getUserUsageStats(userId: string, days: number)
}
```

#### **核心方法**
- `checkConversationLimit()` - 检查是否还有剩余次数
- `recordConversationUsage()` - 记录一次使用
- `getUserUsageStats()` - 获取使用统计

## 🔄 **使用流程**

### **对话前检查**
```typescript
// 1. 检查限额
const check = await usageManager.checkConversationLimit(userId, trustLevel)

if (!check.allowed) {
  return { error: '已达到每日限额' }
}

// 2. 记录使用
await usageManager.recordConversationUsage(userId)

// 3. 开始对话
return { success: true }
```

### **API端点**
```
GET  /api/usage/check?type=conversation  - 检查限额
POST /api/usage/check                    - 记录使用
GET  /api/usage/stats?days=7             - 获取统计
```

## 🎨 **用户界面**

### **1. 导航栏显示**
```
[头像👑] 用户名
         [👑 LV3] [✓ 可使用共享服务]
         今日对话额度: [15/150] ████░░░░░░ 10%
```

#### **组件**
- `UsageBadge` - 显示当前使用量
- `UsageProgress` - 显示使用进度条
- `UsageIndicator` - 完整的使用量卡片

### **2. 使用量指示器**
```
┌─────────────────────────────────────┐
│ 💬 每日对话额度              [LV3] │
├─────────────────────────────────────┤
│ ✅ 额度充足                         │
│ 15 / 150                           │
│ ████░░░░░░░░░░░░░░░░ 10%            │
│ 已使用 10% • 14小时30分钟后重置     │
├─────────────────────────────────────┤
│ ✅ 您还可以进行 135 次对话          │
├─────────────────────────────────────┤
│ 📈 7日统计                         │
│ 总对话: 89次  日均对话: 12次        │
└─────────────────────────────────────┘
```

### **3. React Hook**
```typescript
const {
  usageInfo,        // 当前使用情况
  canUse,          // 是否可以使用
  remaining,       // 剩余次数
  usagePercentage, // 使用百分比
  startConversation // 开始对话（检查+记录）
} = useUsageLimit()
```

## 📊 **不同等级的体验**

### **LV0 新用户**
```
❌ 无法使用对话功能
💡 提示：提升到LV1获得40次/天额度
```

### **LV1 信任用户**
```
✅ 40次/天对话额度
📊 导航栏显示使用进度
⚠️ 接近限额时提醒
```

### **LV2 高级用户**
```
✅ 80次/天对话额度 (翻倍)
📈 更宽松的使用体验
```

### **LV3-4 VIP用户**
```
✅ 150次/天对话额度 (最高)
👑 VIP身份标识
🎯 充足的使用额度
```

## 🔍 **监控和统计**

### **用户统计**
- 📊 **每日使用量**: 当天已使用次数
- 📈 **历史趋势**: 7天/30天使用趋势
- 🎯 **平均使用**: 日均使用量
- ⏰ **重置时间**: 下次重置倒计时

### **系统统计**
- 👥 **用户分布**: 各等级用户数量
- 📊 **使用分布**: 各等级使用量分布
- 🔥 **热门时段**: 使用高峰时段
- 📈 **增长趋势**: 使用量增长趋势

## 🛡️ **安全和性能**

### **防刷机制**
- 🔒 **用户认证**: 必须登录才能使用
- 🎯 **精确计数**: 每次使用都准确记录
- ⏰ **时间窗口**: 按自然日重置
- 🚫 **超限拒绝**: 超过限额立即拒绝

### **性能优化**
- 📊 **JSONB存储**: 高效的JSON数据存储
- 🔍 **索引优化**: 用户ID+日期复合索引
- 🗑️ **自动清理**: 90天后自动删除旧数据
- ⚡ **缓存策略**: 热点数据缓存

## 🚀 **业务价值**

### **资源管理**
- 💰 **成本控制**: 防止资源滥用
- ⚖️ **公平分配**: 根据贡献分配资源
- 📈 **激励机制**: 鼓励用户提升等级

### **用户体验**
- 🎯 **明确预期**: 用户知道自己的限额
- 📊 **透明展示**: 实时显示使用情况
- 🏆 **等级激励**: 提升等级获得更多额度

### **社区建设**
- 🤝 **等级体系**: 清晰的用户等级划分
- 🏅 **身份认同**: 高等级用户获得特权
- 🌟 **活跃促进**: 激励用户参与社区

## 🔄 **扩展性**

### **新增限额类型**
```typescript
// 配置文件中添加新限额
limits: {
  dailyConversations: 40,
  dailyImageGeneration: 10,  // 🔥 新增
  monthlyFileStorage: 1000   // 🔥 新增
}
```

### **新增权限**
```typescript
permissions: {
  canUseSharedService: true,
  canGenerateImages: true,   // 🔥 新增
  canAccessPremiumModels: false // 🔥 新增
}
```

### **动态配置**
- 🔧 **管理界面**: 后台动态调整限额
- 📊 **A/B测试**: 不同用户组不同限额
- 🎯 **个性化**: 基于用户行为调整限额

现在系统具备了完善的信任等级限额管理，确保资源合理分配的同时提供良好的用户体验！🎯
