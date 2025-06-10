# Vercel 部署指南 - Supabase 配置问题解决

## 问题描述
在 Vercel 部署时出现 `supabaseUrl is required` 错误，表明环境变量配置有问题。

## 解决步骤

### 1. 检查 Vercel 环境变量

在 Vercel 项目设置中，确保以下环境变量已正确配置：

#### 必需的 Supabase 环境变量
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### 其他必需环境变量
```
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret
KEY_ENCRYPTION_SECRET=your-encryption-secret
LINUX_DO_CLIENT_ID=your-client-id
LINUX_DO_CLIENT_SECRET=your-client-secret
LINUX_DO_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback/linux-do
```

#### 可选环境变量
```
DB_PROVIDER=supabase
DEFAULT_OPENAI_API_KEY=your-openai-key
DEFAULT_OPENAI_BASE_URL=https://api.openai.com
ADMIN_USER_IDS=user1,user2,user3
```

### 2. 验证环境变量设置

在 Vercel Dashboard 中：
1. 进入项目设置 (Project Settings)
2. 点击 "Environment Variables" 标签
3. 确保所有变量都已设置且值正确
4. 检查变量是否应用到了正确的环境 (Production, Preview, Development)

### 3. 重新部署

设置完环境变量后：
1. 触发新的部署 (可以通过推送代码或手动重新部署)
2. 检查部署日志确认没有错误

### 4. 调试步骤

如果问题仍然存在，可以添加调试代码：

```typescript
// 在 lib/supabase.ts 中添加调试信息
console.log('Environment check:', {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING'
});
```

### 5. 常见问题

#### 问题 1: 环境变量名称错误
确保变量名完全匹配，包括大小写和下划线。

#### 问题 2: 变量值包含特殊字符
如果值包含特殊字符，确保在 Vercel 中正确转义。

#### 问题 3: 缓存问题
清除 Vercel 的构建缓存并重新部署。

#### 问题 4: 环境变量作用域
确保环境变量应用到了 Production 环境。

### 6. 验证部署

部署成功后，访问以下端点验证：
- `https://your-app.vercel.app/api/health` - 健康检查
- `https://your-app.vercel.app/api/admin/ip-bans` - 测试 Supabase 连接

## 注意事项

1. `NEXT_PUBLIC_` 前缀的变量会暴露给客户端，确保不包含敏感信息
2. Service Role Key 应该保密，只在服务端使用
3. 修改环境变量后需要重新部署才能生效
4. 确保 Supabase 项目的 RLS (Row Level Security) 策略正确配置
