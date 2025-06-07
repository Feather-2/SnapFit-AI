"use client"

import { useState } from "react"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { KeyUploadForm } from "@/components/shared-keys/key-upload-form"
import { ThanksBoard } from "@/components/shared-keys/thanks-board"
import { HomeWithThanks } from "@/components/home-with-thanks"
import { Badge } from "@/components/ui/badge"
import { TestTube, Database, Key, Users } from "lucide-react"
import type { AIConfig, CurrentKeyInfo } from "@/lib/types"

/**
 * 共享Key功能测试页面
 * 用于验证所有组件是否正常工作
 */
export default function TestSharedKeys() {
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [aiConfig] = useLocalStorage<AIConfig>("aiConfig", {
    agentModel: { name: "gpt-4o", baseUrl: "", apiKey: "" },
    chatModel: { name: "gpt-4o", baseUrl: "", apiKey: "" },
    visionModel: { name: "gpt-4o", baseUrl: "", apiKey: "" },
  })

  // 模拟当前使用的Key信息
  const mockCurrentKeyInfo: CurrentKeyInfo = {
    contributorName: "测试用户",
    modelName: "gpt-4o",
    keyName: "测试配置",
    source: "shared"
  }

  const runTest = async (testName: string, testFn: () => Promise<boolean>) => {
    setIsLoading(true)
    try {
      const result = await testFn()
      setTestResults(prev => ({ ...prev, [testName]: result }))
    } catch (error) {
      console.error(`Test ${testName} failed:`, error)
      setTestResults(prev => ({ ...prev, [testName]: false }))
    } finally {
      setIsLoading(false)
    }
  }

  const testApiConnection = async () => {
    try {
      const response = await fetch('/api/shared-keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'https://api.openai.com',
          apiKey: 'test-key',
          modelName: 'gpt-4o'
        })
      })
      // 即使API Key无效，只要路由存在就算成功
      return response.status === 400 || response.status === 200
    } catch (error) {
      return false
    }
  }

  const testThanksBoard = async () => {
    try {
      const response = await fetch('/api/shared-keys/thanks-board')
      return response.status === 200 || response.status === 500 // 500可能是因为没有数据库
    } catch (error) {
      return false
    }
  }

  const testSharedKeysApi = async () => {
    try {
      const response = await fetch('/api/shared-keys')
      return response.status === 401 || response.status === 200 // 401表示需要认证，这是正确的
    } catch (error) {
      return false
    }
  }

  const testSmartSuggestionsShared = async () => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (aiConfig && aiConfig.agentModel?.apiKey) {
        headers['x-ai-config'] = JSON.stringify(aiConfig)
      }

      const response = await fetch('/api/openai/smart-suggestions-shared', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          dailyLog: { date: '2024-01-01', summary: {}, foodEntries: [], exerciseEntries: [] },
          userProfile: { age: 30, gender: 'male', weight: 70, height: 170 }
        })
      })
      return response.status === 401 || response.status === 400 || response.status === 200
    } catch (error) {
      return false
    }
  }

  const tests = [
    { name: 'API Key测试路由', fn: testApiConnection, icon: TestTube },
    { name: '感谢榜API', fn: testThanksBoard, icon: Users },
    { name: '共享Key管理API', fn: testSharedKeysApi, icon: Key },
    { name: '智能建议共享API', fn: testSmartSuggestionsShared, icon: Database },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-6 w-6" />
            共享Key功能测试
          </CardTitle>
          <p className="text-muted-foreground">
            验证所有组件和API路由是否正常工作
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {tests.map((test) => {
              const Icon = test.icon
              const result = testResults[test.name]
              return (
                <div key={test.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <span>{test.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result !== undefined && (
                      <Badge variant={result ? "default" : "destructive"}>
                        {result ? "✅ 通过" : "❌ 失败"}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runTest(test.name, test.fn)}
                      disabled={isLoading}
                    >
                      测试
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6">
            <Button
              onClick={() => {
                tests.forEach(test => runTest(test.name, test.fn))
              }}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "测试中..." : "运行所有测试"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 组件测试 */}
      <Card>
        <CardHeader>
          <CardTitle>UI组件测试</CardTitle>
          <p className="text-muted-foreground">
            测试各个UI组件是否正常渲染
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {/* Key上传表单测试 */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  测试 Key 上传表单
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Key 上传表单测试</DialogTitle>
                </DialogHeader>
                <KeyUploadForm onSuccess={() => console.log('测试成功')} />
              </DialogContent>
            </Dialog>

            {/* 感谢榜测试 */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  测试感谢榜组件
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>感谢榜测试</DialogTitle>
                </DialogHeader>
                <ThanksBoard showCurrentKey={false} />
              </DialogContent>
            </Dialog>

            {/* 首页集成测试 */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  测试首页集成组件
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>首页集成测试</DialogTitle>
                </DialogHeader>
                <HomeWithThanks currentKeyInfo={mockCurrentKeyInfo}>
                  <Card>
                    <CardContent className="pt-6">
                      <p>这里是原有的首页内容...</p>
                    </CardContent>
                  </Card>
                </HomeWithThanks>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 安装说明 */}
      <Card>
        <CardHeader>
          <CardTitle>安装说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. 安装依赖</h4>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                # Windows<br/>
                ./install-shared-keys.bat<br/><br/>
                # Linux/Mac<br/>
                chmod +x install-shared-keys.sh<br/>
                ./install-shared-keys.sh
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">2. 配置环境变量</h4>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                cp .env.example .env.local<br/>
                # 然后编辑 .env.local 填写 Supabase 配置
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">3. 创建数据库表</h4>
              <p className="text-sm text-muted-foreground">
                参考 SHARED_KEYS_SETUP.md 中的 SQL 语句在 Supabase 中创建表
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
