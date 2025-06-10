"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, TestTube, Plus } from "lucide-react"
import { useSession } from "next-auth/react"
import { useTranslation } from "@/hooks/use-i18n"
import { BaseURLInput } from "@/components/ui/base-url-input"

interface SharedKeyConfig {
  name: string
  baseUrl: string
  apiKey: string
  availableModels: string[]
  dailyLimit: number
  description: string
  tags: string[]
}



export function KeyUploadForm({
  onSuccess
}: {
  onSuccess?: () => void
}) {
  const { toast } = useToast()
  const t = useTranslation('sharedKeys')
  const [isLoading, setIsLoading] = useState(false)

  // 错误消息映射函数
  const getLocalizedError = (errorMessage: string): string => {
    const errorMap: Record<string, string> = {
      'Invalid base URL format': t('upload.errors.invalidBaseUrl'),
      'Missing required fields: baseUrl, apiKey, modelName': t('upload.errors.missingFields'),
      'Missing required fields: name, baseUrl, apiKey, and availableModels (non-empty array)': t('upload.errors.missingUploadFields'),
      'Daily limit must be between 150 and 99999, or 999999 for unlimited': t('upload.errors.invalidDailyLimit'),
      'Internal server error': t('upload.errors.serverError'),
      'API连接失败': t('upload.apiConnectionFailed'),
      'Network error': t('upload.networkError'),
      // 新增URL黑名单错误
      '此URL被封禁，不允许使用': t('upload.errors.urlBlocked'),
      'URL_BLOCKED': t('upload.errors.urlBlocked'),
      'URL_INVALID': t('upload.errors.urlInvalid')
    }

    return errorMap[errorMessage] || errorMessage
  }
  const [isTesting, setIsTesting] = useState(false)
  const [detectedModels, setDetectedModels] = useState<string[]>([])
  const [hasDetected, setHasDetected] = useState(false)
  const [modelFilter, setModelFilter] = useState("")
  const [newTag, setNewTag] = useState("")
  const { data: session } = useSession()

  const [config, setConfig] = useState<SharedKeyConfig>({
    name: "",
    baseUrl: "",
    apiKey: "",
    availableModels: [],
    dailyLimit: 150,
    description: "",
    tags: []
  })

  // URL验证状态
  const [isUrlValid, setIsUrlValid] = useState(false)

  const handleRemoveTag = (tagToRemove: string) => {
    setConfig(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  // 过滤模型列表
  const filteredModels = detectedModels.filter(model =>
    model.toLowerCase().includes(modelFilter.toLowerCase())
  )

  const handleTestKey = async () => {
    if (!config.baseUrl || !config.apiKey) {
      toast({
        title: t('upload.messages.testFailed'),
        description: t('upload.testRequiredFields'),
        variant: "destructive"
      })
      return
    }

    if (!isUrlValid) {
      toast({
        title: t('upload.messages.testFailed'),
        description: t('upload.errors.urlBlocked'),
        variant: "destructive"
      })
      return
    }

    // 如果没有任何模型，使用默认模型进行测试
    const testModel = config.availableModels.length > 0 ? config.availableModels[0] : 'gpt-4o'

    setIsTesting(true)
    try {
      const response = await fetch("/api/shared-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          modelName: testModel
        })
      })

      const result = await response.json()

      if (result.success) {
        const discoveredModels = result.availableModels || []

        toast({
          title: t('upload.messages.testSuccess'),
          description: discoveredModels.length > 0
            ? t('upload.testSuccessWithModels', { count: discoveredModels.length })
            : t('upload.testSuccessNoModels')
        })

        // 存储检测到的模型，让用户选择
        if (discoveredModels.length > 0) {
          setDetectedModels(discoveredModels)
          setHasDetected(true)
          // 默认不选择任何模型，让用户手动选择
          setConfig(prev => ({
            ...prev,
            availableModels: []
          }))
        }
      } else {
        toast({
          title: t('upload.messages.testFailed'),
          description: getLocalizedError(result.error || t('upload.apiConnectionFailed')),
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: t('upload.messages.testFailed'),
        description: t('upload.networkError'),
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
        title: t('upload.messages.uploadFailed'),
        description: t('upload.fillRequiredFields'),
        variant: "destructive"
      })
      return
    }

    if (!isUrlValid) {
      toast({
        title: t('upload.messages.uploadFailed'),
        description: t('upload.errors.urlBlocked'),
        variant: "destructive"
      })
      return
    }

    if (!config.availableModels || config.availableModels.length === 0) {
      toast({
        title: t('upload.messages.uploadFailed'),
        description: t('upload.pleaseSelectModel'),
        variant: "destructive"
      })
      return
    }

    if (!session) {
      toast({
        title: t('upload.authFailed'),
        description: t('upload.sessionInvalid'),
        variant: "destructive"
      })
      return;
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/shared-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({
          ...config,
          // 确保发送的是 availableModels 而不是其他字段名
          availableModels: config.availableModels
        })
      })

      if (response.ok) {
        toast({
          title: t('upload.messages.uploadSuccess'),
          description: t('upload.messages.uploadSuccessDesc')
        })

        // 重置表单
        setConfig({
          name: "",
          baseUrl: "",
          apiKey: "",
          availableModels: [],
          dailyLimit: 150,
          description: "",
          tags: []
        })

        onSuccess?.()
      } else {
        const error = await response.json()
        toast({
          title: t('upload.messages.uploadFailed'),
          description: getLocalizedError(error.error || error.message || t('upload.retryLater')),
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: t('upload.messages.uploadFailed'),
        description: t('upload.networkError'),
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }



  if (!session?.user) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{t('trustLevel.loginRequired')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t('trustLevel.loginDescription')}</p>
          {/* 这里可以添加一个登录按钮 */}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full">
      <div className="health-card">
        <div className="p-6">


          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 基础配置 */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold text-sm">1</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t('upload.basicConfig')}</h2>
                  <p className="text-sm text-muted-foreground">{t('upload.basicConfigDesc')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-foreground flex items-center space-x-1">
                    <span>{t('upload.keyName')}</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('upload.keyNamePlaceholder')}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrl" className="text-sm font-medium text-foreground flex items-center space-x-1">
                    <span>{t('upload.baseUrl')}</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <BaseURLInput
                    value={config.baseUrl}
                    onChange={(value) => {
                      setConfig(prev => ({ ...prev, baseUrl: value }))
                      setHasDetected(false)
                      setDetectedModels([])
                    }}
                    onValidationChange={setIsUrlValid}
                    placeholder={t('upload.baseUrlPlaceholder')}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-sm font-medium text-foreground flex items-center space-x-1">
                    <span>{t('upload.apiKey')}</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => {
                      setConfig(prev => ({ ...prev, apiKey: e.target.value }))
                      setHasDetected(false)
                      setDetectedModels([])
                    }}
                    placeholder={t('upload.apiKeyPlaceholder')}
                    required
                    className="h-11"
                  />
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTesting || !config.baseUrl || !config.apiKey || !isUrlValid}
                  className="h-11 px-8"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('upload.detecting')}
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      {t('upload.detectModels')}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 模型选择 - 只有检测到模型才显示 */}
            {hasDetected && detectedModels.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold text-sm">2</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground">{t('upload.selectModels')}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t('upload.selectedCount', { count: config.availableModels.length })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfig(prev => ({ ...prev, availableModels: [...filteredModels] }))}
                    >
                      {t('upload.selectAll')}{modelFilter && '筛选'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfig(prev => ({ ...prev, availableModels: [] }))}
                    >
                      {t('upload.deselectAll')}
                    </Button>
                  </div>
                </div>

                {/* 搜索框 */}
                {detectedModels.length > 8 && (
                  <div className="max-w-md">
                    <div className="relative">
                      <Input
                        placeholder={t('upload.modelFilter')}
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        className="h-10 pl-9"
                      />
                      <TestTube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      {modelFilter && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                          onClick={() => setModelFilter("")}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-muted/30 border rounded-xl p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 max-h-64 overflow-y-auto">
                    {filteredModels.length > 0 ? (
                      filteredModels.map((model) => (
                        <label
                          key={model}
                          className={`group relative flex items-center space-x-3 cursor-pointer p-3 rounded-lg border transition-all duration-200 ${
                            config.availableModels.includes(model)
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border bg-background hover:border-primary/50 hover:shadow-sm'
                          }`}
                          title={model}
                        >
                          <input
                            type="checkbox"
                            checked={config.availableModels.includes(model)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConfig(prev => ({
                                  ...prev,
                                  availableModels: [...prev.availableModels, model]
                                }))
                              } else {
                                setConfig(prev => ({
                                  ...prev,
                                  availableModels: prev.availableModels.filter(m => m !== model)
                                }))
                              }
                            }}
                            className="w-4 h-4 text-primary border-border rounded focus:ring-primary focus:ring-2"
                          />
                          <span className={`truncate min-w-0 text-sm font-medium transition-colors ${
                            config.availableModels.includes(model)
                              ? 'text-primary'
                              : 'text-foreground'
                          }`}>
                            {model}
                          </span>
                          {config.availableModels.includes(model) && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </label>
                      ))
                    ) : (
                      <div className="col-span-full text-center text-muted-foreground py-8">
                        <TestTube className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('upload.noModelsDetected')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {modelFilter && (
                  <div className="text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground">
                      {t('upload.selectedCount', { count: filteredModels.length })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 配置详情 - 只有选择了模型才显示 */}
            {hasDetected && config.availableModels.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold text-sm">3</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t('upload.configDetails')}</h2>
                  <p className="text-sm text-muted-foreground">{t('upload.configDetailsDesc')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 每日限制 */}
                <div className="space-y-3">
                  <Label htmlFor="dailyLimit" className="text-sm font-medium text-foreground">{t('upload.dailyLimit')}</Label>
                  <div className="space-y-4">
                    <Input
                      id="dailyLimit"
                      type="number"
                      value={config.dailyLimit === 999999 ? "" : config.dailyLimit}
                      onChange={(e) => {
                        const value = parseInt(e.target.value)
                        if (isNaN(value)) {
                          setConfig(prev => ({ ...prev, dailyLimit: 150 }))
                        } else {
                          setConfig(prev => ({ ...prev, dailyLimit: Math.min(Math.max(value, 150), 99999) }))
                        }
                      }}
                      placeholder={config.dailyLimit === 999999 ? t('upload.unlimited') : "150-99999"}
                      min="150"
                      max="99999"
                      className="h-11"
                    />
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="unlimited"
                          checked={config.dailyLimit === 999999}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConfig(prev => ({ ...prev, dailyLimit: 999999 }))
                            } else {
                              setConfig(prev => ({ ...prev, dailyLimit: 150 }))
                            }
                          }}
                          className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                        />
                        <Label htmlFor="unlimited" className="text-sm text-muted-foreground cursor-pointer">
                          {t('upload.unlimited')}{t('upload.cautionUse')}
                        </Label>
                      </div>
                      <p className="text-sm text-primary font-medium">
                        💡 {t('upload.supportUsers')} <span className="font-semibold">{config.dailyLimit === 999999 ? t('upload.unlimited') : Math.floor(config.dailyLimit / 150)}</span> {t('upload.usersCount')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 描述 */}
                <div className="lg:col-span-2 space-y-3">
                  <Label htmlFor="description" className="text-sm font-medium text-foreground">{t('upload.description')}</Label>
                  <Textarea
                    id="description"
                    value={config.description}
                    onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('upload.descriptionPlaceholder')}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* 标签 */}
              <div className="space-y-4">
                <Label className="text-sm font-medium text-foreground">{t('upload.tags')}</Label>

                {/* 显示已选标签 */}
                {config.tags.length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-2">{t('upload.selected')}</p>
                    <div className="flex gap-2 flex-wrap">
                      {config.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-sm rounded-md font-medium"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 快速标签和自定义输入 */}
                <div className="space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">{t('upload.quickSelect')}</p>
                      <div className="flex flex-wrap gap-2">
                        {['官方', '快速', '稳定', '免费'].map(tag => (
                          <Button
                            key={tag}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={config.tags.includes(tag)}
                            onClick={() => {
                              setConfig(prev => ({
                                ...prev,
                                tags: [...prev.tags, tag]
                              }))
                            }}
                          >
                            {tag}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="lg:w-80">
                      <p className="text-xs text-muted-foreground mb-2">{t('upload.customTags')}</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('upload.tagsPlaceholder')}
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (newTag.trim() && !config.tags.includes(newTag.trim())) {
                                setConfig(prev => ({
                                  ...prev,
                                  tags: [...prev.tags, newTag.trim()]
                                }))
                                setNewTag("")
                              }
                            }
                          }}
                          className="flex-1 h-9"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (newTag.trim() && !config.tags.includes(newTag.trim())) {
                              setConfig(prev => ({
                                ...prev,
                                tags: [...prev.tags, newTag.trim()]
                              }))
                              setNewTag("")
                            }
                          }}
                          className="h-9"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* 提交按钮 - 只有选择了模型才显示 */}
            {hasDetected && config.availableModels.length > 0 && (
            <div className="pt-6 border-t">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold text-sm">4</span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{t('upload.completeShare')}</h2>
                </div>

                <div className="max-w-md mx-auto">
                  {!hasDetected ? (
                    <div className="p-3 bg-muted/50 border rounded-lg">
                      <p className="text-sm text-muted-foreground flex items-center justify-center">
                        <TestTube className="w-4 h-4 mr-2" />
                        {t('upload.pleaseDetectFirst')}
                      </p>
                    </div>
                  ) : config.availableModels.length === 0 ? (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive flex items-center justify-center">
                        <Plus className="w-4 h-4 mr-2" />
                        {t('upload.pleaseSelectModel')}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-sm text-primary flex items-center justify-center">
                        <Plus className="w-4 h-4 mr-2" />
                        {t('upload.readyToShare')}
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !config.name || !config.baseUrl || !config.apiKey || !isUrlValid || config.availableModels.length === 0}
                  className="h-12 px-8 text-base font-medium"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      {t('upload.sharing')}
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      {t('upload.shareToComm')}
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground">
                  {t('upload.shareDescription')}
                </p>
              </div>
            </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
