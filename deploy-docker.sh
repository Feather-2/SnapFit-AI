#!/bin/bash

# Snapifit-AI Docker 部署脚本
# 使用方法: ./deploy-docker.sh [sqlite|postgres]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查依赖
check_dependencies() {
    print_step "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_message "依赖检查通过"
}

# 检查环境变量文件
check_env_file() {
    print_step "检查环境变量文件..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env 文件不存在，正在创建示例文件..."
        cat > .env << EOF
# 应用配置
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:3000

# 数据库配置
DATABASE_URL="file:/app/data/prod.db"

# 用户认证配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"

# 邀请码配置
INVITE_CODE="your-invite-code-here"

# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_MODEL=gpt-4-turbo

# PostgreSQL 密码（仅在使用 PostgreSQL 时需要）
POSTGRES_PASSWORD=your_secure_password_here
EOF
        print_warning "请编辑 .env 文件并填入正确的配置信息"
        print_warning "特别是 OPENAI_API_KEY 和 NEXTAUTH_SECRET"
        read -p "按回车键继续..."
    fi
    
    print_message "环境变量文件检查完成"
}

# 部署 SQLite 版本
deploy_sqlite() {
    print_step "部署 SQLite 版本..."
    
    # 停止现有容器
    docker-compose down 2>/dev/null || true
    
    # 构建并启动
    docker-compose up -d --build
    
    print_message "SQLite 版本部署完成"
    print_message "应用地址: http://localhost:3000"
}

# 部署 PostgreSQL 版本
deploy_postgres() {
    print_step "部署 PostgreSQL 版本..."
    
    # 检查 PostgreSQL 密码
    if ! grep -q "POSTGRES_PASSWORD=" .env || grep -q "POSTGRES_PASSWORD=your_secure_password_here" .env; then
        print_error "请在 .env 文件中设置安全的 POSTGRES_PASSWORD"
        exit 1
    fi
    
    # 停止现有容器
    docker-compose -f docker-compose.postgres.yml down 2>/dev/null || true
    
    # 构建并启动
    docker-compose -f docker-compose.postgres.yml up -d --build
    
    print_message "PostgreSQL 版本部署完成"
    print_message "应用地址: http://localhost"
}

# 显示状态
show_status() {
    print_step "显示容器状态..."
    
    if [ "$1" = "postgres" ]; then
        docker-compose -f docker-compose.postgres.yml ps
    else
        docker-compose ps
    fi
}

# 显示日志
show_logs() {
    print_step "显示应用日志..."
    
    if [ "$1" = "postgres" ]; then
        docker-compose -f docker-compose.postgres.yml logs -f app
    else
        docker-compose logs -f app
    fi
}

# 主函数
main() {
    local deployment_type=${1:-sqlite}
    
    print_message "开始部署 Snapifit-AI (${deployment_type} 版本)"
    
    check_dependencies
    check_env_file
    
    case $deployment_type in
        sqlite)
            deploy_sqlite
            ;;
        postgres)
            deploy_postgres
            ;;
        *)
            print_error "无效的部署类型: $deployment_type"
            print_message "使用方法: $0 [sqlite|postgres]"
            exit 1
            ;;
    esac
    
    echo
    show_status $deployment_type
    
    echo
    print_message "部署完成！"
    print_message "查看日志: $0 logs $deployment_type"
    print_message "停止服务: docker-compose down"
    
    if [ "$deployment_type" = "postgres" ]; then
        print_message "停止服务: docker-compose -f docker-compose.postgres.yml down"
    fi
}

# 处理命令行参数
case ${1:-} in
    logs)
        show_logs ${2:-sqlite}
        ;;
    status)
        show_status ${2:-sqlite}
        ;;
    *)
        main $1
        ;;
esac
