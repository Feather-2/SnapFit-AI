"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 如果正在加载，不做任何操作
    if (isLoading) return

    // 检查是否在认证页面
    const isAuthPage = pathname.includes('/auth/')

    // 如果未认证且不在认证页面，重定向到登录页
    if (!isAuthenticated && !isAuthPage) {
      router.push('/auth/login')
      return
    }

    // 如果已认证且在认证页面，重定向到首页
    if (isAuthenticated && isAuthPage) {
      router.push('/')
      return
    }
  }, [isAuthenticated, isLoading, pathname, router])

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">正在加载...</p>
        </div>
      </div>
    )
  }

  // 如果未认证且不在认证页面，不渲染内容（等待重定向）
  const isAuthPage = pathname.includes('/auth/')
  if (!isAuthenticated && !isAuthPage) {
    return null
  }

  // 如果已认证且在认证页面，不渲染内容（等待重定向）
  if (isAuthenticated && isAuthPage) {
    return null
  }

  return <>{children}</>
}
