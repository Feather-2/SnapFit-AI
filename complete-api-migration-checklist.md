# 完整的AI服务API迁移清单

## 🎯 **迁移概述**

将所有AI服务从私有配置迁移到共享模型，并添加严格的使用限额控制。

## 📋 **API端点迁移清单**

### **✅ 已完成迁移（添加限额控制）**

#### **1. 专家对话**
- **端点**: `/api/openai/chat`
- **状态**: ✅ 已添加限额控制
- **模型**: 使用 `chatModel` 配置
- **限额**: 计入 `conversation_count`

#### **2. 图像解析**
- **端点**: `/api/openai/parse-image`
- **状态**: ✅ 已添加限额控制
- **模型**: 使用 `visionModel` 配置
- **限额**: 计入 `conversation_count`

#### **3. 智能建议**
- **端点**: `/api/openai/smart-suggestions-shared`
- **状态**: ✅ 已使用共享模型 + 已添加限额控制
- **模型**: 使用共享模型
- **限额**: 计入 `conversation_count`

### **🔄 需要前端更新（新建共享版本）**

#### **4. 健康建议**
```typescript
// 旧端点
❌ /api/openai/advice

// 新端点
✅ /api/openai/advice-shared
```
- **状态**: ✅ 已创建共享版本
- **需要**: 前端更新调用端点
- **限额**: 计入 `conversation_count`

#### **5. 流式健康建议**
```typescript
// 旧端点
❌ /api/openai/advice-stream

// 新端点
✅ /api/openai/advice-stream-shared
```
- **状态**: ✅ 已创建共享版本
- **需要**: 前端更新调用端点
- **限额**: 计入 `conversation_count`

#### **6. TEF分析**
```typescript
// 旧端点
❌ /api/openai/tef-analysis

// 新端点
✅ /api/openai/tef-analysis-shared
```
- **状态**: ✅ 已创建共享版本
- **需要**: 前端更新调用端点
- **限额**: 计入 `conversation_count`

#### **7. 文本解析**
```typescript
// 旧端点
❌ /api/openai/parse

// 新端点
✅ /api/openai/parse-shared
```
- **状态**: ✅ 已创建共享版本
- **需要**: 前端更新调用端点
- **限额**: 计入 `conversation_count`

## 🔍 **前端更新指南**

### **1. 健康建议页面**
```typescript
// 文件: 可能在 components/health/ 或 pages/ 中
// 查找调用 /api/openai/advice 的地方

// 之前
const response = await fetch('/api/openai/advice', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-ai-config': JSON.stringify(aiConfig) // ❌ 移除
  },
  body: JSON.stringify({ dailyLog, userProfile })
})

// 现在
const response = await fetch('/api/openai/advice-shared', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ dailyLog, userProfile })
})
```

### **2. 流式建议页面**
```typescript
// 查找调用 /api/openai/advice-stream 的地方

// 之前
const response = await fetch('/api/openai/advice-stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-ai-config': JSON.stringify(aiConfig) // ❌ 移除
  },
  body: JSON.stringify({ dailyLog, userProfile })
})

// 现在
const response = await fetch('/api/openai/advice-stream-shared', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ dailyLog, userProfile })
})
```

### **3. TEF分析功能**
```typescript
// 查找调用 /api/openai/tef-analysis 的地方

// 之前
const response = await fetch('/api/openai/tef-analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-ai-config': JSON.stringify(aiConfig) // ❌ 移除
  },
  body: JSON.stringify({ foodEntries })
})

// 现在
const response = await fetch('/api/openai/tef-analysis-shared', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ foodEntries })
})
```

### **4. 文本解析功能**
```typescript
// 查找调用 /api/openai/parse 的地方

// 之前
const response = await fetch('/api/openai/parse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-ai-config': JSON.stringify(aiConfig) // ❌ 移除
  },
  body: JSON.stringify({ text, type, userWeight })
})

// 现在
const response = await fetch('/api/openai/parse-shared', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ text, type, userWeight })
})
```

## 🚨 **错误处理更新**

### **统一的错误处理**
```typescript
const response = await fetch('/api/openai/xxx-shared', { ... })
const data = await response.json()

if (!response.ok) {
  switch (data.code) {
    case 'LIMIT_EXCEEDED':
      // 🚫 显示限额超过提示
      showLimitExceededDialog({
        currentUsage: data.details.currentUsage,
        dailyLimit: data.details.dailyLimit,
        trustLevel: data.details.trustLevel,
        resetTime: data.details.resetTime
      })
      break
    
    case 'UNAUTHORIZED':
      // 重定向到登录页面
      router.push('/login')
      break
    
    case 'USER_NOT_FOUND':
      // 用户信息异常，可能需要重新登录
      showError('用户信息异常，请重新登录')
      break
    
    case 'AI_SERVICE_ERROR':
      // AI服务暂时不可用
      showError('AI服务暂时不可用，请稍后重试')
      break
    
    default:
      // 其他错误
      showError(data.error || '请求失败')
  }
  return
}

// ✅ 成功处理
const result = data
```

## 📊 **使用量集成**

### **在AI功能页面添加使用量显示**
```tsx
import { UsageIndicator } from '@/components/usage/usage-indicator'
import { useUsageLimit } from '@/hooks/use-usage-limit'

function AIFeaturePage() {
  const { canUse, remaining, startConversation } = useUsageLimit()
  
  const handleAIRequest = async () => {
    // 🔒 检查并记录使用量
    const result = await startConversation()
    if (!result.success) {
      showError(result.error)
      return
    }
    
    // ✅ 继续AI服务调用
    const response = await fetch('/api/openai/xxx-shared', { ... })
    // ... 处理响应
  }
  
  return (
    <div>
      <UsageIndicator variant="compact" />
      <Button 
        onClick={handleAIRequest}
        disabled={!canUse}
      >
        使用AI功能 {remaining > 0 && `(剩余${remaining}次)`}
      </Button>
    </div>
  )
}
```

## 🧪 **测试验证**

### **功能测试清单**
- [ ] 健康建议功能（新端点）
- [ ] 流式建议功能（新端点）
- [ ] TEF分析功能（新端点）
- [ ] 文本解析功能（新端点）
- [ ] 限额控制正常工作
- [ ] 错误处理正确显示
- [ ] 使用量显示正确更新

### **限额测试清单**
- [ ] LV0用户无法使用任何AI功能
- [ ] LV1用户每天只能使用40次
- [ ] LV2用户每天只能使用80次
- [ ] LV3/LV4用户每天只能使用150次
- [ ] 超过限额时正确显示错误信息
- [ ] 并发请求不能突破限额

## 🚀 **部署步骤**

### **1. 后端部署**
- ✅ 部署新的共享API端点
- ✅ 部署限额控制系统
- ✅ 执行数据库迁移

### **2. 前端更新**
- [ ] 更新健康建议功能调用
- [ ] 更新流式建议功能调用
- [ ] 更新TEF分析功能调用
- [ ] 更新文本解析功能调用
- [ ] 添加统一错误处理
- [ ] 集成使用量显示

### **3. 测试验证**
- [ ] 执行完整功能测试
- [ ] 执行限额控制测试
- [ ] 验证错误处理
- [ ] 验证使用量显示

### **4. 清理工作**
- [ ] 重命名旧API文件为legacy版本
- [ ] 删除key_usage_logs表（可选）
- [ ] 更新文档

现在所有AI服务都将受到严格的限额控制，确保系统安全和资源合理分配！🛡️
