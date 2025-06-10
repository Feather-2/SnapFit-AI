"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { UserAvatar } from "@/components/user/user-avatar"
import {
  Trophy, ChevronDown, ChevronUp, Activity, AlertCircle, CheckCircle,
  Clock, Shield, Star, Crown
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/hooks/use-i18n"

interface ModelHealth {
  model: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  lastChecked: string
  responseTime?: number
}

interface SharedKey {
  id: string
  name: string
  baseUrl: string
  availableModels: string[]
  dailyLimit: number
  description: string
  tags: string[]
  isActive: boolean
  usageCountToday: number
  totalUsageCount: number
  createdAt: string
  modelHealth?: ModelHealth[]
  user: {
    id: string
    username: string
    displayName?: string
    avatarUrl?: string
    trustLevel?: number
  }
}

export function UsageLeaderboard() {
  const { toast } = useToast()
  const t = useTranslation('sharedKeys')
  const [sharedKeys, setSharedKeys] = useState<SharedKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchSharedKeys()
  }, [])

  const fetchSharedKeys = async () => {
    try {
      const response = await fetch('/api/shared-keys/leaderboard')
      const data = await response.json()

      if (response.ok) {
        setSharedKeys(data.keys || [])
      } else {
        toast({
          title: t('leaderboard.loading'),
          description: data.error || t('leaderboard.noData'),
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: t('leaderboard.loading'),
        description: t('thanksBoard.networkError'),
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpanded = (keyId: string) => {
    const newExpanded = new Set(expandedKeys)
    if (newExpanded.has(keyId)) {
      newExpanded.delete(keyId)
    } else {
      newExpanded.add(keyId)
    }
    setExpandedKeys(newExpanded)
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'unhealthy':
        return <AlertCircle className="w-3 h-3 text-red-500" />
      default:
        return <Clock className="w-3 h-3 text-gray-400" />
    }
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'unhealthy':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-4 w-4 text-yellow-500" />
      case 1:
        return <Trophy className="h-4 w-4 text-gray-400" />
      case 2:
        return <Trophy className="h-4 w-4 text-amber-600" />
      default:
        return <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
    }
  }

  const getTrustLevelBadge = (trustLevel?: number) => {
    if (!trustLevel || trustLevel < 1) return null

    switch (trustLevel) {
      case 1:
        return <Shield className="h-3 w-3 text-blue-500" title="信任用户" />
      case 2:
        return <Star className="h-3 w-3 text-purple-500" title="高级用户" />
      case 3:
      case 4:
        return <Crown className="h-3 w-3 text-yellow-500" title="VIP用户" />
      default:
        return <Shield className="h-3 w-3 text-gray-500" title={`信任等级 ${trustLevel}`} />
    }
  }



  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            使用排行榜
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t('leaderboard.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('leaderboard.description')}
        </p>
      </CardHeader>
      <CardContent>
        {sharedKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('leaderboard.noData')}</p>
            <p className="text-sm">{t('leaderboard.noDataDesc')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sharedKeys.map((key, index) => (
              <Card key={key.id} className="border-l-4 border-l-primary/20">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* 头部信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-6 flex justify-center mt-1">
                          {getRankIcon(index)}
                        </div>
                        <UserAvatar
                          user={{
                            username: key.user.username,
                            displayName: key.user.displayName,
                            avatarUrl: key.user.avatarUrl,
                            trustLevel: key.user.trustLevel
                          }}
                          size="md"
                          showTrustLevel={true}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm truncate">{key.name}</h3>
                            {!key.isActive && (
                              <Badge variant="outline" className="text-xs">{t('leaderboard.inactive')}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <span>by {key.user.displayName || key.user.username}</span>
                            {getTrustLevelBadge(key.user.trustLevel)}
                            <span>•</span>
                            <span>{key.totalUsageCount} {t('leaderboard.totalUsage')}</span>
                          </div>
                          {key.description && (
                            <p className="text-xs text-muted-foreground">{key.description}</p>
                          )}
                        </div>
                      </div>


                    </div>

                    {/* 标签 */}
                    {key.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {key.tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* 模型展示 */}
                    <Collapsible>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1 flex-wrap">
                          {key.availableModels.slice(0, 3).map((model, modelIndex) => {
                            const health = key.modelHealth?.find(h => h.model === model)
                            return (
                              <Badge
                                key={modelIndex}
                                variant="outline"
                                className={`text-xs ${health ? getHealthColor(health.status) : ''}`}
                              >
                                <span className="flex items-center gap-1">
                                  {health && getHealthIcon(health.status)}
                                  {model.length > 20 ? `${model.substring(0, 20)}...` : model}
                                </span>
                              </Badge>
                            )
                          })}
                          {key.availableModels.length > 3 && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                +{key.availableModels.length - 3}
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {key.dailyLimit === 999999 ? t('upload.unlimited') : `${key.dailyLimit}/${t('leaderboard.perDay')}`}
                        </Badge>
                      </div>

                      <CollapsibleContent className="mt-2">
                        <div className="flex gap-1 flex-wrap">
                          {key.availableModels.slice(3).map((model, modelIndex) => {
                            const health = key.modelHealth?.find(h => h.model === model)
                            return (
                              <Badge
                                key={modelIndex}
                                variant="outline"
                                className={`text-xs ${health ? getHealthColor(health.status) : ''}`}
                              >
                                <span className="flex items-center gap-1">
                                  {health && getHealthIcon(health.status)}
                                  {model}
                                </span>
                              </Badge>
                            )
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
