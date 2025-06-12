#!/bin/bash

# Snapifit AI Docker 构建脚本
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
IMAGE_NAME="snapfit-ai"
TAG=${1:-latest}
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

echo -e "${GREEN}🚀 开始构建 Snapifit AI Docker 镜像...${NC}"
echo -e "${YELLOW}镜像名称: ${FULL_IMAGE_NAME}${NC}"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

# 检查必要文件
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 未找到 package.json，请在项目根目录运行此脚本${NC}"
    exit 1
fi

if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ 未找到 Dockerfile${NC}"
    exit 1
fi

# 清理旧的构建缓存（可选）
echo -e "${YELLOW}🧹 清理 Docker 构建缓存...${NC}"
docker builder prune -f

# 构建镜像
echo -e "${YELLOW}🔨 构建 Docker 镜像...${NC}"
docker build \
    --tag "${FULL_IMAGE_NAME}" \
    --build-arg NODE_ENV=production \
    --progress=plain \
    .

# 检查构建结果
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker 镜像构建成功！${NC}"
    echo -e "${GREEN}镜像名称: ${FULL_IMAGE_NAME}${NC}"

    # 显示镜像信息
    echo -e "${YELLOW}📊 镜像信息:${NC}"
    docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

    echo -e "${GREEN}🎉 构建完成！${NC}"
    echo -e "${YELLOW}运行命令:${NC}"
    echo -e "  开发环境: ${GREEN}docker-compose up${NC}"
    echo -e "  生产环境: ${GREEN}docker-compose -f docker-compose.prod.yml up${NC}"
    echo -e "  直接运行: ${GREEN}docker run -p 3000:3000 --env-file .env ${FULL_IMAGE_NAME}${NC}"
else
    echo -e "${RED}❌ Docker 镜像构建失败${NC}"
    exit 1
fi
