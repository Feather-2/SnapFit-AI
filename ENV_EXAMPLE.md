# Snapifit-AI 环境变量示例

以下是部署Snapifit-AI应用时需要的环境变量。请根据您的需求创建一个`.env`文件并添加这些变量。

```
# 应用配置
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:3000

# 数据库配置（必需）
# 开发环境
DATABASE_URL="file:./dev.db"
# 生产环境（Docker）
# DATABASE_URL="file:/app/data/prod.db"
# 生产环境（PostgreSQL）
# DATABASE_URL="postgresql://username:password@localhost:5432/snapifit"

# 用户认证配置（必需）
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"

# 邀请码配置（必需）
INVITE_CODE="your-invite-code-here"

# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_MODEL=gpt-4-turbo
```

## 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| NODE_ENV | 是 | 应用运行环境，生产环境请设置为`production` |
| NEXT_PUBLIC_API_URL | 是 | 应用API的基础URL，本地部署通常为`http://localhost:3000` |
| DATABASE_URL | 是 | 数据库连接URL，SQLite格式：`file:./dev.db` |
| NEXTAUTH_URL | 是 | NextAuth.js的基础URL，通常与NEXT_PUBLIC_API_URL相同 |
| NEXTAUTH_SECRET | 是 | NextAuth.js的密钥，用于加密会话，生产环境必须更改 |
| INVITE_CODE | 是 | 用户注册时需要的邀请码，防止恶意注册 |
| OPENAI_API_KEY | 是 | OpenAI API密钥，用于AI功能 |
| OPENAI_API_MODEL | 是 | 使用的OpenAI模型，如`gpt-4-turbo` |

## 如何使用

1. 在项目根目录创建一个名为`.env`的文件
2. 复制上面的示例内容到该文件
3. 根据您的实际情况修改各个变量的值
4. 保存文件

注意：`.env`文件包含敏感信息，不应该提交到版本控制系统中。 