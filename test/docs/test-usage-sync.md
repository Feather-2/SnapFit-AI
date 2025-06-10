# 使用量同步测试指南

## 问题描述
用户反馈：导航区域的使用次数刷新与用户卡片里的不同步。

## 解决方案
我们实现了以下改进来解决使用量同步问题：

### 1. 改进的使用量Hook (`hooks/use-usage-limit.ts`)
- **减少节流时间**：从2分钟减少到1分钟，减少延迟
- **跨组件事件广播**：使用CustomEvent在所有组件间同步使用量更新
- **自动事件监听**：所有使用该hook的组件都会自动监听使用量更新事件

### 2. 前端组件更新
在所有使用AI服务的组件中添加了使用量刷新逻辑：

#### 聊天页面 (`app/[locale]/chat/page.tsx`)
```typescript
onFinish: (message) => {
  // 🔄 聊天完成后刷新使用量信息，确保所有组件同步
  if (message.role === 'assistant') {
    console.log('[Chat] Refreshing usage info after successful chat')
    refreshUsageInfo()
  }
}
```

#### 健康建议组件 (`components/agent-advice.tsx`)
```typescript
// 🔄 建议生成完成后刷新使用量信息，确保所有组件同步
console.log('[AgentAdvice] Refreshing usage info after successful advice generation')
refreshUsageInfo()
```

#### 主页面 (`app/[locale]/page.tsx`)
- TEF分析成功后刷新使用量
- 智能建议生成成功后刷新使用量

### 3. 同步机制
1. **API调用成功** → 后端更新数据库中的使用量
2. **前端组件** → 调用 `refreshUsageInfo()` 强制刷新
3. **Hook更新** → 广播 `usageInfoUpdated` 事件
4. **所有组件** → 自动接收事件并更新显示

## 测试步骤

### 1. 基础功能测试
1. 登录应用
2. 观察导航区域和用户卡片中的使用量显示
3. 进行一次AI对话
4. 验证两个位置的使用量是否同时更新

### 2. 多功能测试
1. 使用聊天功能
2. 生成健康建议
3. 触发TEF分析
4. 生成智能建议
5. 每次操作后验证使用量同步

### 3. 跨标签页测试
1. 打开多个浏览器标签页
2. 在一个标签页中使用AI功能
3. 切换到其他标签页验证使用量是否更新

## 预期结果
- ✅ 导航区域和用户卡片显示相同的使用量
- ✅ AI功能使用后立即更新所有显示位置
- ✅ 不同组件间的使用量保持同步
- ✅ 减少了刷新延迟（从2分钟降到1分钟）

## 技术细节

### 事件广播机制
```typescript
// 广播使用量更新事件
window.dispatchEvent(new CustomEvent(USAGE_UPDATE_EVENT, { 
  detail: data 
}))

// 监听使用量更新事件
window.addEventListener(USAGE_UPDATE_EVENT, handleUsageUpdate)
```

### 缓存策略
- 本地缓存有效期：5分钟
- 自动刷新间隔：1分钟
- 手动刷新：立即生效

## 故障排除

### 如果使用量仍不同步
1. 检查浏览器控制台是否有错误
2. 验证用户是否已登录
3. 确认AI功能调用是否成功
4. 检查网络连接

### 调试日志
在浏览器控制台中查找以下日志：
- `[Usage] Refreshing usage info after successful xxx`
- `[Usage] Received cross-component update`
- `[Usage] Manual refresh triggered`
