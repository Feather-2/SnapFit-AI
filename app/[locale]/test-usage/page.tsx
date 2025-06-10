"use client"

import { UsageIndicator, UsageBadge, UsageProgress } from "@/components/usage/usage-indicator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUsageLimit } from "@/hooks/use-usage-limit"

export default function TestUsagePage() {
  const {
    usageInfo,
    loading,
    error,
    isInitialized,
    lastFetched,
    refreshUsageInfo,
    shouldRefresh,
    THROTTLE_MINUTES
  } = useUsageLimit()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">使用额度测试页面</h1>

      {/* 状态信息 */}
      <Card>
        <CardHeader>
          <CardTitle>状态信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>初始化状态: {isInitialized ? '✅ 已初始化' : '⏳ 未初始化'}</div>
          <div>加载状态: {loading ? '🔄 加载中' : '✅ 已完成'}</div>
          <div>错误状态: {error ? `❌ ${error}` : '✅ 正常'}</div>
          <div>上次获取: {lastFetched ? lastFetched.toLocaleString() : '从未获取'}</div>
          <div>是否需要刷新: {shouldRefresh() ? '✅ 需要' : '❌ 不需要'}</div>
          <div>节流间隔: {THROTTLE_MINUTES} 分钟</div>
        </CardContent>
      </Card>

      {/* 使用信息 */}
      <Card>
        <CardHeader>
          <CardTitle>使用信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {usageInfo ? (
            <div className="space-y-2">
              <div>当前使用: {usageInfo.currentUsage}</div>
              <div>每日限额: {usageInfo.dailyLimit}</div>
              <div>剩余次数: {usageInfo.remaining}</div>
              <div>是否允许: {usageInfo.allowed ? '✅ 允许' : '❌ 不允许'}</div>
              <div>重置时间: {usageInfo.resetTime}</div>
            </div>
          ) : (
            <div>暂无使用信息</div>
          )}
        </CardContent>
      </Card>

      {/* 组件测试 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>主导航使用的 UsageBadge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-4 bg-muted/30 rounded">
              <UsageBadge className="text-xs" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>用户导航卡片预览</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 模拟用户导航下拉菜单的样式 */}
            <div className="w-72 border rounded-lg bg-background shadow-lg">
              <div className="p-4 space-y-3">
                {/* 用户基本信息 */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    U
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">测试用户</div>
                    <div className="text-xs text-muted-foreground">test@example.com</div>
                  </div>
                </div>

                {/* 信任等级 - 占用全宽 */}
                <div className="flex items-center justify-between">
                  <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    🛡️ LV2
                  </div>
                  <div className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs">
                    可使用共享服务
                  </div>
                </div>

                {/* 使用量信息 - 占用全宽 */}
                <UsageProgress showRefresh={true} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 完整组件 */}
      <Card>
        <CardHeader>
          <CardTitle>完整使用指示器</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageIndicator variant="card" showStats={true} />
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>操作测试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={refreshUsageInfo} disabled={loading}>
            手动刷新使用信息
          </Button>

          <Button
            onClick={() => {
              localStorage.removeItem('usageInfo_cache')
              localStorage.removeItem('usageInfo_timestamp')
              window.location.reload()
            }}
            variant="outline"
          >
            清除缓存并刷新页面
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
