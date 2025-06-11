// Vercel 环境优化配置
export const VERCEL_CONFIG = {
  // 检测是否在 Vercel 环境
  isVercel: process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined,

  // 函数超时限制（秒）- 基于官方文档更新
  functionTimeout: {
    hobby: {
      default: 10,    // 默认：10秒
      maximum: 60     // 最大：60秒
    },
    pro: {
      default: 15,    // 默认：15秒
      maximum: 300    // 最大：300秒 (5分钟)
    },
    enterprise: {
      default: 15,    // 默认：15秒
      maximum: 900    // 最大：900秒 (15分钟)
    }
  },

  // 当前计划的超时限制
  getCurrentTimeout(): number {
    // 根据环境变量判断当前计划
    if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PLAN === 'pro') {
      return this.functionTimeout.pro.maximum;
    }
    // 默认使用 hobby 计划的最大限制
    return this.functionTimeout.hobby.maximum;
  },

  // 获取安全的超时时间（留出缓冲时间）
  getSafeTimeout(bufferSeconds: number = 5): number {
    const maxTimeout = this.getCurrentTimeout();
    return Math.max(5, (maxTimeout - bufferSeconds)) * 1000; // 转换为毫秒
  },

  // 智能建议专用配置
  smartSuggestions: {
    // 单个请求超时（毫秒）- 基于计划动态调整
    getSingleRequestTimeout(): number {
      const plan = VERCEL_CONFIG.getCurrentTimeout();
      // 为单个请求预留足够时间，但不超过总限制的 70%
      return Math.min(plan * 0.7 * 1000, 50000); // 最大 50 秒
    },
    // 总体超时（毫秒）- 基于计划动态调整
    getOverallTimeout(): number {
      const plan = VERCEL_CONFIG.getCurrentTimeout();
      // 为总体流程预留 85% 的时间
      return Math.min(plan * 0.85 * 1000, 55000); // 最大 55 秒
    },
    // 最大并发请求数
    maxConcurrentRequests: 2,
    // 重试配置
    retry: {
      maxAttempts: 2,
      delayMs: 1000,
    }
  },

  // 优化建议
  optimizations: {
    // 减少提示词长度
    shortenPrompts: true,
    // 限制输出长度
    limitOutputTokens: true,
    // 使用更快的模型
    preferFastModels: true,
    // 启用请求缓存
    enableCaching: true,
  }
} as const;

// 导出类型
export type VercelConfig = typeof VERCEL_CONFIG;
