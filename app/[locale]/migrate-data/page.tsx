'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, Database, Upload, ArrowLeft, Loader2 } from 'lucide-react'

interface MigrationStep {
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  details?: any
}

export default function MigrateDataPage() {
  const [isDetecting, setIsDetecting] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationSteps, setMigrationSteps] = useState<MigrationStep[]>([])
  const [detectedData, setDetectedData] = useState<any>(null)
  const [migrationResult, setMigrationResult] = useState<any>(null)

  // 检测本地数据
  const detectLocalData = async () => {
    setIsDetecting(true)
    
    try {
      const data = {
        userProfile: null,
        aiConfig: null,
        dailyLogs: [],
        aiMemories: {} as Record<string, any>,
        indexedDBLogs: 0,
      }

      // 检测localStorage数据
      const userProfile = localStorage.getItem('userProfile')
      if (userProfile) {
        data.userProfile = JSON.parse(userProfile)
      }

      const aiConfig = localStorage.getItem('aiConfig')
      if (aiConfig) {
        data.aiConfig = JSON.parse(aiConfig)
      }

      // 检测IndexedDB健康日志
      const dbRequest = indexedDB.open('healthApp', 2)
      
      dbRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const transaction = db.transaction(['healthLogs'], 'readonly')
        const objectStore = transaction.objectStore('healthLogs')
        
        objectStore.getAll().onsuccess = (getAllEvent) => {
          const logs = (getAllEvent.target as IDBRequest).result
          data.dailyLogs = logs || []
          data.indexedDBLogs = logs?.length || 0
          
          // 检测AI记忆
          if (db.objectStoreNames.contains('aiMemories')) {
            const memoryTransaction = db.transaction(['aiMemories'], 'readonly')
            const memoryStore = memoryTransaction.objectStore('aiMemories')
            
            memoryStore.getAll().onsuccess = (memoryEvent) => {
              const memories = (memoryEvent.target as IDBRequest).result
              if (memories) {
                memories.forEach((memory: any, index: number) => {
                  data.aiMemories[`memory_${index}`] = memory
                })
              }
              
              setDetectedData(data)
              setIsDetecting(false)
            }
          } else {
            setDetectedData(data)
            setIsDetecting(false)
          }
        }
      }

      dbRequest.onerror = () => {
        setDetectedData(data)
        setIsDetecting(false)
      }
    } catch (error) {
      console.error('Error detecting local data:', error)
      setIsDetecting(false)
    }
  }

  // 执行数据迁移
  const startMigration = async () => {
    if (!detectedData) return

    setIsMigrating(true)
    setMigrationSteps([])

    const steps: MigrationStep[] = [
      { name: '准备迁移', status: 'pending' },
      { name: '迁移用户配置', status: 'pending' },
      { name: '迁移AI配置', status: 'pending' },
      { name: '迁移健康日志', status: 'pending' },
      { name: '迁移AI记忆', status: 'pending' },
      { name: '验证数据完整性', status: 'pending' },
    ]

    const updateStep = (index: number, status: MigrationStep['status'], message?: string, details?: any) => {
      steps[index] = { ...steps[index], status, message, details }
      setMigrationSteps([...steps])
    }

    try {
      // 步骤1: 准备迁移
      updateStep(0, 'running', '正在准备迁移...')
      await new Promise(resolve => setTimeout(resolve, 500))
      updateStep(0, 'success', '准备完成')

      // 调用迁移API
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'migrate_from_indexeddb',
          data: {
            userProfile: detectedData.userProfile,
            aiConfig: detectedData.aiConfig,
            dailyLogs: detectedData.dailyLogs,
            aiMemories: detectedData.aiMemories,
          },
          userEmail: `user_${Date.now()}@snapifit.local`,
          userName: '迁移用户',
        }),
      })

      const result = await response.json()
      setMigrationResult(result)

      if (result.success) {
        // 更新各个步骤的状态
        updateStep(1, result.migratedData.userProfile ? 'success' : 'error', 
          result.migratedData.userProfile ? '用户配置迁移成功' : '未检测到用户配置')

        updateStep(2, result.migratedData.aiConfig ? 'success' : 'error',
          result.migratedData.aiConfig ? 'AI配置迁移成功' : '未检测到AI配置')

        updateStep(3, result.migratedData.dailyLogs > 0 ? 'success' : 'error',
          result.migratedData.dailyLogs > 0 
            ? `成功迁移 ${result.migratedData.dailyLogs} 条日志记录` 
            : '未检测到日志记录')

        updateStep(4, result.migratedData.aiMemories > 0 ? 'success' : 'error',
          result.migratedData.aiMemories > 0 
            ? `成功迁移 ${result.migratedData.aiMemories} 条AI记忆` 
            : '未检测到AI记忆')

        updateStep(5, 'success', '数据验证完成')
      } else {
        // 迁移失败
        steps.forEach((_, index) => {
          if (index > 0) updateStep(index, 'error', '迁移失败')
        })
      }
    } catch (error: any) {
      console.error('Migration error:', error)
      steps.forEach((_, index) => {
        if (index > 0) updateStep(index, 'error', `迁移出错: ${error.message}`)
      })
    } finally {
      setIsMigrating(false)
    }
  }

  const getStatusIcon = (status: MigrationStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      default:
        return <div className="w-5 h-5 border-2 border-muted-foreground/30 rounded-full" />
    }
  }

  const getStatusBadge = (status: MigrationStep['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">成功</Badge>
      case 'error':
        return <Badge variant="destructive">失败</Badge>
      case 'running':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">运行中</Badge>
      default:
        return <Badge variant="outline" className="text-muted-foreground">等待中</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">数据迁移助手</h1>
            <p className="text-muted-foreground">将您的健康数据从浏览器本地存储迁移到服务端数据库</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 数据检测卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              本地数据检测
            </CardTitle>
            <CardDescription>
              检测浏览器中存储的健康数据
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={detectLocalData} 
              disabled={isDetecting}
              className="w-full"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  检测中...
                </>
              ) : (
                '开始检测本地数据'
              )}
            </Button>

            {detectedData && (
              <Card className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg">检测结果</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">用户配置:</span>
                      <Badge variant={detectedData.userProfile ? 'secondary' : 'outline'}>
                        {detectedData.userProfile ? '✅ 已找到' : '❌ 未找到'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">AI配置:</span>
                      <Badge variant={detectedData.aiConfig ? 'secondary' : 'outline'}>
                        {detectedData.aiConfig ? '✅ 已找到' : '❌ 未找到'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">健康日志:</span>
                      <Badge variant={detectedData.indexedDBLogs > 0 ? 'secondary' : 'outline'}>
                        {detectedData.indexedDBLogs > 0 ? `✅ ${detectedData.indexedDBLogs} 条记录` : '❌ 未找到'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">AI记忆:</span>
                      <Badge variant={Object.keys(detectedData.aiMemories).length > 0 ? 'secondary' : 'outline'}>
                        {Object.keys(detectedData.aiMemories).length > 0 ? `✅ ${Object.keys(detectedData.aiMemories).length} 条记忆` : '❌ 未找到'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* 迁移执行卡片 */}
        {detectedData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                执行数据迁移
              </CardTitle>
              <CardDescription>
                将检测到的数据迁移到服务端数据库
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={startMigration} 
                disabled={isMigrating || migrationResult?.success}
                className="w-full"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    迁移中...
                  </>
                ) : migrationResult?.success ? (
                  '迁移已完成'
                ) : (
                  '开始迁移数据'
                )}
              </Button>

              {migrationSteps.length > 0 && (
                <Card className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-lg">迁移进度</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {migrationSteps.map((step, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                          {getStatusIcon(step.status)}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{step.name}</span>
                              {getStatusBadge(step.status)}
                            </div>
                            {step.message && (
                              <p className="text-sm text-muted-foreground mt-1">{step.message}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {migrationResult && (
                <Alert className={migrationResult.success ? 'border-green-200 bg-green-50 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:bg-red-950/30'}>
                  <AlertDescription>
                    {migrationResult.success ? (
                      <div>
                        <div className="font-semibold text-green-800 dark:text-green-200 mb-2">🎉 迁移成功！</div>
                        <div className="text-green-700 dark:text-green-300 text-sm">
                          您的数据已成功迁移到服务端数据库。现在您可以在任何设备上访问您的健康数据了。
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ 迁移失败</div>
                        <div className="text-red-700 dark:text-red-300 text-sm">
                          迁移过程中出现错误。请检查网络连接后重试。
                        </div>
                        {migrationResult.errors && migrationResult.errors.length > 0 && (
                          <div className="mt-2">
                            <div className="font-medium">错误详情:</div>
                            <ul className="list-disc list-inside text-xs mt-1">
                              {migrationResult.errors.map((error: string, index: number) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* 注意事项 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              重要提示
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>迁移完成后，建议备份您的数据</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>迁移过程不会删除您的本地数据，您可以在确认迁移成功后手动清理</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>如果迁移失败，您的本地数据不会受到影响</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>迁移后，应用将自动使用服务端数据库</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 返回按钮 */}
        <div className="pt-6 border-t">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回上一页
          </Button>
        </div>
      </div>
    </div>
  )
} 