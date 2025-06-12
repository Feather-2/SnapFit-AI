# Snapifit AI 部署指南

本目录包含了 Snapifit AI 项目的所有部署相关文件和脚本。

## 目录结构

```
deployment/
├── docker/           # Docker 相关文件
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx.conf
│   └── quick-start.bat
├── scripts/          # 部署脚本
│   ├── deploy.sh
│   ├── docker-build.bat
│   ├── docker-build.sh
│   ├── server-init.sh
│   ├── setup-database.sh
│   ├── switch-database.sh
│   ├── install-shared-keys.bat
│   └── install-shared-keys.sh
├── database/         # 数据库相关文件
│   ├── DEPLOYMENT.md
│   ├── README.md
│   ├── complete_backup.sql
│   ├── deploy.sql
│   ├── deploy_schema_only.sql
│   ├── quick_deploy.sh
│   └── schema.sql
└── docs/            # 部署文档
    ├── DOCKER.md
    └── README.md (本文件)
```

## 快速开始

### 使用 Docker Compose (推荐)

1. **开发环境**
   ```bash
   # 从项目根目录运行
   make dev
   # 或者
   docker-compose -f deployment/docker/docker-compose.yml up -d
   ```

2. **生产环境**
   ```bash
   # 从项目根目录运行
   make prod
   # 或者
   docker-compose -f deployment/docker/docker-compose.prod.yml up -d
   ```

### 使用脚本部署

1. **服务器初始化**
   ```bash
   ./deployment/scripts/server-init.sh
   ```

2. **数据库设置**
   ```bash
   ./deployment/scripts/setup-database.sh
   ```

3. **应用部署**
   ```bash
   ./deployment/scripts/deploy.sh
   ```

## 环境配置

在部署前，请确保设置以下环境变量：

- `DATABASE_URL` - 数据库连接字符串
- `NEXTAUTH_SECRET` - NextAuth 密钥
- `NEXTAUTH_URL` - 应用 URL
- `SUPABASE_URL` - Supabase URL (如果使用 Supabase)
- `SUPABASE_ANON_KEY` - Supabase 匿名密钥

## 数据库部署

详细的数据库部署说明请参考：
- [数据库部署文档](./database/DEPLOYMENT.md)
- [数据库 README](./database/README.md)

## Docker 部署

详细的 Docker 部署说明请参考：
- [Docker 部署文档](./docs/DOCKER.md)

## 故障排除

如果遇到部署问题，请检查：

1. 环境变量是否正确设置
2. 数据库连接是否正常
3. Docker 服务是否正常运行
4. 端口是否被占用

## 更多信息

- 项目主页：[Snapifit AI](https://github.com/your-repo/snapfit-ai)
- 问题反馈：[Issues](https://github.com/your-repo/snapfit-ai/issues)
