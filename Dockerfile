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

# 禁用Next.js遥测
ENV NEXT_TELEMETRY_DISABLED=1

# 生成 Prisma 客户端
RUN corepack enable pnpm && npx prisma generate

# 构建应用
RUN pnpm build

# 生产阶段 - 使用更小的基础镜像
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非root用户运行应用
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 只复制生产运行时必需的文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 复制 Prisma 相关文件（如果需要在运行时访问）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages

# 创建数据目录
RUN mkdir -p /app/data /app/logs /app/public/uploads
RUN chown -R nextjs:nodejs /app/data /app/logs /app/public/uploads

# 切换到非root用户
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 直接使用 Node.js 启动应用，不需要 pnpm
CMD ["node", "server.js"]