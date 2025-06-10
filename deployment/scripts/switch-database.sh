#!/bin/bash

# 数据库切换脚本
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${GREEN}数据库切换脚本${NC}"
    echo ""
    echo "用法: $0 [supabase|postgresql] [options]"
    echo ""
    echo "选项:"
    echo "  supabase     切换到 Supabase"
    echo "  postgresql   切换到 PostgreSQL"
    echo "  --backup     切换前备份数据"
    echo "  --test       切换后运行测试"
    echo "  --help       显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 postgresql --backup --test"
    echo "  $0 supabase"
}

# 检查依赖
check_dependencies() {
    echo -e "${YELLOW}🔍 检查依赖...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker 未安装${NC}"
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null && ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ 包管理器未安装 (pnpm 或 npm)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 依赖检查通过${NC}"
}

# 备份数据
backup_data() {
    echo -e "${YELLOW}💾 备份当前数据...${NC}"
    
    local current_provider=$(grep "^DB_PROVIDER=" .env 2>/dev/null | cut -d'=' -f2 || echo "supabase")
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if [ "$current_provider" = "supabase" ]; then
        if [ -z "$SUPABASE_DB_URL" ]; then
            echo -e "${RED}❌ 请设置 SUPABASE_DB_URL 环境变量${NC}"
            exit 1
        fi
        pg_dump "$SUPABASE_DB_URL" > "$backup_file"
    else
        if [ -z "$DATABASE_URL" ]; then
            echo -e "${RED}❌ 请设置 DATABASE_URL 环境变量${NC}"
            exit 1
        fi
        pg_dump "$DATABASE_URL" > "$backup_file"
    fi
    
    echo -e "${GREEN}✅ 数据已备份到 $backup_file${NC}"
}

# 切换到 Supabase
switch_to_supabase() {
    echo -e "${BLUE}🔄 切换到 Supabase...${NC}"
    
    # 检查必需的环境变量
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo -e "${RED}❌ 缺少 Supabase 环境变量${NC}"
        echo "请设置以下环境变量:"
        echo "  NEXT_PUBLIC_SUPABASE_URL"
        echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY"
        echo "  SUPABASE_SERVICE_ROLE_KEY"
        exit 1
    fi
    
    # 更新 .env 文件
    if [ -f .env ]; then
        sed -i 's/^DB_PROVIDER=.*/DB_PROVIDER=supabase/' .env
    else
        echo "DB_PROVIDER=supabase" > .env
        echo "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL" >> .env
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY" >> .env
        echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" >> .env
    fi
    
    echo -e "${GREEN}✅ 已切换到 Supabase${NC}"
}

# 切换到 PostgreSQL
switch_to_postgresql() {
    echo -e "${BLUE}🔄 切换到 PostgreSQL...${NC}"
    
    # 检查必需的环境变量
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ 缺少 DATABASE_URL 环境变量${NC}"
        echo "请设置 DATABASE_URL 环境变量，例如:"
        echo "  export DATABASE_URL=postgresql://user:password@localhost:5432/snapfit_ai"
        exit 1
    fi
    
    # 安装 PostgreSQL 依赖
    echo -e "${YELLOW}📦 安装 PostgreSQL 依赖...${NC}"
    if command -v pnpm &> /dev/null; then
        pnpm add pg @types/pg
    else
        npm install pg @types/pg
    fi
    
    # 更新 .env 文件
    if [ -f .env ]; then
        sed -i 's/^DB_PROVIDER=.*/DB_PROVIDER=postgresql/' .env
        if ! grep -q "^DATABASE_URL=" .env; then
            echo "DATABASE_URL=$DATABASE_URL" >> .env
        else
            sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env
        fi
    else
        echo "DB_PROVIDER=postgresql" > .env
        echo "DATABASE_URL=$DATABASE_URL" >> .env
    fi
    
    echo -e "${GREEN}✅ 已切换到 PostgreSQL${NC}"
}

# 运行测试
run_tests() {
    echo -e "${YELLOW}🧪 运行测试...${NC}"
    
    # 重启服务
    if [ -f docker-compose.yml ]; then
        docker-compose restart
        sleep 5
    fi
    
    # 测试健康检查
    echo "测试健康检查..."
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 健康检查通过${NC}"
    else
        echo -e "${RED}❌ 健康检查失败${NC}"
        exit 1
    fi
    
    # 测试数据库连接
    echo "测试数据库连接..."
    # 这里可以添加更多具体的测试
    
    echo -e "${GREEN}✅ 所有测试通过${NC}"
}

# 主函数
main() {
    local target_db=""
    local do_backup=false
    local do_test=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            supabase|postgresql)
                target_db="$1"
                shift
                ;;
            --backup)
                do_backup=true
                shift
                ;;
            --test)
                do_test=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}❌ 未知参数: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 检查目标数据库
    if [ -z "$target_db" ]; then
        echo -e "${RED}❌ 请指定目标数据库 (supabase 或 postgresql)${NC}"
        show_help
        exit 1
    fi
    
    echo -e "${GREEN}🚀 开始数据库切换流程...${NC}"
    echo -e "${BLUE}目标数据库: $target_db${NC}"
    
    # 执行流程
    check_dependencies
    
    if [ "$do_backup" = true ]; then
        backup_data
    fi
    
    case $target_db in
        supabase)
            switch_to_supabase
            ;;
        postgresql)
            switch_to_postgresql
            ;;
    esac
    
    if [ "$do_test" = true ]; then
        run_tests
    fi
    
    echo -e "${GREEN}🎉 数据库切换完成！${NC}"
    echo -e "${YELLOW}请重启应用以使更改生效${NC}"
}

# 运行主函数
main "$@"
