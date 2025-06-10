# 首页AI功能端点使用分析

## 📋 首页AI功能概览

首页 (`app/[locale]/page.tsx`) 包含以下AI功能：

### 1. 🧠 智能建议 (Smart Suggestions)
- **组件**: `SmartSuggestions` (`components/smart-suggestions.tsx`)
- **API端点**: `/api/openai/smart-suggestions-shared`
- **触发方式**: 手动点击刷新按钮
- **功能**: 基于用户的健康数据生成个性化建议

### 2. 🔥 TEF分析 (Thermic Effect of Food)
- **API端点**: `/api/openai/tef-analysis-shared`
- **触发方式**: 食物条目变化后15秒自动触发
- **功能**: 分析食物的热效应，计算代谢增强因子

### 3. 📝 文本解析 (Text Parsing)
- **API端点**: `/api/openai/parse-shared`
- **触发方式**: 用户输入文本并点击提交
- **功能**: 解析食物或运动文本，提取营养信息

### 4. 🖼️ 图像解析 (Image Parsing)
- **API端点**: `/api/openai/parse-with-images`
- **触发方式**: 用户上传图片并点击提交
- **功能**: 解析食物图片，识别食物类型和营养信息

### 5. 💡 健康建议 (Agent Advice)
- **组件**: `AgentAdvice` (`components/agent-advice.tsx`)
- **API端点**: 
  - **私有模式**: 前端直接调用AI (非流式)
  - **共享模式**: `/api/ai/stream-text` (真正的流式)
- **触发方式**: 手动点击"获取建议"按钮
- **功能**: 基于当日健康数据生成个性化建议

## 🔍 详细分析

### 智能建议功能
```typescript
// 位置: app/[locale]/page.tsx:323
const response = await fetch("/api/openai/smart-suggestions-shared", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    dailyLog: targetLog,
    userProfile,
    recentLogs,
    aiConfig, // 添加AI配置
  }),
});
```

### TEF分析功能
```typescript
// 位置: app/[locale]/page.tsx:244
const response = await fetch("/api/openai/tef-analysis-shared", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    foodEntries,
    aiConfig // 添加AI配置
  }),
});
```

### 文本/图像解析功能
```typescript
// 位置: app/[locale]/page.tsx:697-726
const endpoint = uploadedImages.length > 0 
  ? "/api/openai/parse-with-images" 
  : "/api/openai/parse-shared";

// 文本解析
body = JSON.stringify({
  text: inputText,
  lang: resolvedParams.locale,
  type: activeTab,
  userWeight: userProfile.weight,
  aiConfig: aiConfig,
});

// 图像解析 (FormData)
const formData = new FormData();
formData.append("text", inputText);
formData.append("lang", resolvedParams.locale);
formData.append("type", activeTab);
formData.append("userWeight", userProfile.weight.toString());
formData.append("aiConfig", JSON.stringify(aiConfig));
uploadedImages.forEach((img, index) => {
  formData.append(`image${index}`, img.compressedFile || img.file);
});
```

### 健康建议功能
```typescript
// 位置: components/agent-advice.tsx:107-137
if (aiService.isPrivateMode) {
  // 私有模式：使用前端直接调用（非流式）
  const { text, source } = await aiService.generateText({ prompt })
  setAdvice(text)
} else {
  // 共享模式：使用流式API
  const { stream, source } = await aiService.streamText({
    messages: [{ role: "user", content: prompt }]
  })
  // 处理流式响应...
}
```

## 🎯 实际使用的API端点

### ✅ 确认使用的端点
1. **`/api/openai/smart-suggestions-shared`** - 智能建议
2. **`/api/openai/tef-analysis-shared`** - TEF分析
3. **`/api/openai/parse-shared`** - 文本解析
4. **`/api/openai/parse-with-images`** - 图像解析
5. **`/api/ai/stream-text`** - 健康建议(共享模式流式)
6. **`/api/ai/generate-text`** - 健康建议(私有模式非流式)

### ❌ 未使用的端点
1. **`/api/openai/advice-shared`** - 非流式健康建议API
2. **`/api/openai/advice-stream-shared`** - 伪流式健康建议API

## 🔄 API调用流程

### 智能建议流程
1. 用户点击刷新按钮
2. 收集当前日志和最近7天数据
3. 调用 `/api/openai/smart-suggestions-shared`
4. 保存结果到localStorage
5. 刷新使用量信息

### TEF分析流程
1. 食物条目变化
2. 检查缓存是否存在
3. 15秒防抖延迟
4. 调用 `/api/openai/tef-analysis-shared`
5. 缓存分析结果
6. 更新日志数据

### 文本/图像解析流程
1. 用户输入文本或上传图片
2. 检查AI配置
3. 根据是否有图片选择端点
4. 调用相应API
5. 解析返回的食物/运动数据
6. 添加到当日日志

### 健康建议流程
1. 用户点击获取建议
2. 构建包含用户档案和当日数据的提示词
3. 根据配置模式选择调用方式：
   - 私有模式：前端直接调用AI
   - 共享模式：调用 `/api/ai/stream-text`
4. 显示建议内容

## 📊 使用频率分析

### 高频使用
- **文本/图像解析**: 用户每次添加食物/运动时使用
- **TEF分析**: 食物条目变化时自动触发

### 中频使用
- **智能建议**: 用户主动刷新时使用
- **健康建议**: 用户主动获取建议时使用

### 特点
- 所有API都支持AI配置传递
- 都有完善的错误处理和限额检查
- 共享模式下会刷新使用量信息
- 支持私有模式和共享模式切换
