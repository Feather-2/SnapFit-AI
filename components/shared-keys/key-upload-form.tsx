"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, TestTube, Plus, X } from "lucide-react"

interface SharedKeyConfig {
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
  dailyLimit: number
  description: string
  tags: string[]
}

const COMMON_CONFIGS = [
  {
    name: "OpenAI 官方",
    baseUrl: "https://api.openai.com",
    modelName: "gpt-4o",
    tags: ["official", "stable"]
  },
  {
    name: "OneAPI 代理",
    baseUrl: "https://your-oneapi-domain.com",
    modelName: "gpt-4o",
    tags: ["proxy", "fast"]
  }
]

export function KeyUploadForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [newTag, setNewTag] = useState("")
  
  const [config, setConfig] = useState<SharedKeyConfig>({
    name: "",
    baseUrl: "",
    apiKey: "",
    modelName: "gpt-4o",
    dailyLimit: 100,
    description: "",
    tags: []
  })

  const handleAddTag = () => {
    if (newTag.trim() && !config.tags.includes(newTag.trim())) {
      setConfig(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setConfig(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleTestKey = async () => {
    if (!config.baseUrl || !config.apiKey) {
      toast({
        title: "测试失败",
        description: "请先填写API URL和Key",
        variant: "destructive"
      })
      return
    }

    setIsTesting(true)
    try {
      const response = await fetch("/api/shared-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          modelName: config.modelName
        })
      })

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "测试成功",
          description: `API连接正常，支持模型: ${result.availableModels?.join(", ") || config.modelName}`
        })
      } else {
        toast({
          title: "测试失败",
          description: result.error || "API连接失败",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "测试失败",
        description: "网络错误或API不可用",
        variant: "destructive"
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!config.name || !config.baseUrl || !config.apiKey) {
      toast({
        title: "提交失败",
        description: "请填写所有必填字段",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/shared-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        toast({
          title: "上传成功",
          description: "感谢您分享API Key！"
        })
        
        // 重置表单
        setConfig({
          name: "",
          baseUrl: "",
          apiKey: "",
          modelName: "gpt-4o",
          dailyLimit: 100,
          description: "",
          tags: []
        })
        
        onSuccess?.()
      } else {
        const error = await response.json()
        toast({
          title: "上传失败",
          description: error.message || "请稍后重试",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "上传失败",
        description: "网络错误，请稍后重试",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseTemplate = (template: typeof COMMON_CONFIGS[0]) => {
    setConfig(prev => ({
      ...prev,
      name: template.name,
      baseUrl: template.baseUrl,
      modelName: template.modelName,
      tags: [...new Set([...prev.tags, ...template.tags])]
    }))
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>分享 API Key</CardTitle>
        <p className="text-sm text-muted-foreground">
          分享您的API Key给社区用户使用，支持OpenAI兼容的所有API服务
        </p>
      </CardHeader>
      <CardContent>
        {/* 快速模板 */}
        <div className="mb-6">
          <Label className="text-sm font-medium">快速配置模板</Label>
          <div className="flex gap-2 mt-2">
            {COMMON_CONFIGS.map((template, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleUseTemplate(template)}
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 配置名称 */}
          <div>
            <Label htmlFor="name">配置名称 *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如：我的GPT-4配置"
              required
            />
          </div>

          {/* API URL */}
          <div>
            <Label htmlFor="baseUrl">API 基础URL *</Label>
            <Input
              id="baseUrl"
              value={config.baseUrl}
              onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com"
              required
            />
          </div>

          {/* API Key */}
          <div>
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-..."
              required
            />
          </div>

          {/* 模型名称 */}
          <div>
            <Label htmlFor="modelName">模型名称 *</Label>
            <Input
              id="modelName"
              value={config.modelName}
              onChange={(e) => setConfig(prev => ({ ...prev, modelName: e.target.value }))}
              placeholder="gpt-4o"
              required
            />
          </div>

          {/* 每日限制 */}
          <div>
            <Label htmlFor="dailyLimit">每日调用限制</Label>
            <Input
              id="dailyLimit"
              type="number"
              value={config.dailyLimit}
              onChange={(e) => setConfig(prev => ({ ...prev, dailyLimit: parseInt(e.target.value) || 100 }))}
              min="1"
              max="1000"
            />
          </div>

          {/* 描述 */}
          <div>
            <Label htmlFor="description">描述（可选）</Label>
            <Textarea
              id="description"
              value={config.description}
              onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
              placeholder="简单描述这个API配置的特点..."
              rows={3}
            />
          </div>

          {/* 标签 */}
          <div>
            <Label>标签</Label>
            <div className="flex gap-2 mt-2 mb-2 flex-wrap">
              {config.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="添加标签..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestKey}
              disabled={isTesting || !config.baseUrl || !config.apiKey}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              测试连接
            </Button>

            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              分享 Key
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
