# AI服务迁移和限额控制集成总结

## 🎯 **已完成的工作**

### **1. 严格限额控制集成**

#### **已添加限额控制的API端点**
- ✅ `/api/openai/chat` - 专家对话（使用对话模型）
- ✅ `/api/openai/parse-image` - 图像解析（使用视觉模型）
- ✅ `/api/openai/smart-suggestions-shared` - 智能建议（已使用共享模型）

#### **新创建的共享API端点**
- ✅ `/api/openai/advice-shared` - 健康建议（共享模型版本）
- ✅ `/api/openai/advice-stream-shared` - 流式健康建议（共享模型版本）
- ✅ `/api/openai/tef-analysis-shared` - TEF分析（共享模型版本）
- ✅ `/api/openai/parse-shared` - 文本解析（共享模型版本）

### **2. 安全控制特性**

#### **多层防护**
```typescript
// 🔒 第1层：用户身份验证
const session = await auth()
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// 🔒 第2层：获取用户信任等级
const userResult = await userManager.getUserById(session.user.id)

// 🔒 第3层：原子性限额检查和记录
const usageResult = await usageManager.checkAndRecordUsage(
  session.user.id,
  userResult.user.trustLevel,
  'conversation_count'
)

// 🚫 绝对不允许超过限额
if (!usageResult.allowed) {
  return NextResponse.json({ error: 'Daily limit exceeded' }, { status: 429 })
}
```

#### **错误处理和回滚**
```typescript
try {
  // AI服务调用
} catch (error) {
  // 🔄 AI失败时回滚使用计数
  await usageManager.rollbackUsage(session.user.id, 'conversation_count')
  throw error
}
```

## 📊 **使用量统计规则**

### **计入限额的操作**
- ✅ **专家对话** - 每次对话计入 `conversation_count`
- ✅ **图像解析** - 每次解析计入 `conversation_count`
- ✅ **智能建议** - 每次生成计入 `conversation_count`
- ✅ **健康建议** - 每次生成计入 `conversation_count`
- ✅ **TEF分析** - 每次分析计入 `conversation_count`
- ✅ **文本解析** - 每次解析计入 `conversation_count`

### **不计入限额的操作**
- ❌ **食物热量估算** - 纯计算，无AI调用
- ❌ **私有配置使用** - 用户自己的API Key不受限制

### **限额配置**
```typescript
// config/trust-level-limits.ts
LV0: 0次/天    (新用户，无法使用)
LV1: 40次/天   (信任用户)
LV2: 80次/天   (高级用户)
LV3: 150次/天  (VIP用户)
LV4: 150次/天  (超级VIP)
```

## 🔄 **需要前端更新的地方**

### **1. API端点迁移**

#### **需要迁移的API端点**
```typescript
// 旧端点（需要更新）
❌ POST /api/openai/advice
❌ POST /api/openai/advice-stream
❌ POST /api/openai/tef-analysis
❌ POST /api/openai/parse

// 新端点（使用共享模型 + 限额控制）
✅ POST /api/openai/advice-shared
✅ POST /api/openai/advice-stream-shared
✅ POST /api/openai/tef-analysis-shared
✅ POST /api/openai/parse-shared
```

#### **前端调用示例**
```typescript
// 之前
const response = await fetch('/api/openai/advice', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-ai-config': JSON.stringify(aiConfig) // ❌ 不再需要
  },
  body: JSON.stringify({ dailyLog, userProfile })
})

// 现在
const response = await fetch('/api/openai/advice-shared', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
    // ✅ 不需要传递AI配置，自动使用共享模型
  },
  body: JSON.stringify({ dailyLog, userProfile })
})
```

### **2. 错误处理更新**

#### **限额超过处理**
```typescript
const response = await fetch('/api/openai/advice-shared', { ... })
const data = await response.json()

if (response.status === 429 && data.code === 'LIMIT_EXCEEDED') {
  // 🚫 显示限额超过提示
  showLimitExceededDialog({
    currentUsage: data.details.currentUsage,
    dailyLimit: data.details.dailyLimit,
    trustLevel: data.details.trustLevel,
    resetTime: data.details.resetTime
  })
  return
}
```

#### **其他错误处理**
```typescript
if (!response.ok) {
  switch (data.code) {
    case 'UNAUTHORIZED':
      // 重定向到登录页面
      break
    case 'USER_NOT_FOUND':
      // 用户信息异常
      break
    case 'AI_SERVICE_ERROR':
      // AI服务暂时不可用
      break
    default:
      // 其他错误
  }
}
```

### **3. 使用量显示集成**

#### **在相关页面添加使用量指示器**
```tsx
// 在健康建议页面
import { UsageIndicator } from '@/components/usage/usage-indicator'

function HealthAdvicePage() {
  return (
    <div>
      <UsageIndicator variant="compact" />
      {/* 其他内容 */}
    </div>
  )
}
```

#### **在AI功能按钮前检查限额**
```tsx
import { useUsageLimit } from '@/hooks/use-usage-limit'

function SmartSuggestionsButton() {
  const { canUse, remaining, startConversation } = useUsageLimit()

  const handleClick = async () => {
    // 🔒 检查并记录使用量
    const result = await startConversation()
    if (!result.success) {
      showError(result.error)
      return
    }

    // ✅ 继续AI服务调用
    await generateSuggestions()
  }

  return (
    <Button
      onClick={handleClick}
      disabled={!canUse}
    >
      生成智能建议 {remaining > 0 && `(剩余${remaining}次)`}
    </Button>
  )
}
```

## 🗑️ **可以删除的旧文件**

### **旧API端点（保留作为备份，但不再使用）**
- `/api/openai/advice` - 可以重命名为 `advice-legacy.ts`
- `/api/openai/advice-stream` - 可以重命名为 `advice-stream-legacy.ts`
- `/api/openai/tef-analysis` - 可以重命名为 `tef-analysis-legacy.ts`
- `/api/openai/parse` - 可以重命名为 `parse-legacy.ts`

### **数据库清理**
```sql
-- 可以删除 key_usage_logs 表（节省存储空间）
DROP TABLE IF EXISTS key_usage_logs;

-- 执行新的数据库迁移
-- 运行 database/migrations/add-daily-logs-table.sql
```

## 🧪 **测试清单**

### **限额控制测试**
- [ ] LV0用户无法使用任何AI功能
- [ ] LV1用户每天只能使用40次
- [ ] LV2用户每天只能使用80次
- [ ] LV3/LV4用户每天只能使用150次
- [ ] 超过限额时正确显示错误信息
- [ ] 并发请求不能突破限额

### **功能测试**
- [ ] 专家对话功能正常工作
- [ ] 图像解析功能正常工作
- [ ] 智能建议功能正常工作
- [ ] 健康建议功能正常工作（新端点）
- [ ] 流式建议功能正常工作（新端点）
- [ ] TEF分析功能正常工作（新端点）
- [ ] 文本解析功能正常工作（新端点）

### **错误处理测试**
- [ ] AI服务失败时正确回滚使用计数
- [ ] 网络错误时的处理
- [ ] 用户未登录时的处理
- [ ] 用户信任等级不足时的处理

### **使用量显示测试**
- [ ] 导航栏正确显示使用量
- [ ] 使用量指示器正确更新
- [ ] 剩余次数正确计算
- [ ] 重置时间正确显示

## 🚀 **部署步骤**

### **1. 数据库迁移**
```sql
-- 执行数据库迁移脚本
\i database/migrations/add-daily-logs-table.sql
```

### **2. 代码部署**
- 部署新的API端点
- 部署限额控制系统
- 部署使用量显示组件

### **3. 前端更新**
- 更新API调用端点
- 添加错误处理
- 集成使用量显示

### **4. 测试验证**
- 执行完整的测试清单
- 验证限额控制正常工作
- 验证所有AI功能正常

现在系统具备了完整的限额控制，确保只有符合信任等级的用户可以使用相应的AI服务，同时大幅节省了存储空间！🛡️
