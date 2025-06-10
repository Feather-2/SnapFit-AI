@echo off
setlocal enabledelayedexpansion

REM SnapFit AI Docker 构建脚本 (Windows)
echo 🚀 开始构建 SnapFit AI Docker 镜像...

REM 配置
set IMAGE_NAME=snapfit-ai
set TAG=%1
if "%TAG%"=="" set TAG=latest
set FULL_IMAGE_NAME=%IMAGE_NAME%:%TAG%

echo 镜像名称: %FULL_IMAGE_NAME%

REM 检查 Docker 是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker 未运行，请先启动 Docker
    exit /b 1
)

REM 检查必要文件
if not exist "package.json" (
    echo ❌ 未找到 package.json，请在项目根目录运行此脚本
    exit /b 1
)

if not exist "Dockerfile" (
    echo ❌ 未找到 Dockerfile
    exit /b 1
)

REM 清理旧的构建缓存
echo 🧹 清理 Docker 构建缓存...
docker builder prune -f

REM 构建镜像
echo 🔨 构建 Docker 镜像...
docker build --tag "%FULL_IMAGE_NAME%" --build-arg NODE_ENV=production --progress=plain .

if errorlevel 1 (
    echo ❌ Docker 镜像构建失败
    exit /b 1
)

echo ✅ Docker 镜像构建成功！
echo 镜像名称: %FULL_IMAGE_NAME%

REM 显示镜像信息
echo 📊 镜像信息:
docker images %IMAGE_NAME% --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo 🎉 构建完成！
echo 运行命令:
echo   开发环境: docker-compose up
echo   生产环境: docker-compose -f docker-compose.prod.yml up
echo   直接运行: docker run -p 3000:3000 --env-file .env %FULL_IMAGE_NAME%

pause
