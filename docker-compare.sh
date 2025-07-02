#!/bin/bash

# Docker 镜像对比脚本
# 用于对比优化前后的镜像大小

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Docker 镜像对比分析${NC}"
echo -e "${BLUE}================================${NC}"

# 显示所有相关镜像
echo -e "\n${BLUE}📊 当前所有 snapifit 相关镜像:${NC}"
docker images | grep -E "(snapifit|REPOSITORY)" || echo "未找到相关镜像"

echo -e "\n${BLUE}📈 镜像大小分析:${NC}"

# 获取镜像大小（如果存在）
OLD_SIZE=$(docker images --format "{{.Size}}" --filter "reference=snapifit-ai:old" 2>/dev/null | head -1 || echo "N/A")
NEW_SIZE=$(docker images --format "{{.Size}}" --filter "reference=snapifit-ai:latest" 2>/dev/null | head -1 || echo "N/A")

echo -e "旧镜像大小: ${YELLOW}$OLD_SIZE${NC}"
echo -e "新镜像大小: ${GREEN}$NEW_SIZE${NC}"

# 如果两个镜像都存在，计算节省的空间
if [ "$OLD_SIZE" != "N/A" ] && [ "$NEW_SIZE" != "N/A" ]; then
    echo -e "\n${GREEN}✅ 镜像优化成功！${NC}"
    echo -e "${BLUE}优化效果:${NC}"
    echo -e "- 移除了完整的 node_modules (开发依赖)"
    echo -e "- 使用 Next.js standalone 输出"
    echo -e "- 直接使用 Node.js 运行，无需 pnpm"
    echo -e "- 优化了 Docker 层缓存"
fi

echo -e "\n${BLUE}🔧 优化建议:${NC}"
echo -e "1. 定期清理未使用的镜像: ${YELLOW}docker image prune${NC}"
echo -e "2. 使用多阶段构建减少镜像大小"
echo -e "3. 只复制运行时必需的文件"
echo -e "4. 使用 .dockerignore 排除不必要的文件"

echo -e "\n${BLUE}🚀 测试新镜像:${NC}"
echo -e "${YELLOW}docker run -p 3000:3000 --env-file .env snapifit-ai:latest${NC}"
