# Supabase 配置指南

## 🚨 紧急安全问题

**⚠️ 您的数据库当前没有启用 Row Level Security (RLS)！**
这意味着任何有 API 密钥的人都可以访问所有数据。

### 立即执行安全配置
1. 在 Supabase Dashboard > SQL Editor 中执行 `supabase-setup.sql`
2. 这将启用 RLS 并创建安全策略

## 🔧 必需配置项目

### 1. 基本项目信息
在 Supabase Dashboard > Settings > API 中获取：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. 认证设置
在 Supabase Dashboard > Authentication > Settings 中：

#### Site URL 配置
```
Site URL: http://localhost:3000 (开发环境)
Site URL: https://your-domain.com (生产环境)
```

#### Redirect URLs 配置
```
http://localhost:3000/api/auth/callback/linux-do
https://your-domain.com/api/auth/callback/linux-do
```

#### 禁用不需要的认证方式
- ✅ 保持 Email 启用（用于管理）
- ❌ 禁用其他社交登录（只使用 Linux.do）

### 3. 自定义认证提供商 (Linux.do)
在 Authentication > Providers 中添加自定义 OAuth 提供商：

```
Provider Name: linux-do
Authorization URL: https://connect.linux.do/oauth2/authorize
Token URL: https://connect.linux.do/oauth2/token
User Info URL: https://connect.linux.do/api/user
Client ID: your_linux_do_client_id
Client Secret: your_linux_do_client_secret
Scopes: read
```

### 4. 数据库配置

#### 执行 SQL 脚本
在 Supabase Dashboard > SQL Editor 中执行 `supabase-setup.sql` 文件内容。

#### 启用扩展
在 Database > Extensions 中启用：
- ✅ `uuid-ossp` (UUID 生成)
- ✅ `pg_cron` (定时任务，如果可用)

### 5. 存储配置 (可选)
如果需要文件上传功能：

在 Storage > Settings 中：
```
File size limit: 50MB
Allowed MIME types: image/*, application/pdf
```

创建存储桶：
```sql
-- 在 SQL Editor 中执行
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false);
```

### 6. 安全设置

#### JWT 设置
在 Settings > API 中确认：
- JWT expiry: 3600 (1小时)
- Refresh token expiry: 604800 (7天)

#### CORS 设置
在 Settings > API 中添加允许的域名：
```
http://localhost:3000
https://your-domain.com
```

### 7. 环境变量完整配置

#### 开发环境 (.env)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Linux.do OAuth
LINUX_DO_CLIENT_ID=your_client_id
LINUX_DO_CLIENT_SECRET=your_client_secret
LINUX_DO_REDIRECT_URI=http://localhost:3000/api/auth/callback/linux-do

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_development_secret

# 加密密钥
KEY_ENCRYPTION_SECRET=your_encryption_secret_32_chars_min
```

#### 生产环境 (.env.production)
```env
# Supabase (生产环境)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Linux.do OAuth (生产环境)
LINUX_DO_CLIENT_ID=your_prod_client_id
LINUX_DO_CLIENT_SECRET=your_prod_client_secret
LINUX_DO_REDIRECT_URI=https://your-domain.com/api/auth/callback/linux-do

# NextAuth (生产环境)
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your_very_secure_production_secret

# 加密密钥 (生产环境)
KEY_ENCRYPTION_SECRET=your_very_secure_production_encryption_key
```

## 🔍 验证配置

### 1. 数据库连接测试
```bash
# 在项目根目录执行
curl -X POST 'https://your-project.supabase.co/rest/v1/users' \
  -H "apikey: your_anon_key" \
  -H "Authorization: Bearer your_anon_key" \
  -H "Content-Type: application/json"
```

### 2. 认证流程测试
1. 启动应用
2. 访问 `/signin` 页面
3. 点击 Linux.do 登录
4. 检查是否正确重定向和创建用户

### 3. 权限测试
```sql
-- 在 SQL Editor 中测试 RLS
SELECT * FROM public.users; -- 应该返回空或错误
```

## 🚨 安全检查清单

- [ ] RLS 已在所有表上启用
- [ ] 策略正确配置，用户只能访问自己的数据
- [ ] Service Role Key 仅在服务端使用
- [ ] 生产环境使用强密码和密钥
- [ ] CORS 设置限制了允许的域名
- [ ] JWT 过期时间合理设置

## 📊 监控和维护

### 定时任务设置
在 Supabase Dashboard > Database > Cron Jobs 中添加：

```sql
-- 每日重置使用计数 (UTC 00:00)
SELECT cron.schedule(
  'reset-daily-usage',
  '0 0 * * *',
  'SELECT reset_daily_usage();'
);
```

### 日志监控
在 Supabase Dashboard > Logs 中监控：
- API 请求日志
- 认证日志
- 数据库查询日志

## 🔧 故障排除

### 常见问题

1. **认证失败**
   - 检查 Linux.do OAuth 配置
   - 验证回调 URL 设置
   - 确认客户端 ID 和密钥正确

2. **数据库连接失败**
   - 验证 Supabase URL 和密钥
   - 检查网络连接
   - 确认项目状态正常

3. **权限错误**
   - 检查 RLS 策略
   - 验证用户认证状态
   - 确认 JWT 有效性

### 调试命令
```bash
# 检查环境变量
echo $NEXT_PUBLIC_SUPABASE_URL

# 测试 API 连接
curl -I https://your-project.supabase.co/rest/v1/

# 查看应用日志
docker-compose logs -f snapfit-ai
```
