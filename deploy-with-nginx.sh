#!/bin/bash

# 生产环境部署脚本 - 从GitHub Container Registry拉取镜像并使用NGINX作为反向代理

# 配置变量
GITHUB_USERNAME="你的GitHub用户名"
REPO_NAME="Snapifit-AI"
IMAGE_NAME="ghcr.io/${GITHUB_USERNAME}/${REPO_NAME}"
CONTAINER_NAME="snapifit-app"
NGINX_CONTAINER_NAME="snapifit-nginx"
ENV_FILE=".env"
NGINX_CONF="nginx.conf"
NETWORK_NAME="snapifit-network"

# 确保必要的文件存在
if [ ! -f "$ENV_FILE" ]; then
    echo "错误：找不到.env文件。请创建.env文件并配置必要的环境变量。"
    exit 1
fi

if [ ! -f "$NGINX_CONF" ]; then
    echo "错误：找不到nginx.conf文件。请创建nginx.conf文件。"
    exit 1
fi

# 登录到GitHub Container Registry
# 注意：首次运行需要使用GitHub个人访问令牌
# echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# 拉取最新镜像
echo "正在拉取最新镜像..."
docker pull ${IMAGE_NAME}:latest

# 创建网络（如果不存在）
docker network create ${NETWORK_NAME} 2>/dev/null || true

# 停止并移除旧容器（如果存在）
echo "停止并移除旧容器（如果存在）..."
docker stop ${CONTAINER_NAME} 2>/dev/null || true
docker rm ${CONTAINER_NAME} 2>/dev/null || true
docker stop ${NGINX_CONTAINER_NAME} 2>/dev/null || true
docker rm ${NGINX_CONTAINER_NAME} 2>/dev/null || true

# 创建数据卷（如果不存在）
docker volume create nginx-logs 2>/dev/null || true
docker volume create app-data 2>/dev/null || true

# 运行应用容器
echo "启动应用容器..."
docker run -d \
    --name ${CONTAINER_NAME} \
    --restart unless-stopped \
    --network ${NETWORK_NAME} \
    --env-file ${ENV_FILE} \
    -v app-data:/app/data \
    ${IMAGE_NAME}:latest

# 运行NGINX容器
echo "启动NGINX容器..."
docker run -d \
    --name ${NGINX_CONTAINER_NAME} \
    --restart unless-stopped \
    --network ${NETWORK_NAME} \
    -p 80:80 \
    -p 443:443 \
    -v $(pwd)/${NGINX_CONF}:/etc/nginx/conf.d/default.conf \
    -v $(pwd)/ssl:/etc/nginx/ssl \
    -v nginx-logs:/var/log/nginx \
    nginx:alpine

echo "部署完成！应用已通过NGINX代理运行。"
echo "请确保您的域名已正确配置并指向此服务器。" 