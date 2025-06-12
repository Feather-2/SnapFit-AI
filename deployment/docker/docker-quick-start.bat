@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Snapifit AI Docker 快速启动
echo ========================================
echo.

REM 检查Docker是否运行
echo 🔍 检查 Docker 状态...
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)
echo ✅ Docker 运行正常

REM 检查必要文件
if not exist "package.json" (
    echo ❌ 未找到 package.json，请在项目根目录运行此脚本
    pause
    exit /b 1
)

if not exist ".env" (
    echo ⚠️  未找到 .env 文件
    echo 📝 正在从 .env.example 创建 .env 文件...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ✅ 已创建 .env 文件，请编辑其中的配置
        echo 📝 请先配置 .env 文件中的环境变量，然后重新运行此脚本
        pause
        exit /b 0
    ) else (
        echo ❌ 未找到 .env.example 文件
        pause
        exit /b 1
    )
)

echo.
echo 请选择操作:
echo 1. 构建并启动开发环境
echo 2. 构建并启动生产环境
echo 3. 仅构建 Docker 镜像
echo 4. 启动已有的开发环境
echo 5. 启动已有的生产环境
echo 6. 停止所有服务
echo 7. 查看服务状态
echo 8. 查看服务日志
echo 9. 清理 Docker 资源
echo 0. 退出
echo.

set /p choice="请输入选择 (0-9): "

if "%choice%"=="1" goto build_dev
if "%choice%"=="2" goto build_prod
if "%choice%"=="3" goto build_only
if "%choice%"=="4" goto start_dev
if "%choice%"=="5" goto start_prod
if "%choice%"=="6" goto stop_all
if "%choice%"=="7" goto status
if "%choice%"=="8" goto logs
if "%choice%"=="9" goto cleanup
if "%choice%"=="0" goto end
goto invalid_choice

:build_dev
echo.
echo 🔨 构建并启动开发环境...
docker-compose build
if errorlevel 1 goto build_error
docker-compose up -d
if errorlevel 1 goto start_error
goto success_dev

:build_prod
echo.
echo 🔨 构建并启动生产环境...
if not exist ".env.production" (
    echo ⚠️  未找到 .env.production 文件
    if exist ".env.production.example" (
        copy ".env.production.example" ".env.production" >nul
        echo ✅ 已创建 .env.production 文件，请编辑其中的配置
        pause
        exit /b 0
    )
)
docker-compose -f docker-compose.prod.yml build
if errorlevel 1 goto build_error
docker-compose -f docker-compose.prod.yml up -d
if errorlevel 1 goto start_error
goto success_prod

:build_only
echo.
echo 🔨 构建 Docker 镜像...
docker build -t snapfit-ai:latest .
if errorlevel 1 goto build_error
echo ✅ 镜像构建成功！
goto show_images

:start_dev
echo.
echo 🚀 启动开发环境...
docker-compose up -d
if errorlevel 1 goto start_error
goto success_dev

:start_prod
echo.
echo 🚀 启动生产环境...
docker-compose -f docker-compose.prod.yml up -d
if errorlevel 1 goto start_error
goto success_prod

:stop_all
echo.
echo 🛑 停止所有服务...
docker-compose down
docker-compose -f docker-compose.prod.yml down 2>nul
echo ✅ 所有服务已停止
goto end

:status
echo.
echo 📊 服务状态:
echo.
echo === 开发环境 ===
docker-compose ps
echo.
echo === 生产环境 ===
docker-compose -f docker-compose.prod.yml ps 2>nul
goto end

:logs
echo.
echo 📋 查看服务日志 (按 Ctrl+C 退出):
docker-compose logs -f
goto end

:cleanup
echo.
echo 🧹 清理 Docker 资源...
docker-compose down -v
docker-compose -f docker-compose.prod.yml down -v 2>nul
docker system prune -f
echo ✅ 清理完成
goto end

:success_dev
echo.
echo ✅ 开发环境启动成功！
echo 🌐 应用地址: http://localhost:3000
echo 🔍 健康检查: http://localhost:3000/api/health
goto wait_and_check

:success_prod
echo.
echo ✅ 生产环境启动成功！
echo 🌐 应用地址: http://localhost:3000
echo 🔍 健康检查: http://localhost:3000/api/health
goto wait_and_check

:wait_and_check
echo.
echo ⏳ 等待服务启动...
timeout /t 10 /nobreak >nul
echo 🔍 检查服务健康状态...
curl -f http://localhost:3000/api/health >nul 2>&1
if errorlevel 1 (
    echo ⚠️  服务可能还在启动中，请稍后访问
) else (
    echo ✅ 服务运行正常
)
goto show_commands

:show_images
echo.
echo 📊 Docker 镜像:
docker images snapfit-ai
goto end

:show_commands
echo.
echo 💡 常用命令:
echo   查看日志: docker-compose logs -f
echo   停止服务: docker-compose down
echo   重启服务: docker-compose restart
echo   查看状态: docker-compose ps
goto end

:build_error
echo ❌ 构建失败，请检查错误信息
goto end

:start_error
echo ❌ 启动失败，请检查错误信息
goto end

:invalid_choice
echo ❌ 无效选择，请重新运行脚本
goto end

:end
echo.
pause
