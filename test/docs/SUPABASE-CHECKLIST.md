# 🚨 Supabase 配置检查清单

基于您的数据库分析，以下是**必须**配置的项目：

## ❌ 紧急安全问题

### 1. Row Level Security (RLS) 未启用
**状态**: ❌ 所有表都是 `rowsecurity=false`
**风险**: 任何人都可以访问所有数据
**解决**: 执行 `supabase-setup.sql` 文件

### 2. 没有安全策略
**状态**: ❌ `Success. No rows returned`
**风险**: 没有访问控制
**解决**: 执行 `supabase-setup.sql` 文件

## ✅ 已配置正确的项目

### 1. 数据库函数 ✅
- 完整的业务逻辑函数（22个函数）
- 使用量管理、AI记忆、用户配置等

### 2. 定时任务 ✅
- 每日重置共享密钥使用量 (`daily-shared-keys-reset`)

### 3. 触发器 ✅
- 自动更新时间戳
- AI记忆版本管理

### 4. 索引优化 ✅
- 查询性能优化完善（30+个索引）

## 🔧 立即需要做的事情

### 步骤 1: 获取 Supabase 凭据
```bash
# 在 Supabase Dashboard > Settings > API 中获取
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 步骤 2: 启用安全策略
1. 打开 Supabase Dashboard > SQL Editor
2. 复制 `supabase-custom-setup.sql` 的内容（专为您的数据库定制）
3. 执行 SQL 脚本

**重要发现**：
- ⚠️ 时间戳类型不一致（shared_keys和users表）
- ✅ 您的函数和索引配置已经很完善
- ✅ 定时任务正常运行

### 步骤 3: 配置认证
在 Authentication > Settings 中设置：
```
Site URL: http://localhost:3000 (开发)
Site URL: https://your-domain.com (生产)

Redirect URLs:
http://localhost:3000/api/auth/callback/linux-do
https://your-domain.com/api/auth/callback/linux-do
```

### 步骤 4: 配置 Linux.do OAuth
在 Authentication > Providers 中添加自定义提供商：
```
Provider Name: linux-do
Authorization URL: https://connect.linux.do/oauth2/authorize
Token URL: https://connect.linux.do/oauth2/token
User Info URL: https://connect.linux.do/api/user
Client ID: your_linux_do_client_id
Client Secret: your_linux_do_client_secret
Scopes: read
```

## 🔍 验证配置

### 1. 检查 RLS 是否启用
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```
应该显示所有表都是 `true`

### 2. 检查安全策略
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```
应该显示多个策略

### 3. 测试认证
1. 启动应用
2. 访问 `/signin`
3. 测试 Linux.do 登录

## 🚀 Docker 部署准备

配置完 Supabase 后，您就可以：

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 Supabase 凭据

# 2. 构建和启动
make build
make dev

# 或使用脚本
./scripts/docker-build.sh
./scripts/deploy.sh development
```

## ⚠️ 重要提醒

1. **立即启用 RLS** - 这是最高优先级的安全问题
2. **使用强密钥** - 生产环境必须使用安全的密钥
3. **限制 CORS** - 只允许您的域名访问
4. **定期备份** - 设置自动备份策略

## 📞 如果遇到问题

1. **RLS 启用后无法访问数据**
   - 检查策略是否正确创建
   - 确认用户认证状态

2. **认证失败**
   - 验证 Linux.do OAuth 配置
   - 检查回调 URL 设置

3. **函数调用失败**
   - 确认 Service Role Key 配置正确
   - 检查函数权限设置
