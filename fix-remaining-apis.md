# 剩余API修复指南

## 需要修复的API列表

1. ✅ **Smart Suggestions API** - 已完成
2. ✅ **TEF Analysis API** - 已完成  
3. ✅ **Advice Stream API** - 已完成
4. ✅ **Advice API** - 已完成
5. ⏳ **Parse Image API** - 部分完成（需要继续）
6. ⏳ **Parse with Images API** - 待修复
7. ⏳ **Parse Shared API** - 待修复
8. ⏳ **Chat API** - 待修复

## 统一修复模式

对于每个API，需要进行以下修改：

### 1. 修改导入语句
```typescript
// 替换
import { auth } from '@/lib/auth'
import { UsageManager } from '@/lib/usage-manager'
import { UserManager } from '@/lib/user-manager'

// 为
import { checkApiAuth, rollbackUsageIfNeeded } from '@/lib/api-auth-helper'
```

### 2. 修改API开始部分
```typescript
// 替换原来的身份验证和限制检查逻辑
export async function POST(req: Request) {
  try {
    // 获取请求数据
    const { /* 请求参数 */, aiConfig } = await req.json()

    // 验证必需参数
    if (!/* 必需参数 */) {
      return Response.json({ error: "Missing required data" }, { status: 400 })
    }

    // 🔒 统一的身份验证和限制检查（只对共享模式进行限制）
    const authResult = await checkApiAuth(aiConfig, 'conversation_count') // 或 'image_count'
    
    if (!authResult.success) {
      return Response.json({
        error: authResult.error!.message,
        code: authResult.error!.code
      }, { status: authResult.error!.status })
    }

    const { session, usageManager } = authResult
```

### 3. 修改模型配置部分
```typescript
    // 获取用户选择的模型
    let selectedModel = "默认模型"
    let fallbackConfig: { baseUrl: string; apiKey: string } | undefined = undefined
    const isSharedMode = aiConfig?.modelType?.source === 'shared' // modelType根据API调整

    if (isSharedMode && aiConfig?.modelType?.sharedKeyConfig?.selectedModel) {
      // 共享模式：使用 selectedModel
      selectedModel = aiConfig.modelType.sharedKeyConfig.selectedModel
    } else if (!isSharedMode) {
      // 私有模式：使用用户自己的配置
      if (aiConfig?.modelType?.name) {
        selectedModel = aiConfig.modelType.name
      }
      
      // 设置私有配置作为fallback
      if (aiConfig?.modelType?.baseUrl && aiConfig?.modelType?.apiKey) {
        fallbackConfig = {
          baseUrl: aiConfig.modelType.baseUrl,
          apiKey: aiConfig.modelType.apiKey
        }
      } else {
        // 🔄 私有配置不完整，回滚使用计数（如果需要）
        await rollbackUsageIfNeeded(usageManager || null, session.user.id, 'conversation_count')
        return Response.json({ 
          error: "私有模式需要完整的AI配置（模型名称、API地址、API密钥）",
          code: "INCOMPLETE_AI_CONFIG"
        }, { status: 400 })
      }
    }

    // 创建共享客户端（支持私有模式fallback）
    const sharedClient = new SharedOpenAIClient({
      userId: session.user.id,
      preferredModel: selectedModel,
      fallbackConfig,
      preferPrivate: !isSharedMode // 私有模式优先使用私有配置
    })
```

### 4. 简化错误处理
```typescript
  } catch (error) {
    console.error('API error:', error)
    return Response.json({
      error: "API request failed",
      code: "AI_SERVICE_ERROR"
    }, { status: 500 })
  }
```

## 模型类型映射

- **Smart Suggestions, TEF Analysis, Advice, Parse Shared**: `aiConfig.agentModel`
- **Parse Image, Parse with Images**: `aiConfig.visionModel`  
- **Chat**: `aiConfig.chatModel`

## 使用计数类型

- **大部分API**: `'conversation_count'`
- **图像解析API**: `'image_count'`

## 关键改进

1. **私有模式用户不被计算使用次数**
2. **私有模式用户不受限制检查**
3. **统一的错误处理**
4. **更简洁的代码结构**

## 验证步骤

修复完成后，测试：
1. 私有模式用户使用自定义模型
2. 共享模式用户正常使用限制
3. 配置不完整时的错误处理
