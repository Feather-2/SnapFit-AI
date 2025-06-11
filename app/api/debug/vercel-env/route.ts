import { NextRequest } from 'next/server'
import { VERCEL_CONFIG } from '@/lib/vercel-config'

export async function GET(request: NextRequest) {
  // 只在开发环境或预览环境允许访问
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return Response.json({ error: 'Not available in production' }, { status: 403 })
  }

  const envInfo = {
    // Vercel 相关环境变量
    vercel: {
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_REGION: process.env.VERCEL_REGION,
      VERCEL_PLAN: process.env.VERCEL_PLAN,
    },
    
    // Node.js 环境
    node: {
      NODE_ENV: process.env.NODE_ENV,
    },
    
    // 配置检测结果
    detection: {
      isVercel: VERCEL_CONFIG.isVercel,
      currentTimeout: VERCEL_CONFIG.getCurrentTimeout(),
      safeTimeout: VERCEL_CONFIG.getSafeTimeout(),
    },
    
    // 智能建议配置
    smartSuggestions: {
      singleRequestTimeout: VERCEL_CONFIG.smartSuggestions.getSingleRequestTimeout(),
      overallTimeout: VERCEL_CONFIG.smartSuggestions.getOverallTimeout(),
    },
    
    // 时间戳
    timestamp: new Date().toISOString(),
  }

  return Response.json(envInfo, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
