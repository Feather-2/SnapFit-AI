#!/bin/bash

echo "🚀 安装共享Key功能依赖..."

# 检查是否有pnpm
if command -v pnpm &> /dev/null; then
    echo "✅ 使用 pnpm 安装依赖"
    pnpm add @supabase/supabase-js crypto-js
    pnpm add -D @types/crypto-js
elif command -v yarn &> /dev/null; then
    echo "✅ 使用 yarn 安装依赖"
    yarn add @supabase/supabase-js crypto-js
    yarn add -D @types/crypto-js
else
    echo "✅ 使用 npm 安装依赖"
    npm install @supabase/supabase-js crypto-js
    npm install -D @types/crypto-js
fi

echo "📋 依赖安装完成！"
echo ""
echo "📝 下一步："
echo "1. 复制 .env.example 到 .env.local 并填写配置"
echo "2. 在 Supabase 中创建数据库表（参考 SHARED_KEYS_SETUP.md）"
echo "3. 配置 Linux.do OAuth（如果需要）"
echo ""
echo "🎉 共享Key功能已准备就绪！"
