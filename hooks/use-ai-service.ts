import { useCallback } from 'react'
import { FrontendAIClient, type FrontendAIConfig, type GenerateTextOptions, type StreamTextOptions } from '@/lib/frontend-ai-client'
import type { AIConfig } from '@/lib/types'

export interface AIServiceOptions {
  aiConfig: AIConfig
  modelType: 'agentModel' | 'chatModel' | 'visionModel'
}

export interface AIServiceResult {
  generateText: (options: Omit<GenerateTextOptions, 'model'>) => Promise<{ text: string; source: 'shared' | 'private' }>
  streamText: (options: Omit<StreamTextOptions, 'model'>) => Promise<{ stream: Response; source: 'shared' | 'private' }>
  isPrivateMode: boolean
  isConfigValid: boolean
  configError?: string
}

export function useAIService({ aiConfig, modelType }: AIServiceOptions): AIServiceResult {
  const modelConfig = aiConfig[modelType]
  const isPrivateMode = modelConfig.source === 'private'

  // 验证私有配置
  const validatePrivateConfig = useCallback(() => {
    if (!isPrivateMode) return { valid: true }

    return FrontendAIClient.validateConfig({
      name: modelConfig.name,
      baseUrl: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey
    })
  }, [isPrivateMode, modelConfig])

  const validation = validatePrivateConfig()
  const isConfigValid = validation.valid

  // 生成文本
  const generateText = useCallback(async (options: Omit<GenerateTextOptions, 'model'>) => {
    if (isPrivateMode) {
      // 私有模式：前端直接调用
      if (!isConfigValid) {
        throw new Error(validation.error || '私有配置不完整')
      }

      const client = new FrontendAIClient({
        name: modelConfig.name,
        baseUrl: modelConfig.baseUrl,
        apiKey: modelConfig.apiKey
      })

      const result = await client.generateText({
        ...options,
        model: modelConfig.name
      })

      return {
        ...result,
        source: 'private' as const
      }
    } else {
      // 共享模式：调用服务器API
      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options,
          modelType,
          aiConfig
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (response.status === 429 && errorData.code === 'LIMIT_EXCEEDED') {
          const details = errorData.details || {}
          const currentUsage = details.currentUsage || '未知'
          const dailyLimit = details.dailyLimit || '未知'
          throw new Error(`今日AI使用次数已达上限 (${currentUsage}/${dailyLimit})，请明天再试或提升信任等级`)
        } else if (response.status === 401 && errorData.code === 'UNAUTHORIZED') {
          throw new Error('请先登录后再使用AI功能')
        } else {
          throw new Error(`AI服务失败: ${errorData.message || errorData.error || response.statusText || response.status}`)
        }
      }

      const result = await response.json()
      return {
        text: result.text,
        source: 'shared' as const
      }
    }
  }, [isPrivateMode, isConfigValid, validation.error, modelConfig, modelType, aiConfig])

  // 流式生成文本
  const streamText = useCallback(async (options: Omit<StreamTextOptions, 'model'>) => {
    if (isPrivateMode) {
      // 私有模式：前端直接调用
      if (!isConfigValid) {
        throw new Error(validation.error || '私有配置不完整')
      }

      const client = new FrontendAIClient({
        name: modelConfig.name,
        baseUrl: modelConfig.baseUrl,
        apiKey: modelConfig.apiKey
      })

      const stream = await client.streamText({
        ...options,
        model: modelConfig.name
      })

      return {
        stream,
        source: 'private' as const
      }
    } else {
      // 共享模式：调用服务器API
      const response = await fetch('/api/ai/stream-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options,
          modelType,
          aiConfig
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (response.status === 429 && errorData.code === 'LIMIT_EXCEEDED') {
          const details = errorData.details || {}
          const currentUsage = details.currentUsage || '未知'
          const dailyLimit = details.dailyLimit || '未知'
          throw new Error(`今日AI使用次数已达上限 (${currentUsage}/${dailyLimit})，请明天再试或提升信任等级`)
        } else if (response.status === 401 && errorData.code === 'UNAUTHORIZED') {
          throw new Error('请先登录后再使用AI功能')
        } else {
          throw new Error(`AI服务失败: ${errorData.message || errorData.error || response.statusText || response.status}`)
        }
      }

      return {
        stream: response,
        source: 'shared' as const
      }
    }
  }, [isPrivateMode, isConfigValid, validation.error, modelConfig, modelType, aiConfig])

  return {
    generateText,
    streamText,
    isPrivateMode,
    isConfigValid,
    configError: validation.error
  }
}

// 便捷的Hook，用于特定模型类型
export function useAgentAI(aiConfig: AIConfig) {
  return useAIService({ aiConfig, modelType: 'agentModel' })
}

export function useChatAI(aiConfig: AIConfig) {
  return useAIService({ aiConfig, modelType: 'chatModel' })
}

export function useVisionAI(aiConfig: AIConfig) {
  return useAIService({ aiConfig, modelType: 'visionModel' })
}
