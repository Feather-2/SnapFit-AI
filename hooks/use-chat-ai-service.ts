import { useState, useCallback, useRef } from 'react'
import { useChatAI } from '@/hooks/use-ai-service'
import type { AIConfig } from '@/lib/types'
import type { Message } from 'ai'

export interface UseChatAIServiceOptions {
  aiConfig: AIConfig
  expertRole?: string
  includeHealthData?: boolean
  recentHealthData?: any[]
  userProfile?: any
  todayLog?: any
  memories?: any
  uploadedImages?: Array<{ file: File; url: string; compressedFile?: File }>
  onImagesClear?: () => void
}

export interface UseChatAIServiceResult {
  messages: Message[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  error: Error | null
  setMessages: (messages: Message[]) => void
  isPrivateMode: boolean
  isConfigValid: boolean
  configError?: string
  clearImages?: () => void
}

export function useChatAIService({
  aiConfig,
  expertRole = 'general',
  includeHealthData = false,
  recentHealthData = [],
  userProfile = {},
  todayLog = null,
  memories = null,
  uploadedImages = [],
  onImagesClear
}: UseChatAIServiceOptions): UseChatAIServiceResult {

  const aiService = useChatAI(aiConfig)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // 检查是否有内容（文本或图片）
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return

    // 检查配置是否有效
    if (!aiService.isConfigValid) {
      setError(new Error(aiService.configError || '配置无效'))
      return
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // 准备图片数据
    const imageDataURIs: string[] = []
    if (uploadedImages.length > 0) {
      for (const img of uploadedImages) {
        const fileToUse = img.compressedFile || img.file
        const arrayBuffer = await fileToUse.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const dataURI = `data:${fileToUse.type};base64,${base64}`
        imageDataURIs.push(dataURI)
      }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input || (uploadedImages.length > 0 ? '请分析这些图片' : ''),
      // @ts-ignore - 扩展Message类型以支持图片
      images: imageDataURIs.length > 0 ? imageDataURIs : undefined
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    setError(null)

    // 清除已上传的图片
    if (onImagesClear) {
      onImagesClear()
    }

    try {
      // 构建系统提示词
      let systemPrompt = `你是一位专业的健康助手。专家角色：${expertRole}`

      // 添加健康数据上下文
      if (includeHealthData) {
        if (userProfile && Object.keys(userProfile).length > 0) {
          systemPrompt += `\n\n用户档案：${JSON.stringify(userProfile, null, 2)}`
        }

        if (todayLog) {
          systemPrompt += `\n\n今日健康数据：${JSON.stringify(todayLog, null, 2)}`
        }

        if (recentHealthData && recentHealthData.length > 0) {
          systemPrompt += `\n\n近期健康数据：${JSON.stringify(recentHealthData.slice(0, 3), null, 2)}`
        }

        if (memories) {
          systemPrompt += `\n\n用户记忆：${JSON.stringify(memories, null, 2)}`
        }
      }

      // 构建对话历史，包含图片
      const conversationMessages = newMessages.map(msg => {
        const cleanMsg: any = {
          role: msg.role,
          content: msg.content
        }
        // @ts-ignore - 扩展Message类型以支持图片
        if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
          cleanMsg.images = msg.images
        }
        return cleanMsg
      })

      if (aiService.isPrivateMode) {
        // Private模式：使用流式API
        const { stream } = await aiService.streamText({
          messages: conversationMessages,
          system: systemPrompt
        })

        // 处理流式响应
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: ''
        }

        setMessages([...newMessages, assistantMessage])

        const reader = stream.body?.getReader()
        const decoder = new TextDecoder('utf-8')

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })

              setMessages(currentMessages => {
                const updatedMessages = [...currentMessages]
                const lastMessage = updatedMessages[updatedMessages.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content += chunk
                }
                return updatedMessages
              })
            }
          } finally {
            reader.releaseLock()
          }
        }
      } else {
        // Shared模式：调用服务器API
        const response = await fetch('/api/openai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: conversationMessages,
            expertRole,
            includeHealthData,
            recentHealthData,
            userProfile,
            todayLog,
            memories,
            aiConfig
          }),
          signal: abortControllerRef.current.signal
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))

          if (response.status === 429 && errorData.code === 'LIMIT_EXCEEDED') {
            const details = errorData.details || {}
            const currentUsage = details.currentUsage || '未知'
            const dailyLimit = details.dailyLimit || '未知'
            throw new Error(`今日AI使用次数已达上限 (${currentUsage}/${dailyLimit})，请明天再试或提升信任等级`)
          } else if (response.status === 401 && errorData.code === 'UNAUTHORIZED') {
            throw new Error('请登录后再使用')
          } else if (response.status === 403) {
            throw new Error('访问被拒绝，请检查您的权限')
          } else if (response.status === 503 && errorData.code === 'SHARED_KEYS_EXHAUSTED') {
            throw new Error('AI服务暂时不可用，请稍后重试')
          } else if (response.status >= 500) {
            throw new Error('服务器暂时不可用，请稍后重试')
          } else {
            // 提供更友好的错误信息，避免显示原始JSON
            const friendlyMessage = errorData.message || errorData.error
            if (friendlyMessage && typeof friendlyMessage === 'string') {
              throw new Error(friendlyMessage)
            } else {
              throw new Error('聊天服务暂时不可用，请稍后重试')
            }
          }
        }

        // 处理流式响应
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: ''
        }

        setMessages([...newMessages, assistantMessage])

        const reader = response.body?.getReader()
        const decoder = new TextDecoder('utf-8')

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })

              setMessages(currentMessages => {
                const updatedMessages = [...currentMessages]
                const lastMessage = updatedMessages[updatedMessages.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content += chunk
                }
                return updatedMessages
              })
            }
          } finally {
            reader.releaseLock()
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // 用户取消了请求
      }

      const errorMessage = err instanceof Error ? err.message : '聊天服务出现错误'
      setError(new Error(errorMessage))

      // 移除加载中的消息
      setMessages(newMessages)
    } finally {
      setIsLoading(false)
    }
  }, [input, messages, isLoading, aiService, expertRole, includeHealthData, recentHealthData, userProfile, todayLog, memories])

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    isPrivateMode: aiService.isPrivateMode,
    isConfigValid: aiService.isConfigValid,
    configError: aiService.configError
  }
}
