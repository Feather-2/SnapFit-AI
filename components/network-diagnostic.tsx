"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, AlertTriangle, Network, Zap } from 'lucide-react'

interface DiagnosticResult {
  baseUrl: string
  timestamp: string
  tests: {
    connection?: {
      success: boolean
      status?: number
      statusText?: string
      error?: string
      message?: string
      details?: any
    }
    apiResponse?: {
      success: boolean
      modelCount?: number
      error?: string
    }
    dns?: {
      hostname: string
      protocol: string
      port: string
      success: boolean
    }
    environment?: {
      userAgent: string
      serverTime: string
      nodeVersion: string
    }
  }
}

interface NetworkDiagnosticProps {
  baseUrl?: string
  apiKey?: string
  onClose?: () => void
}

export function NetworkDiagnostic({ baseUrl = '', apiKey = '', onClose }: NetworkDiagnosticProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runDiagnostic = async () => {
    if (!baseUrl) {
      setError('请提供 Base URL')
      return
    }

    setIsRunning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          baseUrl,
          apiKey: apiKey || undefined
        })
      })

      if (!response.ok) {
        throw new Error(`诊断请求失败: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '诊断失败')
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (success: boolean | undefined) => {
    if (success === undefined) return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    return success ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />
  }

  const getStatusBadge = (success: boolean | undefined) => {
    if (success === undefined) return <Badge variant="secondary">未知</Badge>
    return success ? <Badge variant="default" className="bg-green-500">成功</Badge> : <Badge variant="destructive">失败</Badge>
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          网络连接诊断
        </CardTitle>
        <CardDescription>
          检测 API 连接状态和网络环境，帮助诊断连接问题
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button 
            onClick={runDiagnostic} 
            disabled={isRunning || !baseUrl}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                诊断中...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                开始诊断
              </>
            )}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              关闭
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              诊断时间: {new Date(result.timestamp).toLocaleString()}
            </div>

            {/* 连接测试 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {getStatusIcon(result.tests.connection?.success)}
                  连接测试
                  {getStatusBadge(result.tests.connection?.success)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <strong>目标地址:</strong> {result.baseUrl}
                </div>
                {result.tests.connection?.success ? (
                  <div className="space-y-1 text-sm">
                    <div><strong>状态码:</strong> {result.tests.connection.status}</div>
                    <div><strong>状态:</strong> {result.tests.connection.statusText}</div>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <div className="text-red-600">
                      <strong>错误:</strong> {result.tests.connection?.error}
                    </div>
                    <div className="text-red-600">
                      <strong>详情:</strong> {result.tests.connection?.message}
                    </div>
                    {result.tests.connection?.details?.suggestion && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>建议:</strong> {result.tests.connection.details.suggestion}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API 响应测试 */}
            {result.tests.apiResponse && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {getStatusIcon(result.tests.apiResponse.success)}
                    API 响应测试
                    {getStatusBadge(result.tests.apiResponse.success)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {result.tests.apiResponse.success ? (
                    <div>
                      <strong>可用模型数量:</strong> {result.tests.apiResponse.modelCount || 0}
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <strong>错误:</strong> {result.tests.apiResponse.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* DNS 解析 */}
            {result.tests.dns && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {getStatusIcon(result.tests.dns.success)}
                    DNS 解析
                    {getStatusBadge(result.tests.dns.success)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><strong>主机名:</strong> {result.tests.dns.hostname}</div>
                  <div><strong>协议:</strong> {result.tests.dns.protocol}</div>
                  <div><strong>端口:</strong> {result.tests.dns.port}</div>
                </CardContent>
              </Card>
            )}

            {/* 环境信息 */}
            {result.tests.environment && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">环境信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><strong>服务器时间:</strong> {new Date(result.tests.environment.serverTime).toLocaleString()}</div>
                  <div><strong>Node.js 版本:</strong> {result.tests.environment.nodeVersion}</div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
