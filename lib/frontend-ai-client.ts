// 前端AI客户端 - 用于private模式直接调用AI服务
export interface FrontendAIConfig {
  name: string
  baseUrl: string
  apiKey: string
}

export interface GenerateTextOptions {
  model: string
  prompt: string
  images?: string[]
  response_format?: { type: "json_object" }
  max_tokens?: number
}

export interface StreamTextOptions {
  model: string
  messages: Array<{ role: string; content: string; images?: string[] }>
  system?: string
}

export class FrontendAIClient {
  private config: FrontendAIConfig

  constructor(config: FrontendAIConfig) {
    // 确保baseUrl格式正确
    this.config = {
      ...config,
      baseUrl: config.baseUrl.endsWith("/") ? config.baseUrl.slice(0, -1) : config.baseUrl
    }

    // 如果baseUrl已经包含/v1，不要重复添加
    if (this.config.baseUrl.endsWith("/v1")) {
      this.config.baseUrl = this.config.baseUrl.slice(0, -3)
    }
  }

  // 验证配置是否完整
  static validateConfig(config: FrontendAIConfig): { valid: boolean; error?: string } {
    if (!config.name) {
      return { valid: false, error: "模型名称不能为空" }
    }
    if (!config.baseUrl) {
      return { valid: false, error: "API地址不能为空" }
    }
    if (!config.apiKey) {
      return { valid: false, error: "API密钥不能为空" }
    }

    // 验证URL格式
    try {
      new URL(config.baseUrl)
    } catch {
      return { valid: false, error: "API地址格式不正确" }
    }

    return { valid: true }
  }

  // 生成文本
  async generateText(options: GenerateTextOptions): Promise<{ text: string }> {
    const { model, prompt, images, response_format, max_tokens } = options

    const messages: Array<{ role: string; content: string | Array<any> }> = []

    if (images && images.length > 0) {
      // 视觉模型请求
      const content = [
        { type: "text", text: prompt },
        ...images.map((image) => ({
          type: "image_url",
          image_url: { url: image },
        })),
      ]
      messages.push({ role: "user", content })
    } else {
      // 普通文本请求
      messages.push({ role: "user", content: prompt })
    }

    const response = await this.createChatCompletion({
      model,
      messages,
      response_format,
      max_tokens,
    })

    const result = await response.json()
    return {
      text: result.choices[0]?.message?.content || "",
    }
  }

  // 流式生成文本
  async streamText(options: StreamTextOptions): Promise<Response> {
    const { model, messages, system } = options

    // 转换消息格式以支持图片
    const finalMessages: Array<{ role: string; content: string | Array<any> }> = messages.map(msg => {
      if (msg.images && msg.images.length > 0) {
        // 包含图片的消息
        const content = [
          { type: "text", text: msg.content },
          ...msg.images.map((image) => ({
            type: "image_url",
            image_url: { url: image },
          })),
        ]
        return { role: msg.role, content }
      } else {
        // 纯文本消息
        return { role: msg.role, content: msg.content }
      }
    })

    if (system) {
      finalMessages.unshift({ role: "system", content: system })
    }

    return await this.createChatCompletion({
      model,
      messages: finalMessages,
      stream: true,
    })
  }

  // 创建聊天完成请求
  private async createChatCompletion(params: {
    model: string
    messages: Array<{ role: string; content: string | Array<any> }>
    response_format?: { type: string }
    stream?: boolean
    max_tokens?: number
  }): Promise<Response> {
    const url = `${this.config.baseUrl}/v1/chat/completions`

    const requestBody = {
      model: params.model,
      messages: params.messages,
      stream: params.stream || false,
      ...(params.response_format && { response_format: params.response_format }),
      ...(params.max_tokens && { max_tokens: params.max_tokens }),
    }

    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return response
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`请求超时：连接到 ${this.config.baseUrl} 超过30秒未响应。请检查网络连接或API服务状态。`)
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          throw new Error(`网络连接失败：无法连接到 ${this.config.baseUrl}。请检查网络连接和API地址是否正确。`)
        } else if (error.message.includes('CERT') || error.message.includes('certificate')) {
          throw new Error(`SSL证书错误：连接到 ${this.config.baseUrl} 时遇到证书问题。`)
        }
      }

      throw new Error(`API请求失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 测试连接
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.config.baseUrl}/v1/models`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15秒超时

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `连接测试失败: ${response.status} ${response.statusText} - ${errorText}`
        }
      }

      return { success: true }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: `连接超时：无法在15秒内连接到 ${this.config.baseUrl}` }
        }
      }
      return {
        success: false,
        error: `连接测试失败：${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
