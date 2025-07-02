# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
# 添加libc6-compat以解决Alpine Linux中的兼容性问题
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 根据锁文件安装依赖
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 禁用Next.js遥测（可选）
# ENV NEXT_TELEMETRY_DISABLED=1

# 生成 Prisma 客户端
RUN corepack enable pnpm && npx prisma generate

# 构建应用
RUN pnpm build

# 生产阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# 禁用Next.js遥测（可选）
# ENV NEXT_TELEMETRY_DISABLED=1

# 创建非root用户运行应用
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 安装 pnpm（运行时需要）
RUN corepack enable pnpm

# 复制其他必要文件（在切换用户之前）
COPY ./prisma ./prisma
COPY ./messages ./messages
COPY ./i18n.ts ./i18n.ts
COPY ./middleware.ts ./middleware.ts

# 复制依赖和构建输出
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs

# 创建数据目录
RUN mkdir -p /app/data /app/logs /app/public/uploads
RUN chown -R nextjs:nodejs /app/data /app/logs /app/public/uploads

# 确保 prisma 目录权限正确
RUN chown -R nextjs:nodejs ./prisma ./messages ./i18n.ts ./middleware.ts

# 切换到非root用户
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用 next start 启动应用
CMD ["pnpm", "start"]