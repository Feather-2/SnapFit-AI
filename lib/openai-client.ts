// 通用的 OpenAI 兼容客户端
export class OpenAICompatibleClient {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    // 确保baseUrl格式正确
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
    // 如果baseUrl已经包含/v1，不要重复添加
    if (this.baseUrl.endsWith("/v1")) {
      this.baseUrl = this.baseUrl.slice(0, -3)
    }
    this.apiKey = apiKey

    //console.log("OpenAI Client initialized:", {
    //  baseUrl: this.baseUrl,
    //  hasApiKey: !!this.apiKey,
    //})
  }

  async createChatCompletion(params: {
    model: string
    messages: Array<{ role: string; content: string | Array<any> }>
    response_format?: { type: string }
    stream?: boolean
    max_tokens?: number
  }) {
    const url = `${this.baseUrl}/v1/chat/completions`
    //console.log("Making request to:", url)
    //console.log("Request params:", {
    //  model: params.model,
    //  messageCount: params.messages.length,
    //  stream: params.stream,
    //  hasResponseFormat: !!params.response_format,
    //})

    const requestBody = {
      model: params.model,
      messages: params.messages,
      stream: params.stream || false,
      ...(params.response_format && { response_format: params.response_format }),
      ...(params.max_tokens && { max_tokens: params.max_tokens }),
    }

    // 🐛 调试日志 - 避免打印完整的 base64 图片数据
    const debugRequestBody = {
      ...requestBody,
      messages: requestBody.messages.map((msg: any) => {
        if (msg.content && Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((item: any) => {
              if (item.type === 'image_url' && item.image_url?.url) {
                const url = item.image_url.url
                const preview = url.length > 100 ? `${url.substring(0, 50)}...[${url.length} chars total]` : url
                return {
                  ...item,
                  image_url: {
                    ...item.image_url,
                    url: preview
                  }
                }
              }
              return item
            })
          }
        }
        return msg
      })
    }
    //console.log("Request body (base64 truncated):", JSON.stringify(debugRequestBody, null, 2))

    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${this.apiKey}`,
          "Accept": "application/json; charset=utf-8",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log("Response status:", response.status)
      //console.log("Response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error Response:", errorText)
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return response
    } catch (error) {
      console.error("Fetch error:", error)

      // 提供更详细的错误信息
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`请求超时：连接到 ${this.baseUrl} 超过30秒未响应。请检查网络连接或API服务状态。`)
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          throw new Error(`网络连接失败：无法连接到 ${this.baseUrl}。请检查网络连接和API地址是否正确。`)
        } else if (error.message.includes('CERT') || error.message.includes('certificate')) {
          throw new Error(`SSL证书错误：连接到 ${this.baseUrl} 时遇到证书问题。`)
        }
      }

      throw new Error(`API请求失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async generateText(params: {
    model: string
    prompt: string
    images?: string[]
    response_format?: { type: string }
    max_tokens?: number
  }) {
    //console.log("Generating text with params:", {
    //  model: params.model,
    //  promptLength: params.prompt.length,
    //  imageCount: params.images?.length || 0,
    //  hasResponseFormat: !!params.response_format,
    //})

    const messages: Array<{ role: string; content: string | Array<any> }> = []

    if (params.images && params.images.length > 0) {
      // 视觉模型请求
      const content = [
        { type: "text", text: params.prompt },
        ...params.images.map((image) => ({
          type: "image_url",
          image_url: { url: image },
        })),
      ]
      messages.push({ role: "user", content })
    } else {
      // 普通文本请求
      messages.push({ role: "user", content: params.prompt })
    }

    const response = await this.createChatCompletion({
      model: params.model,
      messages,
      response_format: params.response_format,
      max_tokens: params.max_tokens,
    })

    const result = await response.json()
    //console.log("Generate text result:", {
    //  hasChoices: !!result.choices,
    //  choiceCount: result.choices?.length || 0,
    //  firstChoiceContent: result.choices?.[0]?.message?.content?.substring(0, 100) + "...",
    //})

    return {
      text: result.choices[0]?.message?.content || "",
    }
  }

  async streamText(params: {
    model: string
    messages: Array<{ role: string; content: string; images?: string[] }>
    system?: string
  }) {
    console.log("Streaming text with params:", {
      model: params.model,
      messageCount: params.messages.length,
      hasSystem: !!params.system,
      hasImages: params.messages.some(msg => msg.images && msg.images.length > 0)
    })

    // 转换消息格式以支持图片
    const messages: Array<{ role: string; content: string | Array<any> }> = params.messages.map(msg => {
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

    if (params.system) {
      messages.unshift({ role: "system", content: params.system })
    }

    const response = await this.createChatCompletion({
      model: params.model,
      messages,
      stream: true,
    })

    return response
  }

  // 获取可用模型列表
  async listModels() {
    const url = `${this.baseUrl}/v1/models`
    console.log("Listing models from:", url)

    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15秒超时

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log("List models response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("List models error:", errorText)
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      console.log("Models fetched:", result.data?.length || 0)
      return result
    } catch (error) {
      console.error("List models fetch error:", error)

      // 提供更详细的错误信息
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`获取模型列表超时：连接到 ${this.baseUrl} 超过15秒未响应。`)
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          throw new Error(`网络连接失败：无法连接到 ${this.baseUrl}。请检查网络连接和API地址。`)
        }
      }

      throw new Error(`获取模型列表失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// 模型类型接口
export interface OpenAIModel {
  id: string
  object: string
  created: number
  owned_by: string
}

export interface OpenAIModelList {
  object: string
  data: OpenAIModel[]
}
