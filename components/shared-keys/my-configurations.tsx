"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { UserAvatar } from "@/components/user/user-avatar"
import {
  Settings, ChevronDown, ChevronUp, Activity, AlertCircle, CheckCircle,
  Clock, Trash2, Eye, EyeOff, Edit, MoreHorizontal, Calendar, BarChart3
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/hooks/use-i18n"

interface ModelHealth {
  model: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  lastChecked: string
  responseTime?: number
}

interface MySharedKey {
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
}

export function MyConfigurations() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const t = useTranslation('sharedKeys')
  const [myKeys, setMyKeys] = useState<MySharedKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (session?.user?.id) {
      fetchMyKeys()
    }
  }, [session])

  const fetchMyKeys = async () => {
    try {
      const response = await fetch('/api/shared-keys/my-configs')
      const data = await response.json()

      if (response.ok) {
        setMyKeys(data.keys || [])
      } else {
        toast({
          title: "加载失败",
          description: data.error || "无法加载我的配置",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "加载失败",
        description: "网络错误，请稍后重试",
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



  const handleToggleActive = async (keyId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/shared-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      })

      if (response.ok) {
        await fetchMyKeys()
        toast({
          title: "操作成功",
          description: `已${!isActive ? '启用' : '停用'}配置`
        })
      } else {
        throw new Error('操作失败')
      }
    } catch (error) {
      toast({
        title: "操作失败",
        description: "请稍后重试",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (keyId: string) => {
    if (!confirm('确定要删除这个配置吗？此操作不可撤销，所有相关的使用记录也会被清除。')) {
      return
    }

    try {
      const response = await fetch(`/api/shared-keys/${keyId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchMyKeys()
        toast({
          title: "删除成功",
          description: "配置已删除"
        })
      } else {
        throw new Error('删除失败')
      }
    } catch (error) {
      toast({
        title: "删除失败",
        description: "请稍后重试",
        variant: "destructive"
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (!session?.user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">{t('trustLevel.loginDescription')}</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            我的配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-muted rounded-lg" />
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
          <Settings className="h-5 w-5" />
          {t('myConfigs.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('myConfigs.description')}
        </p>
      </CardHeader>
      <CardContent>
        {myKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('myConfigs.noConfigs')}</p>
            <p className="text-sm">{t('myConfigs.shareFirst')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myKeys.map((key) => (
              <Card key={key.id} className={`border-l-4 ${key.isActive ? 'border-l-green-500' : 'border-l-gray-400'}`}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* 头部信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <UserAvatar
                          user={{
                            username: session.user.name || 'User',
                            displayName: session.user.displayName || session.user.name || 'User',
                            avatarUrl: session.user.image || '',
                            trustLevel: session.user.trustLevel
                          }}
                          size="md"
                          showTrustLevel={true}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm truncate">{key.name}</h3>
                            <Badge variant={key.isActive ? "default" : "secondary"} className="text-xs">
                              {key.isActive ? t('myConfigs.active') : t('myConfigs.inactive')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              {key.totalUsageCount} {t('myConfigs.totalUsage')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(key.createdAt)}
                            </span>
                          </div>
                          {key.description && (
                            <p className="text-xs text-muted-foreground">{key.description}</p>
                          )}
                        </div>
                      </div>

                      {/* 操作菜单 */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggleActive(key.id, key.isActive)}>
                            {key.isActive ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                停用配置
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                启用配置
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <Edit className="mr-2 h-4 w-4" />
                            编辑配置
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(key.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('myConfigs.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* 标签 */}
                    {key.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {key.tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="outline" className="text-xs">
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {key.dailyLimit === 999999 ? t('upload.unlimited') : `${key.dailyLimit}/${t('leaderboard.perDay')}`}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {t('myConfigs.todayUsage')} {key.usageCountToday}
                          </Badge>
                        </div>
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
