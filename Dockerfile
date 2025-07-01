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

# 修改next.config.mjs以启用standalone输出
RUN sed -i "s/const nextConfig = {/const nextConfig = {\n  output: 'standalone',/" next.config.mjs

# 构建应用
RUN corepack enable pnpm && pnpm build

# 生产阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# 禁用Next.js遥测（可选）
# ENV NEXT_TELEMETRY_DISABLED=1

# 创建非root用户运行应用
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 创建数据目录
RUN mkdir -p /app/data /app/logs /app/public/uploads
RUN chown -R nextjs:nodejs /app/data /app/logs /app/public/uploads

# 复制公共资源
COPY --from=builder /app/public ./public

# 利用输出跟踪自动减小镜像大小
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非root用户
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js由next build的standalone输出创建
CMD ["node", "server.js"] 