# 共享Key机制设置指南

## 概述

共享Key机制允许用户分享他们的OpenAI兼容API Key给社区其他用户使用，支持：
- OpenAI官方API
- OneAPI代理服务
- 其他OpenAI兼容的第三方API服务

## 功能特性

### 🔑 Key管理
- 支持多种API服务（需要提供baseUrl + apiKey）
- 加密存储API Key
- 每日使用限制设置
- 使用统计和监控

### 🏆 感谢榜
- 显示贡献者排行榜
- 实时使用统计
- 贡献者头像和信息展示

### ⚖️ 负载均衡
- 自动选择可用Key
- 优先使用使用次数较少的Key
- 失败自动切换到其他Key

## 设置步骤

### 1. 数据库设置

首先在Supabase中创建必要的表：

```sql
-- 用户表
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linux_do_id text UNIQUE,
  username text,
  avatar_url text,
  email text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 共享Key表
CREATE TABLE shared_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_url text NOT NULL,
  api_key_encrypted text NOT NULL,
  available_models text[] NOT NULL,
  daily_limit integer DEFAULT 150,
  description text,
  tags text[],
  is_active boolean DEFAULT true,
  usage_count_today integer DEFAULT 0,
  total_usage_count integer DEFAULT 0,
  last_used_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Key使用日志表
CREATE TABLE key_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_key_id uuid REFERENCES shared_keys(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  api_endpoint text,
  model_used text,
  tokens_used integer,
  cost_estimate numeric,
  success boolean,
  error_message text,
  created_at timestamp DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_shared_keys_active ON shared_keys(is_active, usage_count_today, daily_limit);
CREATE INDEX idx_shared_keys_user ON shared_keys(user_id);
CREATE INDEX idx_usage_logs_key ON key_usage_logs(shared_key_id);
CREATE INDEX idx_usage_logs_user ON key_usage_logs(user_id);
```

### 2. 环境变量配置

复制 `.env.example` 到 `.env.local` 并填写配置：

```bash
cp .env.example .env.local
```

必需的环境变量：
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase项目URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase服务角色密钥
- `KEY_ENCRYPTION_SECRET`: 用于加密API Key的密钥

### 3. 安装依赖

```bash
npm install @supabase/supabase-js crypto-js @types/crypto-js
```

### 4. 集成到现有API

修改现有的API路由以使用共享Key：

```typescript
// 原来的代码
import { OpenAICompatibleClient } from "@/lib/openai-client"
const client = new OpenAICompatibleClient(baseUrl, apiKey)

// 修改为
import { SharedOpenAIClient } from "@/lib/shared-openai-client"
const client = new SharedOpenAIClient({
  userId: user.id,
  preferredModel: "gpt-4o",
  fallbackConfig: { baseUrl, apiKey } // 用户自己的配置作为fallback
})
```

## 使用方法

### 用户分享Key

1. 用户登录后访问Key管理页面
2. 填写API配置信息：
   - 配置名称
   - API基础URL（如 https://api.openai.com）
   - API Key
   - 支持的模型名称
   - 每日调用限制
3. 系统自动测试Key有效性
4. 通过测试后加密存储

### 系统使用共享Key

1. 当用户调用AI功能时，系统优先使用共享Key
2. 负载均衡算法选择最合适的Key
3. 记录使用情况和统计信息
4. 如果共享Key不可用，回退到用户自己的配置

### 感谢榜展示

1. 首页显示当前使用的Key提供者
2. 点击可查看完整的贡献者排行榜
3. 显示贡献统计和活跃状态

## API端点

### 共享Key管理
- `GET /api/shared-keys` - 获取用户的Key列表
- `POST /api/shared-keys` - 添加新的共享Key
- `PUT /api/shared-keys` - 更新Key设置
- `DELETE /api/shared-keys?id=xxx` - 删除Key

### Key测试
- `POST /api/shared-keys/test` - 测试API Key有效性

### 感谢榜
- `GET /api/shared-keys/thanks-board` - 获取贡献者排行榜

## 组件使用

### Key上传表单
```tsx
import { KeyUploadForm } from "@/components/shared-keys/key-upload-form"

<KeyUploadForm onSuccess={() => console.log('Key uploaded!')} />
```

### 感谢榜
```tsx
import { ThanksBoard } from "@/components/shared-keys/thanks-board"

<ThanksBoard currentKeyInfo={keyInfo} />
```

### 首页集成
```tsx
import { HomeWithThanks } from "@/components/home-with-thanks"

<HomeWithThanks currentKeyInfo={currentKeyInfo}>
  {/* 原有的首页内容 */}
</HomeWithThanks>
```

## 安全考虑

1. **API Key加密**: 所有API Key使用AES加密存储
2. **访问控制**: 用户只能管理自己的Key
3. **使用限制**: 每个Key都有每日调用限制
4. **监控日志**: 记录所有API调用用于监控和统计
5. **失败处理**: 自动处理Key失效和错误情况

## 定时任务

建议设置定时任务重置每日使用计数：

```typescript
// 每天凌晨重置使用计数
// 可以使用 Vercel Cron Jobs 或其他定时任务服务
export async function resetDailyUsage() {
  const keyManager = new KeyManager()
  await keyManager.resetDailyUsage()
}
```

## 监控和维护

1. 定期检查Key的有效性
2. 监控使用统计和异常情况
3. 清理过期或无效的Key
4. 备份重要的使用数据

## 故障排除

### 常见问题

1. **Key测试失败**
   - 检查API URL格式是否正确
   - 验证API Key是否有效
   - 确认网络连接正常

2. **没有可用的共享Key**
   - 检查是否有用户分享了Key
   - 确认Key的每日限制未超出
   - 验证Key的活跃状态

3. **加密/解密错误**
   - 检查 `KEY_ENCRYPTION_SECRET` 环境变量
   - 确保密钥在所有环境中一致

## 扩展功能

未来可以考虑添加：
- Key的成本统计和分摊
- 更细粒度的使用权限控制
- Key的自动健康检查
- 更丰富的统计和分析功能
