'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  Database, 
  HardDrive, 
  Settings, 
  CheckCircle, 
  Info,
  ArrowRight,
  ArrowLeft
} from 'lucide-react'
import { getStorageModeInfo, STORAGE_MODE_GUIDE } from '@/lib/storage-config'
import Link from 'next/link'

export default function StorageInfoPage() {
  const storageInfo = getStorageModeInfo()
  const isServerMode = storageInfo.mode === 'server'

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/zh">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回主页
          </Button>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Settings className="h-8 w-8" />
        存储模式配置
      </h1>

      {/* 当前存储模式 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isServerMode ? (
              <Database className="h-5 w-5 text-blue-500" />
            ) : (
              <HardDrive className="h-5 w-5 text-green-500" />
            )}
            当前存储模式
          </CardTitle>
          <CardDescription>
            应用当前使用的数据存储方式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Badge variant={isServerMode ? "default" : "secondary"} className="text-sm">
              {storageInfo.mode.toUpperCase()}
            </Badge>
            <span className="text-lg font-medium">{storageInfo.description}</span>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                功能特性
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {storageInfo.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="h-1 w-1 bg-muted-foreground rounded-full" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 环境变量配置 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>环境变量配置</CardTitle>
          <CardDescription>
            通过环境变量控制存储模式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>环境变量：</strong> {STORAGE_MODE_GUIDE.envVariable}
              <br />
              <strong>当前值：</strong> {storageInfo.mode}
              <br />
              <strong>可选值：</strong> {Object.values(STORAGE_MODE_GUIDE.values).join(' | ')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 设置指南 */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* 浏览器存储设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-green-500" />
              浏览器存储设置
            </CardTitle>
            <CardDescription>
              使用IndexedDB本地存储
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {STORAGE_MODE_GUIDE.setup.browser.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Badge variant="outline" className="min-w-[24px] h-6 text-xs">
                    {index + 1}
                  </Badge>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* 服务端存储设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              服务端存储设置
            </CardTitle>
            <CardDescription>
              使用SQLite + Prisma存储
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {STORAGE_MODE_GUIDE.setup.server.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Badge variant="outline" className="min-w-[24px] h-6 text-xs">
                    {index + 1}
                  </Badge>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* 数据迁移 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>数据迁移</CardTitle>
          <CardDescription>
            在存储模式之间迁移数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {STORAGE_MODE_GUIDE.migration.map((info, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span>{info}</span>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 mt-4">
            <Link href="/zh/migrate-data">
              <Button variant="outline" size="sm">
                数据迁移工具
              </Button>
            </Link>
            <Link href="/zh/test-db">
              <Button variant="outline" size="sm">
                数据库测试
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 注意事项 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>注意：</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• 更改存储模式后需要重启应用才能生效</li>
            <li>• 不同存储模式的数据不会自动同步</li>
            <li>• 建议在切换前先备份重要数据</li>
            <li>• 服务端存储需要正确配置数据库连接</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
} 