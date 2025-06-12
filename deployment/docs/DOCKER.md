# Snapifit AI Docker 部署指南

本文档介绍如何使用 Docker 部署 Snapifit AI 健康管理应用。

## 📋 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

## 🚀 快速开始

### 1. 环境配置

复制环境变量模板并配置：

```bash
# 开发环境
cp .env.example .env

# 生产环境
cp .env.production.example .env.production
```

编辑相应的环境变量文件，填入实际的配置值。

### 2. 构建镜像

```bash
# Linux/macOS
chmod +x scripts/docker-build.sh
./scripts/docker-build.sh

# Windows
scripts\docker-build.bat
```

### 3. 启动服务

```bash
# 开发环境
docker-compose up -d

# 生产环境
docker-compose -f docker-compose.prod.yml up -d
```

### 4. 访问应用

- 应用地址: http://localhost:3000
- 健康检查: http://localhost:3000/api/health

## 📁 文件结构

```
├── Dockerfile                    # 多阶段构建配置
├── .dockerignore                 # Docker 忽略文件
├── docker-compose.yml            # 开发环境配置
├── docker-compose.prod.yml       # 生产环境配置
├── nginx.conf                    # Nginx 反向代理配置
├── .env.example                  # 开发环境变量模板
├── .env.production.example       # 生产环境变量模板
└── scripts/
    ├── docker-build.sh          # Linux/macOS 构建脚本
    ├── docker-build.bat         # Windows 构建脚本
    └── deploy.sh                # 自动化部署脚本
```

## 🔧 详细配置

### Dockerfile 说明

采用多阶段构建优化镜像大小：

1. **deps**: 安装依赖
2. **builder**: 构建应用
3. **runner**: 运行时镜像

### 环境变量

#### 必需变量

```env
# Supabase 数据库
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 加密密钥
KEY_ENCRYPTION_SECRET=your_encryption_secret

# Linux.do OAuth
LINUX_DO_CLIENT_ID=your_client_id
LINUX_DO_CLIENT_SECRET=your_client_secret

# NextAuth
NEXTAUTH_URL=your_app_url
NEXTAUTH_SECRET=your_nextauth_secret
```

#### 可选变量

```env
# 默认 OpenAI 配置
DEFAULT_OPENAI_API_KEY=your_openai_key
DEFAULT_OPENAI_BASE_URL=https://api.openai.com

# 回调地址
LINUX_DO_REDIRECT_URI=http://localhost:3000/api/auth/callback/linux-do
```

## 🛠️ 常用命令

### 构建和启动

```bash
# 构建镜像
docker build -t snapfit-ai .

# 启动开发环境
docker-compose up -d

# 启动生产环境
docker-compose -f docker-compose.prod.yml up -d

# 重新构建并启动
docker-compose up -d --build
```

### 管理服务

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v

# 重启服务
docker-compose restart
```

### 调试和维护

```bash
# 进入容器
docker-compose exec snapfit-ai sh

# 查看容器资源使用
docker stats

# 清理未使用的镜像
docker image prune

# 清理所有未使用的资源
docker system prune -a
```

## 🔍 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tulpn | grep :3000

   # 修改 docker-compose.yml 中的端口映射
   ports:
     - "3001:3000"  # 改为其他端口
   ```

2. **内存不足**
   ```bash
   # 增加 Docker 内存限制
   # 在 docker-compose.prod.yml 中调整
   deploy:
     resources:
       limits:
         memory: 2G
   ```

3. **构建失败**
   ```bash
   # 清理构建缓存
   docker builder prune -a

   # 重新构建
   docker-compose build --no-cache
   ```

### 日志分析

```bash
# 查看应用日志
docker-compose logs snapfit-ai

# 查看 Nginx 日志（生产环境）
docker-compose -f docker-compose.prod.yml logs nginx

# 实时查看日志
docker-compose logs -f --tail=100
```

## 🚀 生产部署

### 使用自动化脚本

```bash
# 部署到生产环境
chmod +x scripts/deploy.sh
./scripts/deploy.sh production

# 部署到开发环境
./scripts/deploy.sh development
```

### 手动部署步骤

1. 配置生产环境变量
2. 构建生产镜像
3. 启动生产服务
4. 配置反向代理
5. 设置 SSL 证书

### 性能优化

- 启用 Nginx 反向代理
- 配置 Gzip 压缩
- 设置适当的资源限制
- 启用健康检查
- 配置日志轮转

## 📊 监控

### 健康检查

应用提供健康检查端点：

```bash
curl http://localhost:3000/api/health
```

返回示例：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "0.1.0",
  "memory": {
    "used": 128.5,
    "total": 256.0
  }
}
```

### 资源监控

```bash
# 查看容器资源使用
docker stats snapfit-ai

# 查看系统资源
docker system df
```

## 🔒 安全建议

1. **环境变量安全**
   - 使用强密码和密钥
   - 不要在代码中硬编码敏感信息
   - 定期轮换密钥

2. **网络安全**
   - 使用 HTTPS
   - 配置防火墙
   - 限制容器网络访问

3. **镜像安全**
   - 定期更新基础镜像
   - 扫描镜像漏洞
   - 使用非 root 用户运行

## 📞 支持

如果遇到问题，请：

1. 检查日志输出
2. 验证环境变量配置
3. 确认网络连接
4. 查看 GitHub Issues

---

更多信息请参考项目主 README 文件。
