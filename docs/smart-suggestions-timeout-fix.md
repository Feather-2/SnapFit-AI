# Smart Suggestions 超时问题解决方案

## 问题描述

在 Vercel 上部署时，`smart-suggestions-shared` API 经常出现超时问题：

1. **函数超时限制**：Vercel 计划有不同的函数执行时间限制
   - Hobby: 默认 10秒，最大 **60秒**
   - Pro: 默认 15秒，最大 **300秒** (5分钟)
   - Enterprise: 默认 15秒，最大 **900秒** (15分钟)
2. **并发 AI 请求**：智能建议功能同时发起多个 AI API 请求
3. **网络延迟**：第三方 AI 服务响应时间不稳定
4. **提示词复杂度**：原始提示词过长，AI 处理时间较长

## 重要澄清 ⚠️

**之前的误解**：Hobby 版只有 10 秒限制
**实际情况**：Hobby 版可以配置到 **60 秒**，Pro 版可以到 **300 秒**

## 已实施的解决方案

### 1. 调整 Vercel 配置 (`vercel.json`)

```json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    },
    "app/api/openai/smart-suggestions-shared/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**重要更新**：
- ✅ **Hobby 版支持 60 秒**：无需升级到 Pro 即可使用 60 秒超时
- ✅ **Pro 版支持 300 秒**：如需更长时间可升级到 Pro
- ✅ **配置已优化**：现在使用接近最大限制的安全值

### 2. 环境感知超时配置 (`lib/openai-client.ts`)

```typescript
// 检测是否在 Vercel 环境中运行
const isVercelEnvironment = process.env.VERCEL === '1'

const TIMEOUT_CONFIG = {
  SMART_SUGGESTIONS: isVercelEnvironment ? 35000 : 60000   // Vercel: 35秒, 其他: 60秒
}
```

### 3. 创建 Vercel 优化配置 (`lib/vercel-config.ts`)

专门的配置文件，包含：
- 环境检测
- 动态超时配置
- 智能建议专用设置
- 优化开关

### 4. 简化 AI 提示词

**优化前**：
```typescript
const prompt = `
你是一位注册营养师(RD)，专精宏量营养素配比和膳食结构优化。
数据：${JSON.stringify(dataSummary, null, 2)}
请提供3-4个具体的营养优化建议，JSON格式：...
`
```

**优化后**：
```typescript
const prompt = `营养师分析：${JSON.stringify(dataSummary, null, 2)}
请提供2-3个营养建议，JSON格式：...（简化格式）`
```

### 5. 添加多层超时保护

```typescript
// 单个请求超时
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Request timeout')), 35000)
})

// 总体超时
const overallTimeoutPromise = new Promise((resolve) => {
  setTimeout(() => resolve([]), 50000)
})
```

### 6. 优化前端错误处理

```typescript
// 客户端超时控制
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 55000);

// 区分不同类型的错误
if (response.status === 408 && errorData.code === 'REQUEST_TIMEOUT') {
  // 专门的超时错误处理
}
```

## 推荐的部署策略

### 方案 1：升级 Vercel Pro（推荐）
- 成本：$20/月
- 函数超时：60 秒
- 更稳定的性能

### 方案 2：使用私有 API 配置
- 用户配置自己的 AI API 密钥
- 绕过共享密钥限制
- 更好的服务质量

### 方案 3：分步骤生成（备选）
- 将营养和运动建议分开请求
- 减少单次请求复杂度
- 提高成功率

## 监控和调试

### 添加的日志记录
```typescript
console.log(`[Smart Suggestions] Starting request at ${new Date().toISOString()}`);
console.log(`[Smart Suggestions] Vercel environment: ${VERCEL_CONFIG.isVercel}`);
console.log(`[Smart Suggestions] Completed successfully in ${duration}ms`);
```

### 性能指标
- 请求开始时间
- 处理总时长
- 环境信息
- 超时配置

## 测试建议

1. **本地测试**：确保功能在本地环境正常
2. **Vercel 预览**：在预览环境测试超时配置
3. **生产验证**：监控生产环境的性能表现
4. **错误处理**：测试各种超时场景的用户体验

## 故障排除

### 如果仍然超时
1. 检查 Vercel 计划类型
2. 验证环境变量配置
3. 测试 AI API 连接速度
4. 考虑使用更快的 AI 模型

### 常见错误码
- `408 REQUEST_TIMEOUT`：请求超时
- `503 SHARED_KEYS_EXHAUSTED`：共享密钥耗尽
- `AbortError`：客户端取消请求

## 下一步优化

1. **实施请求缓存**：避免重复生成相同建议
2. **添加重试机制**：自动重试失败的请求
3. **使用 Edge Functions**：更快的冷启动时间
4. **实现渐进式加载**：先显示部分结果，再补充完整内容
