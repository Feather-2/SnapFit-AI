#!/bin/bash

# Snapifit AI 服务器初始化脚本
# 支持 CentOS 7/8/9, Ubuntu 18.04/20.04/22.04, Debian 10/11
# 用法: curl -fsSL https://your-domain.com/server-init.sh | bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="snapfit-ai"
APP_USER="snapfit"
APP_DIR="/opt/snapfit-ai"
LOG_FILE="/var/log/snapfit-init.log"

# 显示横幅
show_banner() {
    echo -e "${GREEN}"
    echo "=================================================="
    echo "    Snapifit AI 服务器初始化脚本"
    echo "=================================================="
    echo -e "${NC}"
    echo "本脚本将自动配置服务器环境，包括："
    echo "• Docker 和 Docker Compose"
    echo "• 防火墙配置"
    echo "• 用户权限设置"
    echo "• 系统优化"
    echo ""
}

# 日志函数
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_FILE"
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi

    log "检测到操作系统: $OS $VER"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        echo "使用方法: sudo $0"
        exit 1
    fi
}

# 系统更新
update_system() {
    log "🔄 更新系统包..."

    case "$OS" in
        *"CentOS"*|*"Red Hat"*|*"Rocky"*|*"AlmaLinux"*)
            yum update -y
            yum install -y epel-release
            yum install -y curl wget git vim htop unzip
            ;;
        *"Ubuntu"*|*"Debian"*)
            apt-get update
            apt-get upgrade -y
            apt-get install -y curl wget git vim htop unzip apt-transport-https ca-certificates gnupg lsb-release
            ;;
        *)
            log_error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac

    log "✅ 系统更新完成"
}

# 安装 Docker
install_docker() {
    log "🐳 安装 Docker..."

    # 检查是否已安装
    if command -v docker &> /dev/null; then
        log_warning "Docker 已安装，跳过安装步骤"
        return
    fi

    case "$OS" in
        *"CentOS"*|*"Red Hat"*|*"Rocky"*|*"AlmaLinux"*)
            # 安装 Docker CE
            yum install -y yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        *"Ubuntu"*)
            # 安装 Docker CE
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        *"Debian"*)
            # 安装 Docker CE
            curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
    esac

    # 启动并启用 Docker
    systemctl start docker
    systemctl enable docker

    # 验证安装
    if docker --version && docker compose version; then
        log "✅ Docker 安装成功"
    else
        log_error "Docker 安装失败"
        exit 1
    fi
}

# 创建应用用户
create_app_user() {
    log "👤 创建应用用户..."

    if id "$APP_USER" &>/dev/null; then
        log_warning "用户 $APP_USER 已存在"
    else
        useradd -r -s /bin/bash -d "$APP_DIR" "$APP_USER"
        log "✅ 用户 $APP_USER 创建成功"
    fi

    # 将用户添加到 docker 组
    usermod -aG docker "$APP_USER"

    # 创建应用目录
    mkdir -p "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
}

# 配置防火墙
configure_firewall() {
    log "🔥 配置防火墙..."

    case "$OS" in
        *"CentOS"*|*"Red Hat"*|*"Rocky"*|*"AlmaLinux"*)
            if systemctl is-active --quiet firewalld; then
                firewall-cmd --permanent --add-port=80/tcp
                firewall-cmd --permanent --add-port=443/tcp
                firewall-cmd --permanent --add-port=3000/tcp
                firewall-cmd --reload
                log "✅ FirewallD 配置完成"
            else
                log_warning "FirewallD 未运行，跳过防火墙配置"
            fi
            ;;
        *"Ubuntu"*|*"Debian"*)
            if command -v ufw &> /dev/null; then
                ufw --force enable
                ufw allow 22/tcp
                ufw allow 80/tcp
                ufw allow 443/tcp
                ufw allow 3000/tcp
                log "✅ UFW 防火墙配置完成"
            else
                log_warning "UFW 未安装，跳过防火墙配置"
            fi
            ;;
    esac
}

# 系统优化
optimize_system() {
    log "⚡ 系统优化..."

    # 增加文件描述符限制
    cat >> /etc/security/limits.conf << EOF
$APP_USER soft nofile 65536
$APP_USER hard nofile 65536
EOF

    # 优化内核参数
    cat >> /etc/sysctl.conf << EOF
# Snapifit AI 优化
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
vm.max_map_count = 262144
EOF

    sysctl -p

    log "✅ 系统优化完成"
}

# 安装监控工具
install_monitoring() {
    log "📊 安装监控工具..."

    case "$OS" in
        *"CentOS"*|*"Red Hat"*|*"Rocky"*|*"AlmaLinux"*)
            yum install -y htop iotop nethogs
            ;;
        *"Ubuntu"*|*"Debian"*)
            apt-get install -y htop iotop nethogs
            ;;
    esac

    log "✅ 监控工具安装完成"
}

# 创建部署脚本
create_deploy_script() {
    log "📝 创建部署脚本..."

    cat > "$APP_DIR/deploy.sh" << 'EOF'
#!/bin/bash
# Snapifit AI 快速部署脚本

set -e

APP_DIR="/opt/snapfit-ai"
REPO_URL="https://github.com/your-username/snapfit-ai.git"

cd "$APP_DIR"

# 拉取最新代码
if [ -d ".git" ]; then
    git pull origin main
else
    git clone "$REPO_URL" .
fi

# 构建和启动
docker compose down
docker compose build --no-cache
docker compose up -d

echo "✅ 部署完成！"
echo "访问地址: http://$(curl -s ifconfig.me):3000"
EOF

    chmod +x "$APP_DIR/deploy.sh"
    chown "$APP_USER:$APP_USER" "$APP_DIR/deploy.sh"

    log "✅ 部署脚本创建完成"
}

# 主函数
main() {
    show_banner

    # 创建日志文件
    touch "$LOG_FILE"

    log "🚀 开始服务器初始化..."

    check_root
    detect_os
    update_system
    install_docker
    create_app_user
    configure_firewall
    optimize_system
    install_monitoring
    create_deploy_script

    log "🎉 服务器初始化完成！"

    echo ""
    echo -e "${GREEN}=================================================="
    echo "           初始化完成！"
    echo "==================================================${NC}"
    echo ""
    echo -e "${BLUE}下一步操作：${NC}"
    echo "1. 切换到应用用户: sudo su - $APP_USER"
    echo "2. 进入应用目录: cd $APP_DIR"
    echo "3. 克隆代码仓库或上传代码"
    echo "4. 配置环境变量: cp .env.example .env && nano .env"
    echo "5. 启动应用: ./deploy.sh"
    echo ""
    echo -e "${YELLOW}重要信息：${NC}"
    echo "• 应用目录: $APP_DIR"
    echo "• 应用用户: $APP_USER"
    echo "• 日志文件: $LOG_FILE"
    echo "• 开放端口: 80, 443, 3000"
    echo ""
    echo -e "${PURPLE}监控命令：${NC}"
    echo "• 查看容器状态: docker ps"
    echo "• 查看应用日志: docker compose logs -f"
    echo "• 系统监控: htop"
    echo ""
}

# 运行主函数
main "$@"
