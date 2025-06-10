#!/bin/bash

# SnapFit AI 数据库初始化脚本
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${GREEN}SnapFit AI 数据库初始化脚本${NC}"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --supabase          初始化 Supabase 数据库"
    echo "  --postgresql        初始化 PostgreSQL 数据库"
    echo "  --url DATABASE_URL  指定数据库连接字符串"
    echo "  --backup            初始化前备份现有数据"
    echo "  --force             强制重新初始化（删除现有数据）"
    echo "  --demo-data         插入演示数据"
    echo "  --help              显示此帮助信息"
    echo ""
    echo "环境变量:"
    echo "  DATABASE_URL        PostgreSQL 连接字符串"
    echo "  SUPABASE_DB_URL     Supabase 数据库连接字符串"
    echo ""
    echo "示例:"
    echo "  $0 --supabase --demo-data"
    echo "  $0 --postgresql --url postgresql://user:pass@localhost:5432/snapfit"
    echo "  $0 --postgresql --backup --force"
}

# 检查依赖
check_dependencies() {
    echo -e "${YELLOW}🔍 检查依赖...${NC}"
    
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ PostgreSQL 客户端 (psql) 未安装${NC}"
        echo "请安装 PostgreSQL 客户端工具"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 依赖检查通过${NC}"
}

# 检查数据库连接
check_database_connection() {
    local db_url="$1"
    
    echo -e "${YELLOW}🔗 测试数据库连接...${NC}"
    
    if psql "$db_url" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库连接成功${NC}"
    else
        echo -e "${RED}❌ 数据库连接失败${NC}"
        echo "请检查数据库连接字符串和网络连接"
        exit 1
    fi
}

# 备份数据库
backup_database() {
    local db_url="$1"
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    echo -e "${YELLOW}💾 备份数据库到 $backup_file...${NC}"
    
    if pg_dump "$db_url" > "$backup_file"; then
        echo -e "${GREEN}✅ 数据库备份完成${NC}"
    else
        echo -e "${RED}❌ 数据库备份失败${NC}"
        exit 1
    fi
}

# 检查表是否存在
check_existing_tables() {
    local db_url="$1"
    
    local table_count=$(psql "$db_url" -t -c "
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'shared_keys', 'daily_logs');
    " | tr -d ' ')
    
    echo "$table_count"
}

# 强制清理数据库
force_cleanup() {
    local db_url="$1"
    
    echo -e "${YELLOW}🧹 清理现有数据库结构...${NC}"
    
    psql "$db_url" << 'EOF'
-- 删除触发器
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS trigger_shared_keys_updated_at ON shared_keys;
DROP TRIGGER IF EXISTS trigger_ai_memories_version ON ai_memories;
DROP TRIGGER IF EXISTS trigger_users_security_log ON users;
DROP TRIGGER IF EXISTS trigger_shared_keys_security_log ON shared_keys;

-- 删除函数
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS manage_ai_memory_version CASCADE;
DROP FUNCTION IF EXISTS update_user_login_stats CASCADE;
DROP FUNCTION IF EXISTS log_security_event CASCADE;
DROP FUNCTION IF EXISTS get_user_profile CASCADE;
DROP FUNCTION IF EXISTS upsert_user_profile CASCADE;
DROP FUNCTION IF EXISTS upsert_log_patch CASCADE;
DROP FUNCTION IF EXISTS get_user_ai_memories CASCADE;
DROP FUNCTION IF EXISTS upsert_ai_memories CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_ai_memories CASCADE;
DROP FUNCTION IF EXISTS atomic_usage_check_and_increment CASCADE;
DROP FUNCTION IF EXISTS decrement_usage_count CASCADE;
DROP FUNCTION IF EXISTS increment_shared_key_usage CASCADE;
DROP FUNCTION IF EXISTS get_user_shared_key_usage CASCADE;
DROP FUNCTION IF EXISTS get_user_today_usage CASCADE;
DROP FUNCTION IF EXISTS reset_shared_keys_daily CASCADE;
DROP FUNCTION IF EXISTS jsonb_deep_merge CASCADE;
DROP FUNCTION IF EXISTS merge_arrays_by_log_id CASCADE;

-- 删除定时任务
SELECT cron.unschedule('daily-shared-keys-reset') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-shared-keys-reset'
);
SELECT cron.unschedule('weekly-ai-memory-cleanup') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-ai-memory-cleanup'
);

-- 删除表
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS ai_memories CASCADE;
DROP TABLE IF EXISTS daily_logs CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS shared_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除序列
DROP SEQUENCE IF EXISTS security_events_id_seq CASCADE;

\echo '✅ 数据库清理完成'
EOF

    echo -e "${GREEN}✅ 数据库清理完成${NC}"
}

# 执行初始化
run_initialization() {
    local db_url="$1"
    local include_demo="$2"
    
    echo -e "${YELLOW}🚀 开始数据库初始化...${NC}"
    
    # 执行初始化脚本
    echo -e "${BLUE}📋 执行表结构初始化...${NC}"
    psql "$db_url" -f database/init.sql
    
    echo -e "${BLUE}📋 执行函数初始化...${NC}"
    psql "$db_url" -f database/functions.sql
    
    echo -e "${BLUE}📋 执行触发器初始化...${NC}"
    psql "$db_url" -f database/triggers.sql
    
    # 如果需要演示数据
    if [ "$include_demo" = true ]; then
        echo -e "${BLUE}📋 插入演示数据...${NC}"
        psql "$db_url" << 'EOF'
-- 插入演示用户
INSERT INTO users (
  username, display_name, email, trust_level, is_active
) VALUES (
  'demo_user', 'Demo User', 'demo@example.com', 1, true
) ON CONFLICT DO NOTHING;

-- 插入演示共享密钥
INSERT INTO shared_keys (
  user_id, name, base_url, api_key_encrypted, available_models,
  daily_limit, description, tags, is_active
) VALUES (
  (SELECT id FROM users WHERE username = 'demo_user' LIMIT 1),
  'Demo OpenAI Key',
  'https://api.openai.com',
  'demo_encrypted_key',
  ARRAY['gpt-3.5-turbo'],
  50,
  'Demo key for testing',
  ARRAY['demo'],
  false
) ON CONFLICT DO NOTHING;

\echo '✅ 演示数据插入完成'
EOF
    fi
    
    echo -e "${GREEN}✅ 数据库初始化完成${NC}"
}

# 验证初始化结果
verify_initialization() {
    local db_url="$1"
    
    echo -e "${YELLOW}🔍 验证初始化结果...${NC}"
    
    # 检查表数量
    local table_count=$(psql "$db_url" -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public';
    " | tr -d ' ')
    
    # 检查函数数量
    local function_count=$(psql "$db_url" -t -c "
        SELECT COUNT(*) FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
    " | tr -d ' ')
    
    # 检查触发器数量
    local trigger_count=$(psql "$db_url" -t -c "
        SELECT COUNT(*) FROM information_schema.triggers 
        WHERE trigger_schema = 'public';
    " | tr -d ' ')
    
    echo -e "${GREEN}📊 初始化结果:${NC}"
    echo -e "  表数量: $table_count"
    echo -e "  函数数量: $function_count"
    echo -e "  触发器数量: $trigger_count"
    
    if [ "$table_count" -ge 6 ] && [ "$function_count" -ge 10 ]; then
        echo -e "${GREEN}✅ 初始化验证通过${NC}"
    else
        echo -e "${RED}❌ 初始化验证失败${NC}"
        exit 1
    fi
}

# 主函数
main() {
    local db_type=""
    local db_url=""
    local do_backup=false
    local force_init=false
    local include_demo=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --supabase)
                db_type="supabase"
                shift
                ;;
            --postgresql)
                db_type="postgresql"
                shift
                ;;
            --url)
                db_url="$2"
                shift 2
                ;;
            --backup)
                do_backup=true
                shift
                ;;
            --force)
                force_init=true
                shift
                ;;
            --demo-data)
                include_demo=true
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
    
    # 检查参数
    if [ -z "$db_type" ]; then
        echo -e "${RED}❌ 请指定数据库类型 (--supabase 或 --postgresql)${NC}"
        show_help
        exit 1
    fi
    
    # 确定数据库连接字符串
    if [ -z "$db_url" ]; then
        if [ "$db_type" = "supabase" ]; then
            db_url="$SUPABASE_DB_URL"
        else
            db_url="$DATABASE_URL"
        fi
    fi
    
    if [ -z "$db_url" ]; then
        echo -e "${RED}❌ 请提供数据库连接字符串${NC}"
        echo "使用 --url 参数或设置相应的环境变量"
        exit 1
    fi
    
    echo -e "${GREEN}🚀 开始 SnapFit AI 数据库初始化...${NC}"
    echo -e "${BLUE}数据库类型: $db_type${NC}"
    
    # 执行初始化流程
    check_dependencies
    check_database_connection "$db_url"
    
    # 检查现有表
    local existing_tables=$(check_existing_tables "$db_url")
    if [ "$existing_tables" -gt 0 ]; then
        if [ "$force_init" = true ]; then
            if [ "$do_backup" = true ]; then
                backup_database "$db_url"
            fi
            force_cleanup "$db_url"
        else
            echo -e "${YELLOW}⚠️  检测到现有表结构${NC}"
            echo "使用 --force 强制重新初始化，或 --backup 先备份数据"
            exit 1
        fi
    fi
    
    run_initialization "$db_url" "$include_demo"
    verify_initialization "$db_url"
    
    echo -e "${GREEN}🎉 数据库初始化完成！${NC}"
    echo -e "${YELLOW}下一步:${NC}"
    echo "1. 配置应用环境变量"
    echo "2. 启动应用服务"
    echo "3. 测试数据库连接"
}

# 运行主函数
main "$@"
