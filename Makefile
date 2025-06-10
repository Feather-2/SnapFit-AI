# SnapFit AI Makefile
# 简化 Docker 操作的快捷命令

.PHONY: help build up down logs restart clean dev prod health

# 默认目标
help:
	@echo "SnapFit AI Docker 管理命令:"
	@echo ""
	@echo "  build     - 构建 Docker 镜像"
	@echo "  dev       - 启动开发环境"
	@echo "  prod      - 启动生产环境"
	@echo "  up        - 启动服务 (开发环境)"
	@echo "  down      - 停止服务"
	@echo "  restart   - 重启服务"
	@echo "  logs      - 查看日志"
	@echo "  health    - 检查服务健康状态"
	@echo "  clean     - 清理 Docker 资源"
	@echo "  shell     - 进入容器 shell"
	@echo ""

# 构建镜像
build:
	@echo "🔨 构建 Docker 镜像..."
	docker build -t snapfit-ai:latest .

# 开发环境
dev:
	@echo "🚀 启动开发环境..."
	docker-compose -f deployment/docker/docker-compose.yml up -d
	@echo "✅ 开发环境已启动: http://localhost:3000"

# 生产环境
prod:
	@echo "🚀 启动生产环境..."
	docker-compose -f deployment/docker/docker-compose.prod.yml up -d
	@echo "✅ 生产环境已启动: http://localhost:3000"

# 启动服务 (默认开发环境)
up: dev

# 停止服务
down:
	@echo "🛑 停止服务..."
	docker-compose -f deployment/docker/docker-compose.yml down
	docker-compose -f deployment/docker/docker-compose.prod.yml down 2>/dev/null || true

# 重启服务
restart:
	@echo "🔄 重启服务..."
	docker-compose -f deployment/docker/docker-compose.yml restart

# 查看日志
logs:
	@echo "📋 查看服务日志..."
	docker-compose -f deployment/docker/docker-compose.yml logs -f

# 健康检查
health:
	@echo "🔍 检查服务健康状态..."
	@curl -f http://localhost:3000/api/health 2>/dev/null && echo "✅ 服务正常" || echo "❌ 服务异常"

# 进入容器 shell
shell:
	@echo "🐚 进入容器 shell..."
	docker-compose -f deployment/docker/docker-compose.yml exec snapfit-ai sh

# 清理资源
clean:
	@echo "🧹 清理 Docker 资源..."
	docker-compose -f deployment/docker/docker-compose.yml down -v
	docker-compose -f deployment/docker/docker-compose.prod.yml down -v 2>/dev/null || true
	docker system prune -f
	@echo "✅ 清理完成"

# 完整部署 (构建 + 启动)
deploy-dev: build dev

deploy-prod: build prod

# 数据库初始化
init-db:
	@echo "🗄️  初始化数据库..."
	@if [ "$(DB_PROVIDER)" = "supabase" ]; then \
		echo "请在 Supabase SQL Editor 中执行以下脚本:"; \
		echo "1. deployment/database/init.sql"; \
		echo "2. deployment/database/functions.sql"; \
		echo "3. deployment/database/triggers.sql"; \
	else \
		./deployment/scripts/setup-database.sh --postgresql --demo-data; \
	fi

# 数据库备份
backup-db:
	@echo "💾 备份数据库..."
	@if [ -n "$(DATABASE_URL)" ]; then \
		pg_dump "$(DATABASE_URL)" > backup_$(shell date +%Y%m%d_%H%M%S).sql; \
		echo "✅ 备份完成"; \
	else \
		echo "❌ 请设置 DATABASE_URL 环境变量"; \
	fi
