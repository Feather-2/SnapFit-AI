# 数据库迁移指南

从 Supabase 迁移到其他 PostgreSQL 平台的完整指南。

## 🎯 迁移友好性评估

### ✅ 优势（易于迁移）
- **标准 PostgreSQL** - 没有使用 Supabase 特有功能
- **自定义认证** - NextAuth.js 独立于数据库
- **完整业务逻辑** - 22个自定义函数可直接迁移
- **标准 SQL** - 没有供应商锁定
- **Docker 化** - 便于在任何环境部署

### ⚠️ 需要调整的部分
- **客户端库** - 从 `@supabase/supabase-js` 改为标准 PostgreSQL 客户端
- **RLS 策略** - 改为应用层权限控制
- **实时功能** - 如果使用了 Supabase Realtime

## 🔄 支持的目标平台

### 云服务商
- **AWS RDS PostgreSQL**
- **Google Cloud SQL**
- **Azure Database for PostgreSQL**
- **DigitalOcean Managed Databases**

### PostgreSQL 兼容平台
- **Neon** (Serverless PostgreSQL)
- **PlanetScale** (如果支持 PostgreSQL)
- **CockroachDB** (部分兼容)

### 自建方案
- **Docker PostgreSQL**
- **VM 部署**
- **Kubernetes**

## 📋 迁移步骤

### 1. 数据导出
```bash
# 导出数据库结构
pg_dump --host=db.your-project.supabase.co \
        --port=5432 \
        --username=postgres \
        --dbname=postgres \
        --schema-only \
        --no-owner \
        --no-privileges > schema.sql

# 导出数据
pg_dump --host=db.your-project.supabase.co \
        --port=5432 \
        --username=postgres \
        --dbname=postgres \
        --data-only \
        --no-owner \
        --no-privileges > data.sql
```

### 2. 目标数据库准备
```bash
# 创建新数据库
createdb snapfit_ai

# 导入结构
psql -d snapfit_ai -f schema.sql

# 导入数据
psql -d snapfit_ai -f data.sql
```

### 3. 代码调整

#### 替换 Supabase 客户端
```typescript
// 原来的 lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// 替换为标准 PostgreSQL 客户端
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

export { pool as db }
```

#### 更新 API 调用
```typescript
// 原来的 Supabase 调用
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)

// 替换为标准 SQL
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
)
```

### 4. 环境变量调整
```env
# 移除 Supabase 相关
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=

# 添加标准数据库连接
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_SSL=true  # 生产环境
```

### 5. 权限控制调整

#### 从 RLS 改为应用层控制
```typescript
// 原来依赖 RLS
const { data } = await supabase
  .from('daily_logs')
  .select('*')  // RLS 自动过滤

// 改为应用层控制
const result = await db.query(
  'SELECT * FROM daily_logs WHERE user_id = $1',
  [currentUserId]  // 应用层确保用户只能访问自己的数据
)
```

## 🛠️ 迁移工具脚本

### 自动化迁移脚本
```bash
#!/bin/bash
# migrate-from-supabase.sh

echo "🚀 开始从 Supabase 迁移..."

# 1. 导出数据
echo "📤 导出 Supabase 数据..."
pg_dump $SUPABASE_DB_URL --schema-only > schema.sql
pg_dump $SUPABASE_DB_URL --data-only > data.sql

# 2. 导入到新数据库
echo "📥 导入到新数据库..."
psql $NEW_DATABASE_URL -f schema.sql
psql $NEW_DATABASE_URL -f data.sql

# 3. 验证迁移
echo "🔍 验证数据完整性..."
psql $NEW_DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $NEW_DATABASE_URL -c "SELECT COUNT(*) FROM daily_logs;"

echo "✅ 迁移完成！"
```

## 📊 迁移复杂度评估

### 🟢 简单（1-2天）
- **数据导出/导入**
- **环境变量调整**
- **基本 CRUD 操作**

### 🟡 中等（3-5天）
- **客户端库替换**
- **权限控制重构**
- **API 调用更新**

### 🔴 复杂（需要重新设计）
- **实时功能**（如果使用了 Supabase Realtime）
- **文件存储**（如果使用了 Supabase Storage）
- **边缘函数**（如果使用了 Supabase Edge Functions）

## 🎯 推荐的迁移策略

### 渐进式迁移
1. **第一阶段**：保持 Supabase，添加新数据库支持
2. **第二阶段**：双写模式，同时写入两个数据库
3. **第三阶段**：切换读取到新数据库
4. **第四阶段**：完全迁移，移除 Supabase

### 一次性迁移
1. **准备期**：在测试环境完成迁移
2. **维护窗口**：停机迁移数据
3. **验证期**：确认功能正常
4. **上线**：切换到新数据库

## 💡 最佳实践

1. **保持数据库无关性**
   - 使用 ORM 或查询构建器
   - 避免数据库特定功能

2. **抽象数据访问层**
   ```typescript
   // 创建数据访问接口
   interface UserRepository {
     findById(id: string): Promise<User>
     create(user: CreateUserInput): Promise<User>
   }
   
   // Supabase 实现
   class SupabaseUserRepository implements UserRepository { }
   
   // PostgreSQL 实现
   class PostgreSQLUserRepository implements UserRepository { }
   ```

3. **配置驱动**
   ```typescript
   const dbProvider = process.env.DB_PROVIDER // 'supabase' | 'postgresql'
   const userRepo = createUserRepository(dbProvider)
   ```

## 🔒 安全考虑

1. **权限控制**：从数据库层移到应用层
2. **连接安全**：确保 SSL/TLS 连接
3. **凭据管理**：使用环境变量或密钥管理服务
4. **审计日志**：保持操作记录

## 📈 性能优化

1. **连接池**：使用连接池管理数据库连接
2. **查询优化**：利用现有的索引配置
3. **缓存策略**：添加 Redis 等缓存层
4. **监控**：设置数据库性能监控

您的应用架构设计得很好，迁移相对简单！需要我详细解释任何特定的迁移步骤吗？
