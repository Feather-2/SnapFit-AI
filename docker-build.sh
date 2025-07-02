#!/bin/bash

# Docker 构建脚本 - 优化版本
# 用于构建轻量级的生产镜像

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
IMAGE_NAME="snapifit-ai"
TAG=${1:-latest}
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

echo -e "${BLUE}🐳 开始构建优化的 Docker 镜像...${NC}"
echo -e "${BLUE}镜像名称: ${FULL_IMAGE_NAME}${NC}"

# 清理之前的构建缓存（可选）
if [ "$2" = "--no-cache" ]; then
    echo -e "${YELLOW}⚠️  使用 --no-cache 构建${NC}"
    CACHE_FLAG="--no-cache"
else
    CACHE_FLAG=""
fi

# 构建镜像
echo -e "${BLUE}📦 构建镜像...${NC}"
docker build $CACHE_FLAG -t $FULL_IMAGE_NAME .

# 检查构建结果
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 镜像构建成功！${NC}"
    
    # 显示镜像大小
    echo -e "${BLUE}📊 镜像信息:${NC}"
    docker images $FULL_IMAGE_NAME --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    # 显示镜像层信息
    echo -e "\n${BLUE}🔍 镜像层信息:${NC}"
    docker history $FULL_IMAGE_NAME --format "table {{.CreatedBy}}\t{{.Size}}" | head -10
    
    echo -e "\n${GREEN}🚀 可以使用以下命令运行容器:${NC}"
    echo -e "${YELLOW}docker run -p 3000:3000 --env-file .env $FULL_IMAGE_NAME${NC}"
    
else
    echo -e "${RED}❌ 镜像构建失败！${NC}"
    exit 1
fi
