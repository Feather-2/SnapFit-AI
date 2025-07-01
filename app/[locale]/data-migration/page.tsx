"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useServerStorage } from '@/hooks/use-server-storage'
import { useToast } from '@/hooks/use-toast'
import {
  Upload,
  Download,
  Database,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw
} from 'lucide-react'

interface MigrationResult {
  userProfile: any
  dailyLogs: number
  foodEntries: number
  exerciseEntries: number
  aiMemories: number
  aiConfig: any
}

export default function DataMigrationPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importData, setImportData] = useState('')
  const [exportData, setExportData] = useState('')
  const [progress, setProgress] = useState(0)

  const { saveData, getData } = useServerStorage()
  const { toast } = useToast()
  const router = useRouter()

  // 从 IndexedDB 迁移数据
  const migrateFromIndexedDB = async () => {
    setIsLoading(true)
    setError(null)
    setProgress(0)

    try {
      // 读取 IndexedDB 数据
      setProgress(20)
      const indexedDBData = await readIndexedDBData()

      if (!indexedDBData || Object.keys(indexedDBData).length === 0) {
        throw new Error('未找到 IndexedDB 数据')
      }

      setProgress(50)

      // 发送到服务器
      const response = await saveData('/api/db/migrate-indexeddb', {
        indexedDBData
      })

      setProgress(100)
      setMigrationResult(response.results)

      toast({
        title: "迁移成功",
        description: "IndexedDB 数据已成功迁移到服务端",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '迁移失败'
      setError(errorMessage)
      toast({
        title: "迁移失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setProgress(0)
    }
  }

  // 读取 IndexedDB 数据
  const readIndexedDBData = async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('healthApp', 2)

      request.onerror = () => reject(new Error('无法打开 IndexedDB'))

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const data: any = {}
        let completedStores = 0
        const totalStores = 2 // healthLogs, aiMemories

        // 读取健康日志
        const healthLogsTransaction = db.transaction(['healthLogs'], 'readonly')
        const healthLogsStore = healthLogsTransaction.objectStore('healthLogs')
        const healthLogsRequest = healthLogsStore.getAll()

        healthLogsRequest.onsuccess = () => {
          const logs = healthLogsRequest.result
          if (logs && logs.length > 0) {
            data.healthLogs = {}
            logs.forEach((log, index) => {
              const key = log.date || `log_${index}`
              data.healthLogs[key] = log
            })
          }

          completedStores++
          if (completedStores === totalStores) {
            resolve(data)
          }
        }

        // 读取 AI 记忆
        const aiMemoriesTransaction = db.transaction(['aiMemories'], 'readonly')
        const aiMemoriesStore = aiMemoriesTransaction.objectStore('aiMemories')
        const aiMemoriesRequest = aiMemoriesStore.getAll()

        aiMemoriesRequest.onsuccess = () => {
          const memories = aiMemoriesRequest.result
          if (memories && memories.length > 0) {
            data.aiMemories = {}
            memories.forEach((memory, index) => {
              const key = memory.expertId || `memory_${index}`
              data.aiMemories[key] = memory
            })
          }

          completedStores++
          if (completedStores === totalStores) {
            resolve(data)
          }
        }

        // 读取用户配置和 AI 配置（从 localStorage）
        try {
          const userProfile = localStorage.getItem('userProfile')
          if (userProfile) {
            data.userProfile = JSON.parse(userProfile)
          }

          const aiConfig = localStorage.getItem('aiConfig')
          if (aiConfig) {
            data.aiConfig = JSON.parse(aiConfig)
          }
        } catch (e) {
          console.warn('读取 localStorage 数据失败:', e)
        }
      }
    })
  }

  // 导出数据
  const exportUserData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await getData('/api/db/export')
      const dataStr = JSON.stringify(response, null, 2)
      setExportData(dataStr)

      // 自动下载文件
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `snapifit-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "导出成功",
        description: "数据已导出并下载",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导出失败'
      setError(errorMessage)
      toast({
        title: "导出失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 导入数据
  const importUserData = async () => {
    if (!importData.trim()) {
      setError('请输入要导入的数据')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = JSON.parse(importData)
      const response = await saveData('/api/db/import', data)

      setMigrationResult(response.results)

      toast({
        title: "导入成功",
        description: "数据已成功导入",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导入失败'
      setError(errorMessage)
      toast({
        title: "导入失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 处理文件上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setImportData(content)
      }
      reader.readAsText(file)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen relative bg-white dark:bg-slate-900 py-8">
        {/* 弥散绿色背景效果 - 带动画 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -left-40 top-20 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -right-40 top-40 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl animate-bounce-slow"></div>
          <div className="absolute left-20 bottom-20 w-72 h-72 bg-emerald-200/25 rounded-full blur-3xl animate-breathing"></div>
          <div className="absolute right-32 bottom-40 w-64 h-64 bg-emerald-300/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute left-1/2 top-1/3 w-56 h-56 bg-emerald-200/15 rounded-full blur-3xl transform -translate-x-1/2 animate-glow"></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">数据管理</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              管理您的健康数据，包括迁移、导入和导出功能
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && progress > 0 && (
            <Card className="mb-6 bg-slate-800/90 dark:bg-slate-800/90 border-slate-700/50 backdrop-blur-xl">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>迁移进度</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {migrationResult && (
            <Card className="mb-6 bg-slate-800/90 dark:bg-slate-800/90 border-slate-700/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mr-2" />
                  操作完成
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-slate-300">
                    <span className="font-medium">用户配置:</span>
                    <span className="ml-2 text-green-400">{migrationResult.userProfile ? '✓' : '✗'}</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="font-medium">每日日志:</span>
                    <span className="ml-2 text-green-400">{migrationResult.dailyLogs}</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="font-medium">食物记录:</span>
                    <span className="ml-2 text-green-400">{migrationResult.foodEntries}</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="font-medium">运动记录:</span>
                    <span className="ml-2 text-green-400">{migrationResult.exerciseEntries}</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="font-medium">AI记忆:</span>
                    <span className="ml-2 text-green-400">{migrationResult.aiMemories}</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="font-medium">AI配置:</span>
                    <span className="ml-2 text-green-400">{migrationResult.aiConfig ? '✓' : '✗'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="migrate" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border-slate-700">
              <TabsTrigger value="migrate" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-300">数据迁移</TabsTrigger>
              <TabsTrigger value="export" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-300">导出数据</TabsTrigger>
              <TabsTrigger value="import" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-300">导入数据</TabsTrigger>
            </TabsList>

            <TabsContent value="migrate">
              <Card className="bg-slate-800/90 dark:bg-slate-800/90 border-slate-700/50 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Database className="h-5 w-5 mr-2 text-green-400" />
                    从浏览器迁移数据
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    将您存储在浏览器 IndexedDB 中的数据迁移到服务端
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600/50">
                    <h4 className="font-medium text-slate-200 mb-2">迁移说明</h4>
                    <ul className="text-sm text-slate-300 space-y-1">
                      <li>• 此操作会将您的浏览器本地数据迁移到服务端</li>
                      <li>• 迁移后，您的数据将在所有设备上同步</li>
                      <li>• 原有的浏览器数据不会被删除</li>
                      <li>• 如果服务端已有数据，将会被覆盖</li>
                    </ul>
                  </div>

                  <Button
                    onClick={migrateFromIndexedDB}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium py-2.5 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg shadow-green-500/25"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    开始迁移
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export">
              <Card className="bg-slate-800/90 dark:bg-slate-800/90 border-slate-700/50 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Download className="h-5 w-5 mr-2 text-green-400" />
                    导出数据
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    将您的所有数据导出为 JSON 文件
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={exportUserData}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium py-2.5 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg shadow-green-500/25"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    导出数据
                  </Button>

                  {exportData && (
                    <div className="space-y-2">
                      <Label className="text-slate-200">导出的数据预览</Label>
                      <Textarea
                        value={exportData.substring(0, 500) + '...'}
                        readOnly
                        className="h-32 bg-slate-700/50 border-slate-600 text-slate-300 placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="import">
              <Card className="bg-slate-800/90 dark:bg-slate-800/90 border-slate-700/50 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Upload className="h-5 w-5 mr-2 text-green-400" />
                    导入数据
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    从 JSON 文件导入数据到您的账户
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-upload" className="text-slate-200">选择文件</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="bg-slate-700/50 border-slate-600 text-white file:bg-green-600 file:text-white file:border-0 file:rounded-lg file:px-4 file:py-2 file:mr-4"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="import-data" className="text-slate-200">或粘贴 JSON 数据</Label>
                    <Textarea
                      id="import-data"
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      placeholder="粘贴您的 JSON 数据..."
                      className="h-32 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>

                  <div className="bg-amber-900/30 border border-amber-700/50 p-4 rounded-lg">
                    <h4 className="font-medium text-amber-300 mb-2">导入警告</h4>
                    <p className="text-sm text-amber-200">
                      导入数据将覆盖您当前的所有数据。请确保您已备份重要数据。
                    </p>
                  </div>

                  <Button
                    onClick={importUserData}
                    disabled={isLoading || !importData.trim()}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium py-2.5 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    导入数据
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/50 hover:text-white transition-colors"
            >
              返回首页
            </Button>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
