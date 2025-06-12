#!/bin/bash

# Snapifit AI 部署脚本
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
ENVIRONMENT=${1:-development}
IMAGE_NAME="snapfit-ai"
TAG=${2:-latest}

echo -e "${GREEN}🚀 开始部署 Snapifit AI...${NC}"
echo -e "${BLUE}环境: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}镜像: ${IMAGE_NAME}:${TAG}${NC}"

# 检查环境参数
if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}❌ 无效的环境参数。请使用 'development' 或 'production'${NC}"
    echo -e "${YELLOW}用法: $0 [development|production] [tag]${NC}"
    exit 1
fi

# 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi

# 检查环境变量文件
if [ "$ENVIRONMENT" = "development" ]; then
    ENV_FILE=".env"
    COMPOSE_FILE="deployment/docker/docker-compose.yml"
else
    ENV_FILE=".env.production"
    COMPOSE_FILE="deployment/docker/docker-compose.prod.yml"
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 环境变量文件 $ENV_FILE 不存在${NC}"
    echo -e "${YELLOW}请复制 .env.example 并配置相应的环境变量${NC}"
    exit 1
fi

# 停止现有服务
echo -e "${YELLOW}🛑 停止现有服务...${NC}"
docker-compose -f "$COMPOSE_FILE" down --remove-orphans

# 拉取最新镜像（如果使用远程镜像）
# echo -e "${YELLOW}📥 拉取最新镜像...${NC}"
# docker-compose -f "$COMPOSE_FILE" pull

# 构建镜像
echo -e "${YELLOW}🔨 构建镜像...${NC}"
docker-compose -f "$COMPOSE_FILE" build --no-cache

# 启动服务
echo -e "${YELLOW}🚀 启动服务...${NC}"
if [ "$ENVIRONMENT" = "development" ]; then
    docker-compose -f "$COMPOSE_FILE" up -d
else
    docker-compose -f "$COMPOSE_FILE" up -d --scale snapfit-ai=1
fi

# 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
sleep 10

# 健康检查
echo -e "${YELLOW}🔍 检查服务健康状态...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 服务启动成功！${NC}"
        break
    else
        echo -e "${YELLOW}⏳ 等待服务启动... ($((RETRY_COUNT + 1))/$MAX_RETRIES)${NC}"
        sleep 2
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ 服务启动失败或健康检查超时${NC}"
    echo -e "${YELLOW}查看日志:${NC}"
    docker-compose -f "$COMPOSE_FILE" logs --tail=50
    exit 1
fi

# 显示服务状态
echo -e "${GREEN}📊 服务状态:${NC}"
docker-compose -f "$COMPOSE_FILE" ps

echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}应用访问地址: http://localhost:3000${NC}"
echo -e "${BLUE}健康检查: http://localhost:3000/api/health${NC}"

# 显示有用的命令
echo -e "${YELLOW}常用命令:${NC}"
echo -e "  查看日志: ${GREEN}docker-compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "  停止服务: ${GREEN}docker-compose -f $COMPOSE_FILE down${NC}"
echo -e "  重启服务: ${GREEN}docker-compose -f $COMPOSE_FILE restart${NC}"
echo -e "  查看状态: ${GREEN}docker-compose -f $COMPOSE_FILE ps${NC}"
