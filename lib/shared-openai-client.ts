import { OpenAICompatibleClient } from './openai-client'
import { KeyManager } from './key-manager'
import type { SharedKeyConfig } from './key-manager'

export interface SharedClientOptions {
  preferredModel?: string
  userId: string
  fallbackConfig?: {
    baseUrl: string
    apiKey: string
  }
}

export interface GenerateTextOptions {
  model: string
  prompt: string
  images?: string[]
  response_format?: { type: "json_object" }
  max_tokens?: number
}

export class SharedOpenAIClient {
  private keyManager: KeyManager
  private options: SharedClientOptions
  private currentKey: SharedKeyConfig | null = null
  private currentKeyInfo: any = null

  constructor(options: SharedClientOptions) {
    this.keyManager = new KeyManager()
    this.options = options
  }

  // 获取当前使用的Key信息（用于显示感谢信息）
  getCurrentKeyInfo() {
    return this.currentKeyInfo
  }

  // 生成文本
  async generateText(options: GenerateTextOptions): Promise<{ text: string; keyInfo?: any }> {
    const { model, prompt, images, response_format, max_tokens } = options

    // 尝试获取共享Key
    const { key, error } = await this.keyManager.getAvailableKey(model)
    
    if (!key) {
      // 如果没有可用的共享Key，使用fallback配置
      if (this.options.fallbackConfig) {
        const client = new OpenAICompatibleClient(
          this.options.fallbackConfig.baseUrl,
          this.options.fallbackConfig.apiKey
        )
        
        const result = await client.generateText({
          model,
          prompt,
          images,
          response_format,
          max_tokens
        })
        
        return { 
          text: result.text,
          keyInfo: {
            source: 'fallback',
            message: '使用用户自己的API Key'
          }
        }
      } else {
        throw new Error(`No available shared keys for model ${model}: ${error}`)
      }
    }

    this.currentKey = key
    this.currentKeyInfo = {
      contributorName: key.name,
      modelName: model,
      keyName: key.name,
      source: 'shared'
    }

    const client = new OpenAICompatibleClient(key.baseUrl, key.apiKey)
    
    let success = false
    let errorMessage: string | undefined
    let tokensUsed: number | undefined
    
    try {
      const result = await client.generateText({
        model,
        prompt,
        images,
        response_format,
        max_tokens
      })
      
      success = true
      // 尝试从响应中提取token使用量（如果API支持）
      tokensUsed = (result as any).usage?.total_tokens
      
      return { 
        text: result.text,
        keyInfo: this.currentKeyInfo
      }
    } catch (error) {
      success = false
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw error
    } finally {
      // 记录使用情况
      if (key.id) {
        await this.keyManager.logKeyUsage(key.id, {
          sharedKeyId: key.id,
          userId: this.options.userId,
          apiEndpoint: '/chat/completions',
          modelUsed: model,
          tokensUsed,
          success,
          errorMessage
        })
      }
    }
  }

  // 获取模型列表
  async listModels(): Promise<any> {
    // 尝试获取任意可用的Key来获取模型列表
    const { key, error } = await this.keyManager.getAvailableKey()
    
    if (!key) {
      if (this.options.fallbackConfig) {
        const client = new OpenAICompatibleClient(
          this.options.fallbackConfig.baseUrl,
          this.options.fallbackConfig.apiKey
        )
        return await client.listModels()
      } else {
        throw new Error(`No available shared keys: ${error}`)
      }
    }

    const client = new OpenAICompatibleClient(key.baseUrl, key.apiKey)
    
    try {
      const result = await client.listModels()
      
      // 记录使用情况
      if (key.id) {
        await this.keyManager.logKeyUsage(key.id, {
          sharedKeyId: key.id,
          userId: this.options.userId,
          apiEndpoint: '/models',
          modelUsed: 'list',
          success: true
        })
      }
      
      return result
    } catch (error) {
      // 记录失败情况
      if (key.id) {
        await this.keyManager.logKeyUsage(key.id, {
          sharedKeyId: key.id,
          userId: this.options.userId,
          apiEndpoint: '/models',
          modelUsed: 'list',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      throw error
    }
  }
}

// 工厂函数，用于创建共享客户端
export function createSharedClient(options: SharedClientOptions): SharedOpenAIClient {
  return new SharedOpenAIClient(options)
}

// Hook for React components
export function useSharedOpenAI(options: SharedClientOptions) {
  const client = new SharedOpenAIClient(options)
  
  return {
    generateText: client.generateText.bind(client),
    listModels: client.listModels.bind(client),
    getCurrentKeyInfo: client.getCurrentKeyInfo.bind(client)
  }
}
