import { NextRequest } from 'next/server'

// 超时配置常量
const TIMEOUT_CONFIG = {
  CONNECTION_TEST: 15000,    // 连接测试：15秒
  DIAGNOSTIC: 10000          // 诊断测试：10秒
} as const

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, apiKey, testType = 'basic' } = await req.json()

    if (!baseUrl) {
      return Response.json({ error: "Base URL is required" }, { status: 400 })
    }

    const results = {
      baseUrl,
      timestamp: new Date().toISOString(),
      tests: {} as Record<string, any>
    }

    // 1. 基础连接测试
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_CONFIG.DIAGNOSTIC)

      const testUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
      const pingUrl = testUrl.includes('/v1') ? testUrl : `${testUrl}/v1/models`



      const response = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'HealthApp-Diagnostic/1.0',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      results.tests.connection = {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseTime: Date.now()
      }

      // 如果有API Key，尝试解析响应
      if (apiKey && response.ok) {
        try {
          const data = await response.json()
          results.tests.apiResponse = {
            success: true,
            hasData: !!data,
            dataType: typeof data,
            modelCount: data?.data?.length || 0
          }
        } catch (parseError) {
          results.tests.apiResponse = {
            success: false,
            error: 'Failed to parse JSON response',
            details: parseError instanceof Error ? parseError.message : String(parseError)
          }
        }
      }

    } catch (error) {
      results.tests.connection = {
        success: false,
        error: error instanceof Error ? error.name : 'Unknown error',
        message: error instanceof Error ? error.message : String(error),
        details: getErrorDetails(error)
      }
    }

    // 2. DNS解析测试
    try {
      const url = new URL(baseUrl)
      results.tests.dns = {
        hostname: url.hostname,
        protocol: url.protocol,
        port: url.port || (url.protocol === 'https:' ? '443' : '80'),
        success: true
      }
    } catch (error) {
      results.tests.dns = {
        success: false,
        error: 'Invalid URL format',
        message: error instanceof Error ? error.message : String(error)
      }
    }

    // 3. 网络环境检测
    results.tests.environment = {
      userAgent: req.headers.get('user-agent'),
      acceptLanguage: req.headers.get('accept-language'),
      serverTime: new Date().toISOString(),
      nodeVersion: process.version
    }

    return Response.json(results)

  } catch (error) {
    return Response.json({
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

function getErrorDetails(error: unknown): Record<string, any> {
  if (error instanceof Error) {
    const details: Record<string, any> = {
      name: error.name,
      message: error.message
    }

    // 检查常见的网络错误
    if (error.message.includes('ENOTFOUND')) {
      details.type = 'DNS_RESOLUTION_FAILED'
      details.suggestion = '域名解析失败，请检查网络连接或域名是否正确'
    } else if (error.message.includes('ECONNREFUSED')) {
      details.type = 'CONNECTION_REFUSED'
      details.suggestion = '连接被拒绝，请检查服务器是否运行或防火墙设置'
    } else if (error.message.includes('ETIMEDOUT') || error.name === 'AbortError') {
      details.type = 'TIMEOUT'
      details.suggestion = '连接超时，请检查网络速度或服务器响应时间'
    } else if (error.message.includes('CERT') || error.message.includes('certificate')) {
      details.type = 'SSL_CERTIFICATE_ERROR'
      details.suggestion = 'SSL证书错误，请检查证书是否有效'
    } else if (error.message.includes('401')) {
      details.type = 'AUTHENTICATION_ERROR'
      details.suggestion = 'API Key无效或已过期'
    } else if (error.message.includes('403')) {
      details.type = 'PERMISSION_ERROR'
      details.suggestion = 'API Key权限不足'
    } else if (error.message.includes('429')) {
      details.type = 'RATE_LIMIT_ERROR'
      details.suggestion = 'API调用频率超限，请稍后重试'
    }

    return details
  }

  return { message: String(error) }
}
