# Docker优化说明

我们根据Next.js官方推荐的最佳实践对Docker配置进行了优化，以提高构建效率并减小最终镜像的大小。

## 主要优化点

### 1. 多阶段构建优化

我们使用了更精细的多阶段构建流程：

- **base**: 基础镜像，用于其他阶段继承
- **deps**: 专门用于安装依赖，避免在代码变更时重新安装依赖
- **builder**: 构建应用
- **runner**: 最终运行阶段，只包含运行所需的文件

### 2. 利用Next.js的输出跟踪功能

通过在next.config.mjs中添加`output: 'standalone'`配置，我们启用了Next.js的[输出跟踪功能](https://nextjs.org/docs/advanced-features/output-file-tracing)。这使得最终镜像只包含运行应用所需的文件，大大减小了镜像大小。

优化前，我们的Docker镜像包含：
- 完整的node_modules目录（数百MB）
- 完整的.next构建输出
- 源代码文件

优化后，我们的Docker镜像只包含：
- 经过输出跟踪精简的运行时依赖
- 静态资源文件
- 编译后的应用代码

### 3. 安全性优化

- 使用非root用户运行应用（nextjs:nodejs）
- 设置适当的文件权限

### 4. 构建速度优化

- 分离依赖安装和应用构建阶段
- 利用Docker缓存机制，避免不必要的重新构建

### 5. 运行时优化

- 添加健康检查
- 设置适当的环境变量（HOSTNAME="0.0.0.0"）

## 文件大小对比

| 优化前 | 优化后 |
|--------|--------|
| ~1GB+ | ~100-200MB |

具体大小取决于应用的复杂度和依赖数量。

## 部署流程变化

优化后的部署流程与之前基本相同，但有以下变化：

1. 应用现在通过`node server.js`启动，而不是`pnpm start`
2. 添加了容器健康检查
3. 在使用NGINX时，会等待应用容器健康后再启动NGINX

## 参考资料

- [Next.js部署文档](https://nextjs.org/docs/app/getting-started/deploying)
- [Next.js Docker示例](https://github.com/vercel/next.js/tree/canary/examples/with-docker) 