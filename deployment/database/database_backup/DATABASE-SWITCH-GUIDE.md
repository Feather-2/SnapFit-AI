# 数据库一键切换指南

本指南介绍如何在 Supabase 和 PostgreSQL 之间一键切换，无需修改业务代码。

## 🎯 设计目标

- ✅ **一键切换** - 只需修改环境变量
- ✅ **零代码改动** - 现有代码无需修改
- ✅ **完全兼容** - 支持所有现有功能
- ✅ **渐进迁移** - 支持逐步迁移策略

## 🏗️ 架构设计

```
应用代码
    ↓
数据库抽象层 (lib/database)
    ↓
┌─────────────┬─────────────┐
│  Supabase   │ PostgreSQL  │
│  Provider   │  Provider   │
└─────────────┴─────────────┘
```

## 🔧 使用方法

### 1. 环境变量配置

```env
# 切换到 Supabase
DB_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 切换到 PostgreSQL
DB_PROVIDER=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/snapfit_ai
```

### 2. 现有代码无需修改

您的现有代码继续正常工作：

```typescript
// 这些导入会自动适配到选择的数据库
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/lib/supabase/server'

// API 代码无需修改
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
```

## 📦 新增依赖

为了支持 PostgreSQL，需要安装额外依赖：

```bash
# 安装 PostgreSQL 客户端
pnpm add pg @types/pg

# 或者使用 npm
npm install pg @types/pg
```

## 🔄 切换步骤

### 从 Supabase 切换到 PostgreSQL

1. **准备 PostgreSQL 数据库**
   ```bash
   # 导出 Supabase 数据
   pg_dump $SUPABASE_DB_URL > backup.sql
   
   # 导入到 PostgreSQL
   psql $POSTGRESQL_DB_URL < backup.sql
   ```

2. **修改环境变量**
   ```env
   DB_PROVIDER=postgresql
   DATABASE_URL=postgresql://user:password@host:5432/database
   ```

3. **重启应用**
   ```bash
   # Docker 环境
   docker-compose restart
   
   # 开发环境
   pnpm dev
   ```

### 从 PostgreSQL 切换到 Supabase

1. **修改环境变量**
   ```env
   DB_PROVIDER=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **重启应用**

## 🧪 测试切换

创建测试脚本验证切换是否成功：

```bash
# test-database-switch.sh
#!/bin/bash

echo "🧪 测试数据库切换..."

# 测试 Supabase
export DB_PROVIDER=supabase
echo "测试 Supabase 连接..."
curl -f http://localhost:3000/api/health

# 测试 PostgreSQL  
export DB_PROVIDER=postgresql
echo "测试 PostgreSQL 连接..."
curl -f http://localhost:3000/api/health

echo "✅ 切换测试完成"
```

## 🔍 功能对比

| 功能 | Supabase | PostgreSQL | 兼容性 |
|------|----------|------------|--------|
| 基本 CRUD | ✅ | ✅ | 100% |
| RPC 函数调用 | ✅ | ✅ | 100% |
| 事务支持 | ✅ | ✅ | 100% |
| 实时订阅 | ✅ | ❌ | 需要额外实现 |
| 认证集成 | ✅ | ✅ | 100% |
| 文件存储 | ✅ | ❌ | 需要额外实现 |

## 🚀 Docker 部署

### 支持多数据库的 Docker 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  snapfit-ai:
    build: .
    environment:
      - DB_PROVIDER=${DB_PROVIDER:-supabase}
      # Supabase 配置
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      # PostgreSQL 配置
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - postgres
    
  # 可选的本地 PostgreSQL
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: snapfit_ai
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql

volumes:
  postgres_data:
```

## 📊 性能对比

| 指标 | Supabase | 自建 PostgreSQL |
|------|----------|------------------|
| 延迟 | 取决于地理位置 | 取决于服务器配置 |
| 吞吐量 | 受限于计划 | 取决于硬件 |
| 成本 | 按使用量计费 | 固定服务器成本 |
| 维护 | 零维护 | 需要运维 |

## 🔧 高级配置

### 连接池配置

```typescript
// lib/database/providers/postgresql.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲超时
  connectionTimeoutMillis: 2000, // 连接超时
})
```

### 读写分离

```typescript
// 支持读写分离的配置
const readPool = new Pool({
  connectionString: process.env.DATABASE_READ_URL,
})

const writePool = new Pool({
  connectionString: process.env.DATABASE_WRITE_URL,
})
```

## 🛠️ 故障排除

### 常见问题

1. **连接失败**
   ```bash
   # 检查环境变量
   echo $DB_PROVIDER
   echo $DATABASE_URL
   
   # 测试数据库连接
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. **函数不存在**
   ```sql
   -- 确保所有自定义函数已迁移
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public';
   ```

3. **权限问题**
   ```sql
   -- 检查用户权限
   SELECT * FROM information_schema.role_table_grants 
   WHERE grantee = 'your_user';
   ```

## 📈 监控和日志

### 数据库性能监控

```typescript
// lib/database/monitoring.ts
export class DatabaseMonitor {
  static logQuery(sql: string, duration: number) {
    if (duration > 1000) {
      console.warn(`Slow query detected: ${sql} (${duration}ms)`)
    }
  }
}
```

### 健康检查

```typescript
// app/api/health/route.ts
export async function GET() {
  const dbStatus = await db.select('users', { limit: 1 })
  
  return Response.json({
    status: 'ok',
    database: {
      provider: DB_PROVIDER,
      connected: !dbStatus.error
    }
  })
}
```

## 🎯 最佳实践

1. **环境隔离** - 开发用 PostgreSQL，生产用 Supabase
2. **数据备份** - 定期备份，支持快速恢复
3. **性能测试** - 切换前进行压力测试
4. **监控告警** - 设置数据库性能监控
5. **文档更新** - 保持部署文档同步

## 🔮 未来扩展

- 支持更多数据库（MySQL、MongoDB）
- 实现数据库连接池优化
- 添加查询缓存层
- 支持分库分表

---

通过这个抽象层，您可以轻松在不同数据库之间切换，为未来的技术选型提供了极大的灵活性！
