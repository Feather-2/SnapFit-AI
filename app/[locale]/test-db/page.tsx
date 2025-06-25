'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Database, ArrowLeft, ExternalLink } from 'lucide-react'

export default function TestDBPage() {
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runDatabaseTest = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/test-db')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Test failed')
      }
      
      setTestResults(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runDatabaseTest()
  }, [])

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">数据库功能测试</h1>
            <p className="text-muted-foreground">检验SQLite + Prisma数据库配置状态</p>
          </div>
        </div>
        
        <Button 
          onClick={runDatabaseTest} 
          disabled={loading}
          className="mb-6"
        >
          {loading ? '测试中...' : '重新运行测试'}
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>错误：</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      {/* 测试结果 */}
      {testResults && (
        <div className="space-y-6">
          {/* 测试总览卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                测试总览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">状态</p>
                  <Badge variant={testResults.status === 'success' ? 'default' : 'destructive'}>
                    {testResults.status === 'success' ? '通过' : '失败'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">测试时间</p>
                  <p className="font-medium">{new Date(testResults.timestamp).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总测试数</p>
                  <p className="font-medium">{testResults.tests?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 详细测试结果 */}
          <Card>
            <CardHeader>
              <CardTitle>测试结果详情</CardTitle>
              <CardDescription>每个数据库功能模块的测试状态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.tests?.map((test: any, index: number) => (
                  <Card key={index} className={`border-l-4 ${
                    test.status === 'success' 
                      ? 'border-l-green-500' 
                      : 'border-l-red-500'
                  }`}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">{test.name}</h3>
                        <div className="flex items-center gap-2">
                          {test.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Badge variant={test.status === 'success' ? 'secondary' : 'destructive'}>
                            {test.status === 'success' ? '成功' : '失败'}
                          </Badge>
                        </div>
                      </div>
                      
                      {test.result && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-2">测试结果:</p>
                          <div className="bg-muted p-3 rounded-md">
                            <pre className="text-xs overflow-auto">
                              {JSON.stringify(test.result, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {test.error && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertDescription>
                            <strong>错误详情:</strong> {test.error}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 成功状态总结 */}
          {testResults.status === 'success' && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div>
                  <h3 className="font-bold text-green-800 dark:text-green-200 mb-2">🎉 所有测试通过！</h3>
                  <p className="text-green-700 dark:text-green-300 mb-3">
                    SQLite + Prisma 数据库配置正常，可以开始使用了。
                  </p>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>• 用户创建和管理 ✅</li>
                    <li>• AI配置存储 ✅</li>
                    <li>• 日志记录系统 ✅</li>
                    <li>• 食物和运动记录 ✅</li>
                    <li>• AI记忆功能 ✅</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 下一步操作指南 */}
          <Card>
            <CardHeader>
              <CardTitle>下一步操作</CardTitle>
              <CardDescription>完成测试后的建议操作</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
              
                <div className="flex items-center gap-2 text-sm">
                  <Database className="h-4 w-4" />
                  <span>运行 <code className="bg-muted px-2 py-1 rounded text-xs">pnpm db:studio</code> 打开Prisma Studio查看数据库</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span>开始集成到现有的应用组件中</span>
                </div>
                <div className="pt-2">
                  <Button variant="outline" asChild>
                    <a href="migrate-data">
                      开始数据迁移（从IndexedDB到SQLite）
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 返回按钮 */}
      <div className="mt-8 pt-6 border-t">
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回上一页
        </Button>
      </div>
    </div>
  )
} 