# 环境变量配置示例

复制此文件为 `.env.local` 并根据需要修改配置。

## 存储模式配置

```bash
# 存储模式选择
# 可选值: 'server' | 'browser'
# server: 使用服务端数据库存储 (SQLite + Prisma)
# browser: 使用浏览器端存储 (IndexedDB)
NEXT_PUBLIC_STORAGE_MODE=browser
```

## 数据库配置 (仅在 server 模式时需要)

```bash
# SQLite 数据库文件路径
DATABASE_URL="file:./dev.db"
```

## API配置

```bash
# OpenAI API 配置
OPENAI_API_KEY="your-openai-api-key-here"
OPENAI_BASE_URL="https://api.openai.com/v1"
```

## 完整配置示例

### 浏览器存储模式 (.env.local)
```bash
NEXT_PUBLIC_STORAGE_MODE=browser
OPENAI_API_KEY="your-openai-api-key-here"
OPENAI_BASE_URL="https://api.openai.com/v1"
```

### 服务端存储模式 (.env.local)
```bash
NEXT_PUBLIC_STORAGE_MODE=server
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="your-openai-api-key-here"
OPENAI_BASE_URL="https://api.openai.com/v1"
```

## 切换存储模式

1. **切换到浏览器存储**：
   ```bash
   # 修改 .env.local
   NEXT_PUBLIC_STORAGE_MODE=browser
   
   # 重启应用
   npm run dev
   ```

2. **切换到服务端存储**：
   ```bash
   # 修改 .env.local
   NEXT_PUBLIC_STORAGE_MODE=server
   DATABASE_URL="file:./dev.db"
   
   # 初始化数据库
   npx prisma db push
   
   # 重启应用
   npm run dev
   ```

## 数据迁移

如果需要在存储模式之间迁移数据：

1. 访问 `/zh/storage-info` 查看当前存储模式
2. 访问 `/zh/migrate-data` 使用数据迁移工具
3. 访问 `/zh/test-db` 测试数据库连接

## 注意事项

- 更改 `NEXT_PUBLIC_STORAGE_MODE` 后需要重启应用
- 不同存储模式的数据不会自动同步
- 建议在切换前先备份重要数据
- 服务端存储需要正确配置数据库连接 