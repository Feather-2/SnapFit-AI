import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './auth'

export interface AuthenticatedRequest extends NextRequest {
  userId?: string
}

export function withAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    try {
      // 从请求头获取 token
      const authHeader = request.headers.get('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: '未提供有效的认证令牌' },
          { status: 401 }
        )
      }

      const token = authHeader.substring(7) // 移除 "Bearer " 前缀
      
      // 验证 token
      const decoded = verifyToken(token)
      if (!decoded) {
        return NextResponse.json(
          { error: '认证令牌无效或已过期' },
          { status: 401 }
        )
      }

      // 将用户 ID 添加到请求对象
      const authenticatedRequest = request as AuthenticatedRequest
      authenticatedRequest.userId = decoded.userId

      // 调用原始处理函数
      return handler(authenticatedRequest)

    } catch (error) {
      console.error('Auth middleware error:', error)
      
      return NextResponse.json(
        { error: '认证失败' },
        { status: 500 }
      )
    }
  }
}
