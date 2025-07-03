#!/bin/bash

# 修复部署脚本
# 用于快速部署所有修复

set -e

echo "🚀 开始部署修复..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 1. 运行测试验证修复
echo "📋 1. 验证修复..."
node scripts/test-fixes.js

# 2. 安装依赖
echo "📦 2. 安装依赖..."
pnpm install

# 3. 生成 Prisma 客户端
echo "🗄️ 3. 生成数据库客户端..."
npx prisma generate

# 4. 构建应用
echo "🔨 4. 构建应用..."
pnpm build

# 5. 检查是否使用 Docker
if [ -f "docker-compose.yml" ]; then
    echo "🐳 5. 检测到 Docker 配置，重新构建容器..."
    
    # 停止现有容器
    docker-compose down
    
    # 重新构建镜像
    docker build -t snapifit-ai .
    
    # 启动容器
    docker-compose up -d
    
    echo "✅ Docker 部署完成！"
    echo "📱 应用现在运行在: http://localhost:3000"
    
else
    echo "🖥️ 5. 本地部署模式..."
    echo "✅ 构建完成！"
    echo "📱 运行 'pnpm start' 启动应用"
fi

echo ""
echo "🎉 修复部署完成！"
echo ""
echo "📋 已修复的问题:"
echo "  ✅ 个人信息现在保存到服务端"
echo "  ✅ 设置页面选项卡样式已优化"
echo "  ✅ 首页卡路里计算已修复"
echo "  ✅ 缓存问题已解决，支持版本更新提示"
echo ""
echo "🔍 测试建议:"
echo "  1. 访问设置页面测试个人信息保存"
echo "  2. 添加食物和运动记录测试卡路里计算"
echo "  3. 在不同设备上测试选项卡样式"
echo "  4. 下次更新时测试版本提示功能"
echo ""
echo "📚 详细信息请查看: FIXES_DEPLOYMENT_GUIDE.md"
