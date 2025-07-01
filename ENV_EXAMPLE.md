# Snapifit-AI 环境变量示例

以下是部署Snapifit-AI应用时可能需要的环境变量。请根据您的需求创建一个`.env`文件并添加这些变量。

```
# 应用配置
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:3000

# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_MODEL=gpt-4-turbo

# 数据库配置（如果需要）
# DATABASE_URL=your_database_url

# 其他配置
# 根据您的应用需求添加其他环境变量
```

## 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| NODE_ENV | 是 | 应用运行环境，生产环境请设置为`production` |
| NEXT_PUBLIC_API_URL | 是 | 应用API的基础URL，本地部署通常为`http://localhost:3000` |
| OPENAI_API_KEY | 是 | OpenAI API密钥，用于AI功能 |
| OPENAI_API_MODEL | 是 | 使用的OpenAI模型，如`gpt-4-turbo` |
| DATABASE_URL | 否 | 数据库连接URL（如果应用需要数据库） |

## 如何使用

1. 在项目根目录创建一个名为`.env`的文件
2. 复制上面的示例内容到该文件
3. 根据您的实际情况修改各个变量的值
4. 保存文件

注意：`.env`文件包含敏感信息，不应该提交到版本控制系统中。 