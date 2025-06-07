import { supabaseAdmin } from './supabase'
import { OpenAICompatibleClient } from './openai-client'
import * as CryptoJS from 'crypto-js'

// 加密密钥（实际使用时应该从环境变量获取）
const ENCRYPTION_KEY = process.env.KEY_ENCRYPTION_SECRET || 'your-secret-key'

export interface SharedKeyConfig {
  id?: string
  userId: string
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
  dailyLimit: number
  description?: string
  tags: string[]
  isActive: boolean
  usageCountToday: number
  totalUsageCount: number
  lastUsedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface KeyUsageLog {
  sharedKeyId: string
  userId: string
  apiEndpoint: string
  modelUsed: string
  tokensUsed?: number
  costEstimate?: number
  success: boolean
  errorMessage?: string
}

export class KeyManager {
  private supabase = supabaseAdmin

  // 加密API Key
  private encryptApiKey(apiKey: string): string {
    return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_KEY).toString()
  }

  // 解密API Key
  private decryptApiKey(encryptedKey: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  }

  // 添加共享Key
  async addSharedKey(config: Omit<SharedKeyConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
      // 加密API Key
      const encryptedKey = this.encryptApiKey(config.apiKey)

      const { data, error } = await this.supabase
        .from('shared_keys')
        .insert({
          user_id: config.userId,
          name: config.name,
          base_url: config.baseUrl,
          api_key_encrypted: encryptedKey,
          model_name: config.modelName,
          daily_limit: config.dailyLimit,
          description: config.description,
          tags: config.tags,
          is_active: config.isActive,
          usage_count_today: 0,
          total_usage_count: 0
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, id: data.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // 测试API Key是否有效
  async testApiKey(baseUrl: string, apiKey: string, modelName: string): Promise<{ success: boolean; error?: string; availableModels?: string[] }> {
    try {
      const client = new OpenAICompatibleClient(baseUrl, apiKey)
      
      // 尝试获取模型列表
      try {
        const models = await client.listModels()
        return { 
          success: true, 
          availableModels: models.data?.map((m: any) => m.id) || [modelName]
        }
      } catch (listError) {
        // 如果获取模型列表失败，尝试简单的聊天测试
        try {
          await client.generateText({
            model: modelName,
            prompt: "Hello",
            max_tokens: 5
          })
          return { success: true, availableModels: [modelName] }
        } catch (chatError) {
          return { 
            success: false, 
            error: `API测试失败: ${chatError instanceof Error ? chatError.message : 'Unknown error'}`
          }
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: `连接失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // 获取可用的Key（负载均衡）
  async getAvailableKey(modelName?: string): Promise<{ key: SharedKeyConfig | null; error?: string }> {
    try {
      let query = this.supabase
        .from('shared_keys')
        .select('*')
        .eq('is_active', true)
        .lt('usage_count_today', this.supabase.raw('daily_limit'))

      if (modelName) {
        query = query.eq('model_name', modelName)
      }

      const { data: keys, error } = await query
        .order('usage_count_today', { ascending: true }) // 优先使用使用次数少的Key
        .limit(1)

      if (error) {
        return { key: null, error: error.message }
      }

      if (!keys || keys.length === 0) {
        return { key: null, error: 'No available keys found' }
      }

      const keyData = keys[0]
      
      // 解密API Key
      const decryptedKey: SharedKeyConfig = {
        id: keyData.id,
        userId: keyData.user_id,
        name: keyData.name,
        baseUrl: keyData.base_url,
        apiKey: this.decryptApiKey(keyData.api_key_encrypted),
        modelName: keyData.model_name,
        dailyLimit: keyData.daily_limit,
        description: keyData.description,
        tags: keyData.tags || [],
        isActive: keyData.is_active,
        usageCountToday: keyData.usage_count_today,
        totalUsageCount: keyData.total_usage_count,
        lastUsedAt: keyData.last_used_at,
        createdAt: keyData.created_at,
        updatedAt: keyData.updated_at
      }

      return { key: decryptedKey }
    } catch (error) {
      return { 
        key: null, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 记录Key使用
  async logKeyUsage(keyId: string, usage: KeyUsageLog): Promise<{ success: boolean; error?: string }> {
    try {
      // 记录使用日志
      const { error: logError } = await this.supabase
        .from('key_usage_logs')
        .insert({
          shared_key_id: keyId,
          user_id: usage.userId,
          api_endpoint: usage.apiEndpoint,
          model_used: usage.modelUsed,
          tokens_used: usage.tokensUsed,
          cost_estimate: usage.costEstimate,
          success: usage.success,
          error_message: usage.errorMessage
        })

      if (logError) {
        console.error('Failed to log key usage:', logError)
      }

      // 更新Key使用统计
      if (usage.success) {
        const { error: updateError } = await this.supabase
          .from('shared_keys')
          .update({
            usage_count_today: this.supabase.raw('usage_count_today + 1'),
            total_usage_count: this.supabase.raw('total_usage_count + 1'),
            last_used_at: new Date().toISOString()
          })
          .eq('id', keyId)

        if (updateError) {
          return { success: false, error: updateError.message }
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 获取用户的Key列表
  async getUserKeys(userId: string): Promise<{ keys: SharedKeyConfig[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('shared_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { keys: [], error: error.message }
      }

      const keys: SharedKeyConfig[] = data.map((keyData: any) => ({
        id: keyData.id,
        userId: keyData.user_id,
        name: keyData.name,
        baseUrl: keyData.base_url,
        apiKey: this.decryptApiKey(keyData.api_key_encrypted),
        modelName: keyData.model_name,
        dailyLimit: keyData.daily_limit,
        description: keyData.description,
        tags: keyData.tags || [],
        isActive: keyData.is_active,
        usageCountToday: keyData.usage_count_today,
        totalUsageCount: keyData.total_usage_count,
        lastUsedAt: keyData.last_used_at,
        createdAt: keyData.created_at,
        updatedAt: keyData.updated_at
      }))

      return { keys }
    } catch (error) {
      return { 
        keys: [], 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 获取感谢榜数据
  async getThanksBoard(): Promise<{ contributors: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('shared_keys')
        .select(`
          user_id,
          users!inner(username, avatar_url),
          total_usage_count,
          daily_limit,
          is_active
        `)
        .eq('is_active', true)
        .order('total_usage_count', { ascending: false })
        .limit(20)

      if (error) {
        return { contributors: [], error: error.message }
      }

      const contributors = data.map((item: any) => ({
        userId: item.user_id,
        username: item.users.username,
        avatarUrl: item.users.avatar_url,
        totalContributions: item.total_usage_count,
        dailyLimit: item.daily_limit,
        isActive: item.is_active
      }))

      return { contributors }
    } catch (error) {
      return { 
        contributors: [], 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 重置每日使用计数（定时任务调用）
  async resetDailyUsage(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('shared_keys')
        .update({ usage_count_today: 0 })
        .neq('id', '')

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
