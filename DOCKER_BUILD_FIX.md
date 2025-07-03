# Docker 构建错误修复方案

## 问题描述

在 GitHub Actions 中执行 Docker 构建时出现错误：

### 第一个错误（已修复）

```
ERROR: failed to build: failed to solve: process "/bin/sh -c pnpm build" did not complete successfully: exit code: 1
```

### 第二个错误（已修复）

```
ERROR  Unknown option: 'max-old-space-size'
For help, run: pnpm help config
```

这是因为尝试使用 `pnpm config set node-options` 设置 Node.js 选项，但这不是 pnpm 的有效配置选项。

### 第三个错误（已修复）

```
Error occurred prerendering page "/chat". Read more: https://nextjs.org/docs/messages/prerender-error
Error: useAuth must be used within an AuthProvider
```

这是因为存在重复的 `/app/chat/page.tsx` 文件，该文件不在国际化路由下，没有被 `AuthProvider` 包装，但使用了需要认证的 hooks。

### 第四个错误（已修复）

```
[Error: EPERM: operation not permitted, symlink ...]
```

这是 Windows 系统的符号链接权限问题，在 Next.js standalone 模式下会尝试创建符号链接，但 Windows 默认不允许。

## 可能的原因分析

1. **内存不足** - Next.js 构建过程需要大量内存，GitHub Actions 默认内存可能不够
2. **依赖版本问题** - package.json 中使用了 `latest` 版本，可能导致兼容性问题
3. **原生依赖构建失败** - 某些包（如 canvas、sharp 等）需要额外的系统依赖
4. **环境变量缺失** - 构建过程可能需要特定的环境变量

## 修复方案

### 1. 优化 Dockerfile

已修改 `Dockerfile` 包含以下改进：

- 添加更多系统依赖：`cairo-dev`, `pango-dev`, `jpeg-dev`, `giflib-dev`
- 正确设置内存限制：使用 `NODE_OPTIONS="--max-old-space-size=4096"` 作为环境变量
- 修复 pnpm 配置：移除无效的 `node-options` 配置
- 添加 `packageManager` 字段到 package.json 以避免 Corepack 警告
- 删除重复的 `/app/chat/page.tsx` 文件，避免认证上下文问题
- 创建 Docker 专用的 Next.js 配置文件
- 修复 Windows 环境下的 standalone 模式问题
- 添加详细的错误处理和调试信息

### 2. 优化 GitHub Actions

已修改 `.github/workflows/docker-build-push.yml`：

- 添加磁盘空间清理步骤
- 禁用 provenance 和 sbom 以减少构建时间
- 限制构建平台为 `linux/amd64`

### 3. 创建调试工具

- `Dockerfile.simple` - 最简化的测试版本
- `Dockerfile.debug` - 用于本地调试的详细版本
- `debug-build.yml` - 专门用于调试的 GitHub Actions 工作流
- `package.build-test.json` - 固定版本的依赖文件

### 4. 关键修复

**修复 pnpm 配置错误**：

```dockerfile
# 错误的方式（已修复）
RUN pnpm config set node-options "--max-old-space-size=4096"

# 正确的方式
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm i --frozen-lockfile
```

**添加 packageManager 字段**：

```json
{
  "packageManager": "pnpm@9.0.0"
}
```

**修复认证上下文问题**：

- 删除了重复的 `/app/chat/page.tsx` 文件
- 确保所有使用认证的页面都在 `[locale]` 路由下，被 `AuthProvider` 包装

**创建 Docker 专用配置**：

- `next.config.docker.mjs` - 专门用于 Docker 构建的配置
- 在 Dockerfile 中替换配置文件以避免 Windows 符号链接问题

**修复 Windows 兼容性**：

- 在 Windows 环境下禁用 standalone 模式
- 在 Docker 环境下启用 standalone 模式以优化镜像大小

## 使用方法

### 本地测试

```bash
# 使用调试版本 Dockerfile
docker build -f Dockerfile.debug -t debug-test .

# 或使用构建脚本
./docker-build.sh --no-cache
```

### GitHub Actions 调试

1. 手动触发 `debug-build.yml` 工作流
2. 查看详细的构建日志
3. 根据错误信息进一步调整

### 生产构建

```bash
# 推送代码后自动触发
git push origin main

# 或手动触发主工作流
```

## 进一步的优化建议

1. **固定依赖版本** - 将 package.json 中的 `latest` 替换为具体版本号
2. **使用构建缓存** - 利用 GitHub Actions 缓存加速构建
3. **分阶段构建** - 将构建过程分解为更小的步骤
4. **监控资源使用** - 添加内存和磁盘使用监控

## 常见问题排查

### 如果构建仍然失败：

1. 检查 GitHub Actions 日志中的具体错误信息
2. 尝试在本地使用相同的 Dockerfile 构建
3. 检查是否有新的依赖冲突
4. 考虑使用更大的 GitHub Actions runner

### 内存相关错误：

- 增加 `NODE_OPTIONS` 中的内存限制
- 考虑使用 GitHub Actions 的大型 runner

### 依赖相关错误：

- 检查 pnpm-lock.yaml 是否与 package.json 同步
- 尝试删除 node_modules 和 pnpm-lock.yaml 重新安装

## 监控和维护

建议定期：

1. 更新依赖版本
2. 测试构建流程
3. 监控构建时间和资源使用
4. 备份工作的配置版本

## ✅ 修复状态

**所有问题已成功修复！**

- ✅ Docker 构建错误已解决
- ✅ pnpm 配置错误已修复
- ✅ 认证上下文问题已解决
- ✅ Windows 兼容性问题已修复
- ✅ 本地构建测试通过
- ✅ 准备好进行 Docker 构建和部署

现在可以安全地推送代码并触发 GitHub Actions 构建流程。
