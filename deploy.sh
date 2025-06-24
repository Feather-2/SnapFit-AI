#!/bin/bash

# 部署脚本 - 从GitHub Container Registry拉取并运行最新镜像

# 配置变量
GITHUB_USERNAME="你的GitHub用户名"
REPO_NAME="Snapifit-AI"
IMAGE_NAME="ghcr.io/${GITHUB_USERNAME}/${REPO_NAME}"
CONTAINER_NAME="snapifit-app"
ENV_FILE=".env"

# 确保.env文件存在
if [ ! -f "$ENV_FILE" ]; then
    echo "错误：找不到.env文件。请创建.env文件并配置必要的环境变量。"
    exit 1
fi

# 登录到GitHub Container Registry
# 注意：首次运行需要使用GitHub个人访问令牌
# echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# 拉取最新镜像
echo "正在拉取最新镜像..."
docker pull ${IMAGE_NAME}:latest

# 停止并移除旧容器（如果存在）
echo "停止并移除旧容器（如果存在）..."
docker stop ${CONTAINER_NAME} 2>/dev/null || true
docker rm ${CONTAINER_NAME} 2>/dev/null || true

# 创建网络（如果不存在）
docker network create snapifit-network 2>/dev/null || true

# 运行新容器
echo "启动新容器..."
docker run -d \
    --name ${CONTAINER_NAME} \
    --restart unless-stopped \
    --network snapifit-network \
    -p 3000:3000 \
    --env-file ${ENV_FILE} \
    --health-cmd="wget --spider -q http://localhost:3000" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=10s \
    ${IMAGE_NAME}:latest

echo "部署完成！应用正在运行在 http://localhost:3000" 