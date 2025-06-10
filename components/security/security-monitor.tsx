"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Clock, 
  RefreshCw,
  Eye,
  Ban
} from "lucide-react"

interface SecurityEvent {
  id: string
  eventType: string
  severity: number
  details: {
    trustLevel?: number
    attemptedUsage?: number
    dailyLimit?: number
    excessAttempts?: number
  }
  createdAt: string
}

interface SecurityStats {
  totalViolations: number
  violationsToday: number
  highSeverityEvents: number
  recentEvents: SecurityEvent[]
}

export function SecurityMonitor() {
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSecurityStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/security/stats')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch security stats')
      }

      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSecurityStats()
    
    // 每30秒刷新一次
    const interval = setInterval(fetchSecurityStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 1: return 'bg-blue-100 text-blue-800'
      case 2: return 'bg-yellow-100 text-yellow-800'
      case 3: return 'bg-orange-100 text-orange-800'
      case 4: return 'bg-red-100 text-red-800'
      case 5: return 'bg-red-200 text-red-900'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityText = (severity: number) => {
    switch (severity) {
      case 1: return '信息'
      case 2: return '低危'
      case 3: return '中危'
      case 4: return '高危'
      case 5: return '严重'
      default: return '未知'
    }
  }

  const formatEventType = (eventType: string) => {
    switch (eventType) {
      case 'LIMIT_VIOLATION': return '限额违规'
      case 'SUSPICIOUS_USAGE': return '可疑使用'
      case 'AUTH_FAIL': return '认证失败'
      case 'RATE_LIMIT': return '频率限制'
      default: return eventType
    }
  }

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>加载安全监控数据...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          无法加载安全监控数据: {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={fetchSecurityStats}
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* 安全概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">总违规次数</p>
                <p className="text-2xl font-bold">{stats.totalViolations}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">今日违规</p>
                <p className="text-2xl font-bold">{stats.violationsToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">高危事件</p>
                <p className="text-2xl font-bold">{stats.highSeverityEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">最近事件</p>
                <p className="text-2xl font-bold">{stats.recentEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最近安全事件 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            最近安全事件
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={fetchSecurityStats}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              刷新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无安全事件</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentEvents.map((event) => (
                <div 
                  key={event.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {event.severity >= 4 ? (
                      <Ban className="h-5 w-5 text-red-500" />
                    ) : event.severity >= 3 ? (
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                    ) : (
                      <Activity className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {formatEventType(event.eventType)}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getSeverityColor(event.severity)}`}
                      >
                        {getSeverityText(event.severity)}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>时间: {new Date(event.createdAt).toLocaleString()}</p>
                      
                      {event.details.trustLevel !== undefined && (
                        <p>信任等级: LV{event.details.trustLevel}</p>
                      )}
                      
                      {event.details.attemptedUsage !== undefined && event.details.dailyLimit !== undefined && (
                        <p>
                          尝试使用: {event.details.attemptedUsage}/{event.details.dailyLimit}
                          {event.details.excessAttempts && (
                            <span className="text-red-600 ml-1">
                              (超出 {event.details.excessAttempts} 次)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 安全状态总结 */}
      {stats.violationsToday > 0 && (
        <Alert variant={stats.highSeverityEvents > 0 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">安全状态摘要</p>
              <p>
                今日检测到 {stats.violationsToday} 次违规尝试
                {stats.highSeverityEvents > 0 && (
                  <span className="text-red-600">
                    ，其中 {stats.highSeverityEvents} 次为高危事件
                  </span>
                )}
              </p>
              <p className="text-sm">
                系统已自动阻止所有超限访问，请继续监控异常活动。
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
