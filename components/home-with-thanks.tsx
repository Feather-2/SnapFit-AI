"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ThanksBoard } from "@/components/shared-keys/thanks-board"
import { KeyUploadForm } from "@/components/shared-keys/key-upload-form"
import { Heart, Plus, Gift } from "lucide-react"
import type { CurrentKeyInfo } from "@/lib/types"

interface HomeWithThanksProps {
  children: React.ReactNode
  currentKeyInfo?: CurrentKeyInfo
}

export function HomeWithThanks({ children, currentKeyInfo }: HomeWithThanksProps) {
  const [showKeyUpload, setShowKeyUpload] = useState(false)
  const [showThanksBoard, setShowThanksBoard] = useState(false)

  return (
    <div className="space-y-6">
      {/* 感谢信息栏 */}
      {currentKeyInfo && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium">
                    正在使用 {currentKeyInfo.contributorName} 分享的 {currentKeyInfo.modelName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    感谢社区贡献者让AI服务更便捷！
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Dialog open={showThanksBoard} onOpenChange={setShowThanksBoard}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Gift className="h-4 w-4 mr-2" />
                      感谢榜
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>API Key 贡献者感谢榜</DialogTitle>
                    </DialogHeader>
                    <ThanksBoard showCurrentKey={false} />
                  </DialogContent>
                </Dialog>
                
                <Dialog open={showKeyUpload} onOpenChange={setShowKeyUpload}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      分享Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>分享您的API Key</DialogTitle>
                    </DialogHeader>
                    <KeyUploadForm onSuccess={() => setShowKeyUpload(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 原有内容 */}
      {children}

      {/* 底部感谢信息 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-red-500" />
            社区共享
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">分享您的API Key</h4>
              <p className="text-sm text-muted-foreground mb-3">
                帮助其他用户体验AI功能，您的贡献将被记录在感谢榜中
              </p>
              <Dialog open={showKeyUpload} onOpenChange={setShowKeyUpload}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    立即分享
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>分享您的API Key</DialogTitle>
                  </DialogHeader>
                  <KeyUploadForm onSuccess={() => setShowKeyUpload(false)} />
                </DialogContent>
              </Dialog>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">查看贡献者</h4>
              <p className="text-sm text-muted-foreground mb-3">
                感谢这些用户的无私分享，让社区更加美好
              </p>
              <Dialog open={showThanksBoard} onOpenChange={setShowThanksBoard}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Gift className="h-4 w-4 mr-2" />
                    感谢榜
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>API Key 贡献者感谢榜</DialogTitle>
                  </DialogHeader>
                  <ThanksBoard showCurrentKey={false} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// 使用示例组件
export function ExampleUsage() {
  const [currentKeyInfo, setCurrentKeyInfo] = useState<CurrentKeyInfo | undefined>()

  // 模拟从API获取当前使用的Key信息
  useEffect(() => {
    // 这里应该从实际的API调用中获取
    setCurrentKeyInfo({
      contributorName: "张三",
      modelName: "GPT-4o",
      keyName: "我的OpenAI配置",
      source: "shared"
    })
  }, [])

  return (
    <HomeWithThanks currentKeyInfo={currentKeyInfo}>
      {/* 这里是原有的首页内容 */}
      <Card>
        <CardHeader>
          <CardTitle>健康管理</CardTitle>
        </CardHeader>
        <CardContent>
          <p>您的健康数据和AI建议将在这里显示...</p>
        </CardContent>
      </Card>
    </HomeWithThanks>
  )
}
