# 数据库设置指南

本指南将帮助您为Snapifit-AI设置SQLite + Prisma数据库。

## 快速开始

### 1. 安装依赖

```bash
# 安装Prisma和SQLite
pnpm add prisma @prisma/client
pnpm add -D prisma

# 或者使用npm
npm install prisma @prisma/client
npm install --save-dev prisma
```

### 2. 初始化Prisma

```bash
npx prisma init --datasource-provider sqlite
```

### 3. 配置环境变量

在`.env`文件中添加数据库URL：

```env
# 数据库配置
DATABASE_URL="file:./dev.db"

# 其他现有配置...
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key
```

### 4. 生成Prisma客户端

```bash
npx prisma generate
```

### 5. 运行数据库迁移

```bash
npx prisma db push
```

### 6. （可选）查看数据库

```bash
npx prisma studio
```

这将在浏览器中打开Prisma Studio，您可以可视化和编辑数据库内容。

## 更新package.json脚本

在`package.json`中添加数据库相关脚本：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

## 生产环境配置

### SQLite（简单部署）

对于小规模应用，SQLite已经足够：

```env
DATABASE_URL="file:./data/production.db"
```

确保在Docker中持久化数据库文件：

```yaml
# docker-compose.yml
services:
  app:
    # ... 其他配置
    volumes:
      - ./data:/app/data
```

### PostgreSQL（推荐生产环境）

修改`prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

环境变量：

```env
DATABASE_URL="postgresql://username:password@localhost:5432/snapifit?schema=public"
```

### 使用Supabase

1. 在[Supabase](https://supabase.com)创建项目
2. 获取数据库连接字符串
3. 更新环境变量：

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

## 数据迁移步骤

### 从IndexedDB迁移

1. **备份现有数据**（重要！）
   - 用户可以通过应用界面导出数据备份

2. **设置用户认证**
   - 实现用户注册/登录功能
   - 每个用户分配唯一ID

3. **逐步迁移**
   - 提供"迁移数据"功能按钮
   - 在后台将本地数据同步到服务端
   - 保留本地数据作为备份

4. **验证和切换**
   - 验证迁移数据的完整性
   - 用户确认后清理本地数据

## 开发工作流

### 1. 修改数据库结构

编辑`prisma/schema.prisma`文件后：

```bash
npx prisma db push
npx prisma generate
```

### 2. 重置数据库（开发环境）

```bash
npx prisma db push --force-reset
```

### 3. 查看数据库内容

```bash
npx prisma studio
```

## 性能优化

### 索引优化

在Prisma schema中添加索引：

```prisma
model DailyLog {
  // ... 字段定义
  
  @@index([userId, date])
  @@index([date])
}
```

### 查询优化

```typescript
// 使用include减少查询次数
const dailyLog = await prisma.dailyLog.findUnique({
  where: { id },
  include: {
    foodEntries: true,
    exerciseEntries: true,
  },
})

// 使用分页
const logs = await prisma.dailyLog.findMany({
  where: { userId },
  orderBy: { date: 'desc' },
  take: 10,
  skip: page * 10,
})
```

## 备份和恢复

### SQLite备份

```bash
# 创建备份
cp ./dev.db ./backup/dev-$(date +%Y%m%d).db

# 恢复备份
cp ./backup/dev-20241201.db ./dev.db
```

### PostgreSQL备份

```bash
# 创建备份
pg_dump $DATABASE_URL > backup.sql

# 恢复备份
psql $DATABASE_URL < backup.sql
```

## 监控和维护

### 数据库大小监控

```typescript
// 获取数据库统计信息
const stats = await prisma.$queryRaw`
  SELECT 
    COUNT(*) as total_users,
    (SELECT COUNT(*) FROM daily_logs) as total_logs,
    (SELECT COUNT(*) FROM food_entries) as total_foods
  FROM users;
`
```

### 定期清理

```typescript
// 删除超过1年的数据
const oneYearAgo = new Date()
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

await prisma.dailyLog.deleteMany({
  where: {
    createdAt: {
      lt: oneYearAgo,
    },
  },
})
```

## 故障排除

### 常见问题

1. **Prisma客户端过期**
   ```bash
   npx prisma generate
   ```

2. **数据库连接失败**
   - 检查`DATABASE_URL`环境变量
   - 确保数据库服务正在运行

3. **迁移失败**
   ```bash
   npx prisma db push --force-reset
   npx prisma generate
   ```

4. **类型错误**
   - 确保运行了`npx prisma generate`
   - 重启TypeScript服务器

### 开发环境重置

```bash
# 完全重置（谨慎使用）
rm -rf node_modules
rm -f dev.db
pnpm install
npx prisma db push
npx prisma generate
```

---

按照这个指南，您应该能够成功设置数据库并开始将数据从IndexedDB迁移到服务端。如有问题，请查看Prisma官方文档或联系技术支持。 