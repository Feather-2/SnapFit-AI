# SQLite + Prisma 数据库迁移指南

## 🎉 恭喜！数据库已成功配置

您的Snapifit-AI项目现在已经成功配置了SQLite + Prisma数据库系统，可以替代之前的IndexedDB浏览器存储。

## 📊 测试结果

根据API测试结果，以下功能已经成功实现：
- ✅ 用户创建和管理
- ✅ AI配置存储
- ✅ 日志记录系统
- ✅ 食物和运动记录
- ✅ AI记忆功能

## 🔄 如何从IndexedDB迁移到SQLite

### 方法1: 使用Web界面（推荐）

1. 确保开发服务器正在运行：`pnpm run dev`
2. 访问数据库测试页面：http://localhost:3000/test-db
3. 确认数据库功能正常
4. 点击"数据迁移"链接，访问：http://localhost:3000/migrate-data
5. 按照页面指示完成数据迁移

### 方法2: 使用API直接迁移

```javascript
// 在浏览器控制台中运行
const migrateData = async () => {
  // 获取本地数据
  const localData = {
    userProfile: JSON.parse(localStorage.getItem('userProfile') || 'null'),
    aiConfig: JSON.parse(localStorage.getItem('aiConfig') || 'null'),
    // 可以继续添加其他数据...
  }

  // 调用迁移API
  const response = await fetch('/api/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'migrate_from_indexeddb',
      data: localData,
      userEmail: 'your-email@example.com',
      userName: 'Your Name'
    })
  })

  const result = await response.json()
  console.log('迁移结果:', result)
}

migrateData()
```

## 🛠️ 如何在现有组件中使用新的数据库

### 1. 替换数据获取Hook

**之前（IndexedDB）：**
```typescript
import { useIndexedDB } from '@/hooks/use-indexed-db'

function MyComponent() {
  const { getData, saveData } = useIndexedDB('healthLogs')
  // ...
}
```

**现在（Prisma）：**
```typescript
import { useHealthData } from '@/hooks/use-health-data'

function MyComponent() {
  const { healthData, loadHealthData, saveHealthData } = useHealthData()
  // ...
}
```

### 2. 替换AI记忆Hook

**之前（IndexedDB）：**
```typescript
import { useAIMemory } from '@/hooks/use-ai-memory'

function MyComponent() {
  const { memories, updateMemory } = useAIMemory()
  // ...
}
```

**现在（服务端）：**
```typescript
import { useServerAIMemory } from '@/hooks/use-server-ai-memory'

function MyComponent() {
  const { memories, updateMemory } = useServerAIMemory()
  // ...
}
```

## 📋 新的API端点

以下API端点现在可用：

- `GET /api/db/daily-log?userId={id}&date={date}` - 获取日志
- `PUT /api/db/daily-log` - 更新日志
- `POST /api/db/food-entry` - 添加食物记录
- `DELETE /api/db/food-entry/{id}` - 删除食物记录
- `POST /api/db/exercise-entry` - 添加运动记录
- `DELETE /api/db/exercise-entry/{id}` - 删除运动记录
- `GET /api/db/user-history?userId={id}` - 获取用户历史
- `GET/POST /api/db/ai-memory` - 管理AI记忆
- `GET/POST /api/db/user-profile` - 管理用户配置
- `GET/POST /api/db/ai-config` - 管理AI配置

## 🗄️ 数据库管理命令

```bash
# 生成Prisma客户端
pnpm db:generate

# 推送schema到数据库
pnpm db:push

# 打开Prisma Studio（可视化数据库管理）
pnpm db:studio

# 重置数据库（谨慎使用）
pnpm db:reset
```

## 🔍 查看数据库内容

### 使用Prisma Studio（推荐）
```bash
pnpm db:studio
```
然后在浏览器中访问 http://localhost:5555

### 使用SQLite命令行
```bash
sqlite3 dev.db
.tables
SELECT * FROM users LIMIT 5;
```

## 📁 文件结构

```
├── prisma/
│   └── schema.prisma          # 数据库模型定义
├── lib/
│   ├── db.ts                 # 数据库操作工具类
│   └── migration.ts          # 数据迁移工具
├── hooks/
│   ├── use-health-data.ts    # 新的健康数据Hook
│   └── use-server-ai-memory.ts # 新的AI记忆Hook
├── app/api/db/               # 数据库API路由
├── app/test-db/              # 数据库测试页面
├── app/migrate-data/         # 数据迁移页面
└── dev.db                    # SQLite数据库文件
```

## ⚠️ 注意事项

1. **备份数据**：迁移前请先备份现有数据
2. **用户ID管理**：当前使用临时用户ID方案，后续可集成正式的认证系统
3. **数据库文件**：`dev.db` 文件包含所有数据，请妥善保管
4. **环境变量**：确保 `.env` 文件包含正确的 `DATABASE_URL`

## 🚀 下一步计划

1. **集成到现有组件**：逐步替换现有的IndexedDB调用
2. **添加用户认证**：集成正式的用户认证系统
3. **数据同步**：实现多设备间的数据同步
4. **性能优化**：添加缓存和数据分页
5. **部署准备**：配置生产环境数据库

## 🆘 遇到问题？

如果遇到任何问题，请检查：
1. 开发服务器是否正常运行
2. 数据库文件是否存在：`ls -la dev.db`
3. 环境变量是否正确：`cat .env`
4. API是否正常响应：访问 `/api/test-db`

---

现在您可以开始使用强大的服务端数据库系统了！🎊 