"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { TrustLevelBadge } from "@/components/user/user-badge"
import { AlertTriangle, ExternalLink, Shield } from "lucide-react"
import { useTranslation } from "@/hooks/use-i18n"

interface TrustLevelGuardProps {
  children: React.ReactNode
  requiredLevel?: number
  showCurrentLevel?: boolean
}

export function TrustLevelGuard({
  children,
  requiredLevel = 1,
  showCurrentLevel = true
}: TrustLevelGuardProps) {
  const { data: session, status } = useSession()
  const t = useTranslation('sharedKeys')

  // 加载中状态
  if (status === "loading") {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 未登录状态
  if (!session?.user) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">{t('trustLevel.loginRequired')}</h3>
          <p className="text-muted-foreground mb-6">
            {t('trustLevel.loginDescription')}
          </p>
          <Button asChild>
            <a href="/api/auth/signin">
              <ExternalLink className="w-4 h-4 mr-2" />
              {t('trustLevel.loginButton')}
            </a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // 获取用户信任等级
  const userTrustLevel = session.user?.trustLevel || 0

  // 检查权限
  const hasPermission = userTrustLevel >= requiredLevel && userTrustLevel <= 4

  if (!hasPermission) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <AlertTriangle className="h-16 w-16 mx-auto text-orange-500" />

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{t('trustLevel.insufficientTrust')}</h3>
              <p className="text-muted-foreground">
                {t('trustLevel.requiresLevel', { level: `${requiredLevel}-4` })}
              </p>
            </div>

            {showCurrentLevel && (
              <Alert className="max-w-md mx-auto">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{t('trustLevel.currentLevel', { level: userTrustLevel })}</span>
                  <TrustLevelBadge trustLevel={userTrustLevel} showLabel={true} />
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 max-w-md mx-auto text-sm text-muted-foreground">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">{t('trustLevel.howToImprove')}</h4>
                <ul className="space-y-1 text-left">
                  {[1, 2, 3].map((num) => (
                    <li key={num} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                      <span>{t(`trustLevel.improveTip${num}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Button asChild variant="outline">
              <a
                href="https://linux.do"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                {t('trustLevel.visitCommunity')}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 有权限，渲染子组件
  return <>{children}</>
}

// 简化版本，只检查是否有权限
export function useTrustLevelCheck() {
  const { data: session } = useSession()

  const userTrustLevel = session?.user?.trustLevel || 0
  const canUseSharedService = userTrustLevel >= 1 && userTrustLevel <= 4

  return {
    isLoggedIn: !!session?.user,
    trustLevel: userTrustLevel,
    canUseSharedService,
    canShareKeys: canUseSharedService,
    canManageKeys: canUseSharedService,
    isVipUser: userTrustLevel >= 3 && userTrustLevel <= 4
  }
}
