# Snapifit-AI Docker部署指南

本文档提供了使用Docker部署Snapifit-AI应用的详细步骤。

## 目录

- [前提条件](#前提条件)
- [部署步骤](#部署步骤)
- [环境变量配置](#环境变量配置)
- [常见问题](#常见问题)
- [高级配置](#高级配置)

## 前提条件

在开始部署之前，请确保您的系统已安装以下软件：

- [Docker](https://docs.docker.com/get-docker/)（版本20.10.0或更高）
- [Docker Compose](https://docs.docker.com/compose/install/)（版本2.0.0或更高）
- Git（用于克隆代码库）

您可以通过以下命令检查安装版本：

```bash
docker --version
docker-compose --version
git --version
```

## 部署步骤

### 1. 克隆代码库

首先，克隆Snapifit-AI代码库到您的服务器：

```bash
git clone <项目仓库URL>
cd Snapifit-AI
```

### 2. 配置环境变量

创建一个`.env`文件，用于存储应用所需的环境变量：

```bash
cp .env.example .env
```

然后使用您喜欢的文本编辑器编辑`.env`文件，填入必要的配置信息，特别是API密钥：

```bash
nano .env  # 或者使用 vim .env
```

### 3. 构建并启动应用

使用Docker Compose构建并启动应用：

```bash
docker-compose up -d --build
```

这个命令会：
- 构建Docker镜像
- 在后台启动容器（`-d`参数）
- 设置必要的网络配置

### 4. 验证部署

应用启动后，您可以通过以下方式验证部署是否成功：

1. 检查容器状态：

```bash
docker-compose ps
```

2. 查看应用日志：

```bash
docker-compose logs -f
```

3. 访问应用：

在浏览器中打开 `http://localhost:3000` 或者您服务器的IP地址（如果是远程服务器）。

### 5. 停止应用

如需停止应用，请运行：

```bash
docker-compose down
```

如果您想同时删除所有相关的卷和网络，可以使用：

```bash
docker-compose down -v
```

## 环境变量配置

以下是应用可能需要的关键环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | production |
| NEXT_PUBLIC_API_URL | API基础URL | http://localhost:3000 |
| OPENAI_API_KEY | OpenAI API密钥 | sk-... |
| OPENAI_API_MODEL | 使用的OpenAI模型 | gpt-4-turbo |

## 常见问题

### 1. 应用无法启动

检查Docker日志以获取详细错误信息：

```bash
docker-compose logs
```

常见原因包括：
- 环境变量配置错误
- 端口冲突（3000端口已被占用）
- 内存不足

### 2. API连接问题

如果应用启动但无法连接到API，请检查：
- `.env`文件中的API密钥是否正确
- 网络连接是否正常
- 防火墙设置是否允许相关连接

### 3. 性能问题

如果应用运行缓慢，可以考虑：
- 增加Docker容器的资源限制
- 优化Next.js构建配置
- 检查服务器资源使用情况

## 高级配置

### 自定义Docker配置

您可以根据需要修改`Dockerfile`和`docker-compose.yml`文件以自定义部署配置。

### 使用NGINX作为反向代理

对于生产环境，建议使用NGINX作为反向代理。示例配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

然后在`docker-compose.yml`中添加NGINX服务：

```yaml
services:
  app:
    # 现有配置...
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
```

### 数据持久化配置

应用已经配置了完整的数据持久化支持：

#### SQLite 数据库（默认）

默认配置使用SQLite数据库，数据会持久化到Docker卷中：

```yaml
volumes:
  - app_data:/app/data        # 数据库文件
  - app_uploads:/app/public/uploads  # 上传文件
  - app_logs:/app/logs        # 日志文件
```

#### PostgreSQL 数据库（推荐生产环境）

对于生产环境，建议使用PostgreSQL：

```bash
# 使用PostgreSQL配置启动
docker-compose -f docker-compose.postgres.yml up -d --build
```

需要在`.env`文件中添加：
```
POSTGRES_PASSWORD=your_secure_password_here
```

#### 数据备份

备份SQLite数据库：
```bash
# 备份数据卷
docker run --rm -v snapifit-ai_app_data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data
```

备份PostgreSQL数据库：
```bash
# 备份PostgreSQL
docker-compose exec postgres pg_dump -U snapifit snapifit > backup.sql
```

---

如有任何问题或需要进一步的帮助，请联系项目维护者或提交Issue。 