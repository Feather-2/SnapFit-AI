"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Heart, Trophy, Users, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/hooks/use-i18n"

interface Contributor {
  userId: string
  username: string
  avatarUrl?: string
  totalContributions: number
  dailyLimit: number
  isActive: boolean
}

interface CurrentKeyInfo {
  contributorName: string
  contributorAvatar?: string
  modelName: string
  keyName: string
}

export function ThanksBoard({
  currentKeyInfo,
  showCurrentKey = true
}: {
  currentKeyInfo?: CurrentKeyInfo
  showCurrentKey?: boolean
}) {
  const { toast } = useToast()
  const t = useTranslation('sharedKeys')
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    fetchContributors()
  }, [])

  const fetchContributors = async () => {
    try {
      const response = await fetch('/api/shared-keys/thanks-board')
      const data = await response.json()

      if (response.ok) {
        setContributors(data.contributors || [])
      } else {
        toast({
          title: t('thanksBoard.loadFailed'),
          description: data.error || t('thanksBoard.loadFailedDesc'),
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: t('thanksBoard.loadFailed'),
        description: t('thanksBoard.networkError'),
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 1:
        return <Trophy className="h-5 w-5 text-gray-400" />
      case 2:
        return <Trophy className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
    }
  }

  const getRankBadgeVariant = (index: number) => {
    switch (index) {
      case 0:
        return "default" // 金色
      case 1:
        return "secondary" // 银色
      case 2:
        return "outline" // 铜色
      default:
        return "outline"
    }
  }

  if (showCurrentKey && currentKeyInfo) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Zap className="h-4 w-4" />
        <span>{t('thanksBoard.currentlyUsing')}</span>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="link" className="h-auto p-0 text-sm">
              {t('thanksBoard.contributorSharing', {
                contributor: currentKeyInfo.contributorName,
                model: currentKeyInfo.modelName
              })}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                {t('thanksBoard.title')}
              </DialogTitle>
            </DialogHeader>
            <ThanksBoard showCurrentKey={false} />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 当前使用的Key信息 */}
      {currentKeyInfo && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentKeyInfo.contributorAvatar} />
                <AvatarFallback>
                  {currentKeyInfo.contributorName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{t('thanksBoard.currentlyUsing')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('thanksBoard.contributorSharing', {
                    contributor: currentKeyInfo.contributorName,
                    model: currentKeyInfo.keyName
                  })}
                </p>
              </div>
              <Heart className="h-5 w-5 text-red-500 ml-auto" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 贡献者排行榜 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            API Key 贡献排行榜
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            感谢这些用户分享API Key，让社区更美好！
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 bg-muted rounded-full" />
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1">
                    <div className="w-24 h-4 bg-muted rounded mb-1" />
                    <div className="w-16 h-3 bg-muted rounded" />
                  </div>
                  <div className="w-16 h-6 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : contributors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>还没有贡献者</p>
              <p className="text-sm">成为第一个分享API Key的用户吧！</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contributors.map((contributor, index) => (
                <div
                  key={`${contributor.userId}-${index}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* 排名 */}
                  <div className="w-8 flex justify-center">
                    {getRankIcon(index)}
                  </div>

                  {/* 头像 */}
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={contributor.avatarUrl} />
                    <AvatarFallback>
                      {contributor.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* 用户信息 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contributor.username}</span>
                      {index < 3 && (
                        <Badge variant={getRankBadgeVariant(index)} className="text-xs">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                        </Badge>
                      )}
                      {!contributor.isActive && (
                        <Badge variant="outline" className="text-xs">
                          {t('leaderboard.inactive')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      贡献了 {contributor.totalContributions} {t('thanksBoard.totalCalls')}
                    </p>
                  </div>

                  {/* 每日限制 */}
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {contributor.dailyLimit}/{t('leaderboard.perDay')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 统计信息 */}
      {contributors.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {contributors.length}
                </p>
                <p className="text-sm text-muted-foreground">贡献者</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  {contributors.reduce((sum, c) => sum + c.totalContributions, 0)}
                </p>
                <p className="text-sm text-muted-foreground">总调用次数</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  {contributors.filter(c => c.isActive).length}
                </p>
                <p className="text-sm text-muted-foreground">活跃Key</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
