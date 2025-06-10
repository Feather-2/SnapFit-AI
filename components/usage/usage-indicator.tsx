"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useUsageLimit } from "@/hooks/use-usage-limit"
import { useTranslation } from "@/hooks/use-i18n"
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Calendar
} from "lucide-react"
import { getTrustLevelConfig } from "@/config/trust-level-limits"

interface UsageIndicatorProps {
  variant?: 'card' | 'compact' | 'inline'
  showStats?: boolean
  className?: string
}

export function UsageIndicator({
  variant = 'card',
  showStats = false,
  className = ''
}: UsageIndicatorProps) {
  const {
    usageInfo,
    limits,
    stats,
    loading,
    error,
    usagePercentage,
    timeUntilReset,
    fetchUsageStats
  } = useUsageLimit()
  const t = useTranslation('navigation.usage')

  const getStatusColor = () => {
    if (!usageInfo) return 'gray'
    if (usagePercentage >= 90) return 'red'
    if (usagePercentage >= 70) return 'yellow'
    return 'green'
  }

  const getStatusIcon = () => {
    if (!usageInfo) return <Clock className="h-4 w-4" />
    if (usagePercentage >= 90) return <AlertTriangle className="h-4 w-4" />
    return <CheckCircle className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (!usageInfo) return t('loading')
    if (usageInfo.remaining === 0) return t('quotaExhausted')
    if (usagePercentage >= 90) return t('quotaAlmostExhausted')
    if (usagePercentage >= 70) return t('quotaRunningLow')
    return t('quotaSufficient')
  }

  if (loading && !usageInfo) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">{t('loadingUsage')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {t('cannotLoadUsage')}: {error}
          <Button
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={() => fetchUsageStats()}
          >
            {t('retry')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!usageInfo || !limits) {
    return null
  }

  // 紧凑模式
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">
          {usageInfo.currentUsage}/{usageInfo.dailyLimit}
        </span>
        <Progress
          value={usagePercentage}
          className="w-16 h-2"
        />
      </div>
    )
  }

  // 内联模式
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <MessageSquare className="h-4 w-4" />
        <span>{t('todayConversation')}: {usageInfo.currentUsage}/{usageInfo.dailyLimit}</span>
        {usageInfo.remaining > 0 && (
          <Badge variant="outline" className="text-xs">
            {t('remaining')} {usageInfo.remaining} {t('times')}
          </Badge>
        )}
      </div>
    )
  }

  // 卡片模式
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-5 w-5" />
          {t('dailyQuota')}
          <Badge variant="outline" className="ml-auto">
            {limits.trustLevelName}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 使用进度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {getStatusIcon()}
              {getStatusText()}
            </span>
            <span className="font-medium">
              {usageInfo.currentUsage} / {usageInfo.dailyLimit}
            </span>
          </div>
          <Progress
            value={usagePercentage}
            className="h-2"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('usedPercentage')} {usagePercentage}%</span>
            {timeUntilReset && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeUntilReset}
              </span>
            )}
          </div>
        </div>

        {/* 剩余次数提示 */}
        {usageInfo.remaining > 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {t('canConverse')} <strong>{usageInfo.remaining}</strong> {t('conversationsLeft')}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('quotaExhaustedMessage')}
            </AlertDescription>
          </Alert>
        )}

        {/* 统计信息 */}
        {showStats && stats && (
          <div className="pt-3 border-t space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              {t('weeklyStats')}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">{t('totalConversations')}</div>
                <div className="font-medium">{stats.totalConversations} {t('times')}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('averageDaily')}</div>
                <div className="font-medium">{stats.averageDaily.conversations} {t('times')}</div>
              </div>
            </div>
          </div>
        )}

        {/* 等级提升提示 */}
        {limits.trustLevel < 4 && usagePercentage >= 80 && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div>{t('upgradePrompt')}</div>
                <div className="text-xs text-muted-foreground">
                  {t('nextLevelQuota')} {getTrustLevelConfig(limits.trustLevel + 1).limits.dailyConversations} {t('times')}/天
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

// 简化的使用量徽章
export function UsageBadge({
  className = '',
  showRefresh = false
}: {
  className?: string
  showRefresh?: boolean
}) {
  const { usageInfo, usagePercentage, loading, refreshUsageInfo, isInitialized } = useUsageLimit()
  const t = useTranslation('navigation.usage')

  const getVariant = () => {
    if (!usageInfo) return 'outline'
    if (usagePercentage >= 90) return 'destructive'
    if (usagePercentage >= 70) return 'secondary'
    return 'outline'
  }

  if (!isInitialized && loading) {
    return (
      <Badge variant="outline" className={className}>
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        {t('loading')}
      </Badge>
    )
  }

  if (!usageInfo) {
    return (
      <Badge variant="outline" className={className}>
        <MessageSquare className="h-3 w-3 mr-1" />
        --/--
      </Badge>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Badge variant={getVariant()} className={`${className} px-2 py-1`}>
        <MessageSquare className="h-3 w-3 mr-1" />
        <span className="font-mono text-xs">{usageInfo.currentUsage}/{usageInfo.dailyLimit}</span>
      </Badge>
      {showRefresh && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-muted/50"
          onClick={refreshUsageInfo}
          disabled={loading}
          title={t('refreshUsage')}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  )
}

// 使用量进度条
export function UsageProgress({
  className = '',
  showRefresh = false
}: {
  className?: string
  showRefresh?: boolean
}) {
  const { usageInfo, usagePercentage, loading, refreshUsageInfo, isInitialized, lastFetched } = useUsageLimit()
  const t = useTranslation('navigation.usage')

  if (!isInitialized && loading) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <span>{t('dailyQuota')}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>{t('loading')}</span>
          </span>
        </div>
        <Progress value={0} className="h-1.5" />
      </div>
    )
  }

  if (!usageInfo) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <span>{t('dailyQuota')}</span>
          <span className="font-mono text-muted-foreground">--/--</span>
        </div>
        <Progress value={0} className="h-1.5" />
      </div>
    )
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span>{t('dailyQuota')}</span>
        <span className="flex items-center gap-1">
          <span className="font-medium font-mono">{usageInfo.currentUsage}/{usageInfo.dailyLimit}</span>
          {showRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-3 w-3 p-0 hover:bg-muted/30 opacity-60 hover:opacity-100 transition-opacity"
              onClick={refreshUsageInfo}
              disabled={loading}
              title={t('refreshUsage')}
            >
              <RefreshCw className={`h-2 w-2 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </span>
      </div>
      <Progress value={usagePercentage} className="h-1.5" />
      {lastFetched && (
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>{t('updatedAt')} {lastFetched.toLocaleTimeString()}</span>
          {usageInfo.remaining > 0 && (
            <span className="text-green-600 font-medium">{t('remaining')} {usageInfo.remaining} {t('times')}</span>
          )}
        </div>
      )}
    </div>
  )
}
