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
  availableModels: string[]
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
      return CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8)
  }

  // 公共解密方法（用于定时任务等外部调用）
  public decryptApiKeyPublic(encryptedKey: string): string {
      return this.decryptApiKey(encryptedKey)
  }

  // 添加共享Key
  async checkDuplicateKey(userId: string, baseUrl: string, apiKey: string): Promise<{ exists: boolean; keyId?: string }> {
    try {
      // 加密API Key用于比较
      const encryptedKey = this.encryptApiKey(apiKey)

      const { data, error } = await this.supabase
        .from('shared_keys')
        .select('id')
        .eq('user_id', userId)
        .eq('base_url', baseUrl)
        .eq('api_key_encrypted', encryptedKey)
        .limit(1)

      if (error) {
        console.error('Error checking duplicate key:', error)
        return { exists: false }
      }

      return { exists: data.length > 0, keyId: data[0]?.id }
    } catch (error) {
      console.error('Exception in checkDuplicateKey:', error)
      return { exists: false }
    }
  }

  async addSharedKey(config: Omit<SharedKeyConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
      // 加密API Key
      const encryptedKey = this.encryptApiKey(config.apiKey)

      const insertData = {
        user_id: config.userId,
        name: config.name,
        base_url: config.baseUrl,
        api_key_encrypted: encryptedKey,
        available_models: config.availableModels,
        daily_limit: config.dailyLimit,
        description: config.description || '',
        tags: config.tags || [],
        is_active: config.isActive,
        usage_count_today: 0,
        total_usage_count: 0
      }

      const { data, error } = await this.supabase
        .from('shared_keys')
        .insert(insertData)
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

  // 检查并自动重置共享密钥（如果需要）
  private async checkAndAutoReset(): Promise<void> {
    try {
      // 获取当前UTC日期
      const currentDate = new Date().toISOString().split('T')[0];

      // 检查是否有密钥需要重置（updated_at不是今天且usage_count_today > 0）
      const { data: keysNeedReset, error } = await this.supabase
        .from('shared_keys')
        .select('id, name, usage_count_today, updated_at')
        .eq('is_active', true)
        .gt('usage_count_today', 0)
        .lt('updated_at', currentDate + 'T00:00:00Z');

      if (error) {
        console.error('Error checking keys for reset:', error);
        return;
      }

      if (keysNeedReset && keysNeedReset.length > 0) {
        console.log(`🔄 Auto-resetting ${keysNeedReset.length} shared keys for new day`);

        // 重置这些密钥
        const { error: resetError } = await this.supabase
          .from('shared_keys')
          .update({
            usage_count_today: 0,
            updated_at: new Date().toISOString()
          })
          .in('id', keysNeedReset.map(k => k.id));

        if (resetError) {
          console.error('Error auto-resetting keys:', resetError);
        } else {
          console.log(`✅ Successfully auto-reset ${keysNeedReset.length} shared keys`);
        }
      }
    } catch (error) {
      console.error('Error in auto-reset check:', error);
    }
  }

  // 获取一个可用的、经过负载均衡的Key
  async getAvailableKey(
    modelName?: string,
    selectedKeyIds?: string[]
  ): Promise<{ key: SharedKeyConfig | null; error?: string }> {

    // 首先检查并自动重置（如果需要）
    await this.checkAndAutoReset();

    // 如果用户指定了一个或多个Key ID，则在这些Key中进行选择
    if (selectedKeyIds && selectedKeyIds.length > 0) {
      const { data: specificKeys, error } = await this.supabase
        .from('shared_keys')
        .select('*')
        .in('id', selectedKeyIds)
        .eq('is_active', true);

      if (error || !specificKeys || specificKeys.length === 0) {
        return { key: null, error: `指定的共享Key (IDs: ${selectedKeyIds.join(', ')}) 均不可用或不存在。` };
      }

      // 过滤出支持所需模型的keys
      const suitableKeys = modelName
        ? specificKeys.filter(k => k.available_models && k.available_models.includes(modelName))
        : specificKeys;

      if (suitableKeys.length === 0) {
         return { key: null, error: `指定的共享Key中没有支持模型: ${modelName} 的。` };
      }

      // 过滤掉已达到每日限制的Key（999999表示无限制）
      const availableKeys = suitableKeys.filter(key =>
        key.daily_limit === 999999 || (key.usage_count_today || 0) < (key.daily_limit || 150)
      )

      if (availableKeys.length === 0) {
        return { key: null, error: `指定的共享Key都已达到每日调用限制。` }
      }

      // 在可用的key中进行负载均衡（例如，随机选择一个）
      const selectedKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];

      return {
        key: {
          ...selectedKey,
          apiKey: this.decryptApiKey(selectedKey.api_key_encrypted)
        }
      };
    }

    // --- 如果没有指定Key，则执行基于模型的负载均衡逻辑 ---

    if (!modelName) {
      return { key: null, error: '必须提供模型名称或指定的Key ID才能获取Key。' };
    }

    const { data: keys, error } = await this.supabase
      .from("shared_keys")
      .select('*')
      .eq('is_active', true)
      // 使用 contains 操作符检查 available_models 数组
      .contains('available_models', [modelName])
      .order("last_used_at", { ascending: true }) // LRU 负载均衡
      .limit(10) // 限制候选池大小

    if (error || !keys || keys.length === 0) {
      return { key: null, error: `没有找到支持模型 "${modelName}" 的可用共享Key。` }
    }

    // 过滤掉已达到每日限制的Key（999999表示无限制）
    const availableKeys = keys.filter(key =>
      key.daily_limit === 999999 || (key.usage_count_today || 0) < (key.daily_limit || 150)
    )

    if (availableKeys.length === 0) {
      return { key: null, error: `所有支持模型 "${modelName}" 的共享Key都已达到每日调用限制。` }
    }

    const keyData = availableKeys[0];

    // 解密API Key
    const decryptedKey: SharedKeyConfig = {
      id: keyData.id,
      userId: keyData.user_id,
      name: keyData.name,
      baseUrl: keyData.base_url,
      apiKey: this.decryptApiKey(keyData.api_key_encrypted),
      availableModels: keyData.available_models || [],
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
  }

  // 记录Key使用
  async logKeyUsage(keyId: string, usage: KeyUsageLog): Promise<{ success: boolean; error?: string }> {
    try {
      // 注意：key_usage_logs 表已删除以节省存储空间
      // 现在只更新 shared_keys 表的使用统计，不记录详细日志

      // 静默处理：不记录详细日志，避免错误信息
      // 详细的使用统计通过 daily_logs 表的 UsageManager 处理

      // 更新Key使用统计
      if (usage.success) {
        // 先获取当前的统计数据
        const { data: currentKey, error: fetchError } = await this.supabase
          .from('shared_keys')
          .select('usage_count_today, total_usage_count')
          .eq('id', keyId)
          .single();

        if (fetchError) {
          return { success: false, error: `Failed to fetch key for update: ${fetchError.message}` };
        }

        // 在代码中增加计数
        const updatedUsageCountToday = (currentKey.usage_count_today || 0) + 1;
        const updatedTotalUsageCount = (currentKey.total_usage_count || 0) + 1;

        const { error: updateError } = await this.supabase
          .from('shared_keys')
          .update({
            usage_count_today: updatedUsageCountToday,
            total_usage_count: updatedTotalUsageCount,
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
        availableModels: keyData.available_models || [],
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

  // 验证Key的所有者
  async verifyKeyOwner(keyId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('shared_keys')
        .select('user_id')
        .eq('id', keyId)
        .single();

      if (error || !data) {
        return false;
      }

      return data.user_id === userId;
    } catch (error) {
      return false;
    }
  }



  // 删除共享Key
  async deleteSharedKey(keyId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 如果提供了 userId，验证所有权
      if (userId) {
        const { data: keyData, error: fetchError } = await this.supabase
          .from('shared_keys')
          .select('user_id')
          .eq('id', keyId)
          .single()

        if (fetchError) {
          return { success: false, error: 'Key not found' }
        }

        if (keyData.user_id !== userId) {
          return { success: false, error: 'Unauthorized to delete this key' }
        }
      }

      const { error } = await this.supabase
        .from('shared_keys')
        .delete()
        .eq('id', keyId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

  // 获取使用排行榜
  async getUsageLeaderboard(): Promise<{ success: boolean; keys?: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('shared_keys')
        .select(`
          id,
          name,
          base_url,
          available_models,
          daily_limit,
          description,
          tags,
          is_active,
          usage_count_today,
          total_usage_count,
          created_at,
          users!inner(id, username, display_name, avatar_url, trust_level)
        `)
        .eq('is_active', true)
        .order('total_usage_count', { ascending: false })
        .limit(50)

      if (error) {
        return { success: false, error: error.message }
      }

      const keys = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        baseUrl: item.base_url,
        availableModels: item.available_models,
        dailyLimit: item.daily_limit,
        description: item.description,
        tags: item.tags || [],
        isActive: item.is_active,
        usageCountToday: item.usage_count_today,
        totalUsageCount: item.total_usage_count,
        createdAt: item.created_at,
        user: {
          id: item.users.id,
          username: item.users.username,
          displayName: item.users.display_name,
          avatarUrl: item.users.avatar_url,
          trustLevel: item.users.trust_level
        },
        // TODO: 添加模型健康状态检查
        modelHealth: []
      }))

      return { success: true, keys }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 获取用户自己的所有配置
  async getMyConfigurations(userId: string): Promise<{ success: boolean; keys?: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('shared_keys')
        .select(`
          id,
          name,
          base_url,
          available_models,
          daily_limit,
          description,
          tags,
          is_active,
          usage_count_today,
          total_usage_count,
          created_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { success: false, error: error.message }
      }

      const keys = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        baseUrl: item.base_url,
        availableModels: item.available_models,
        dailyLimit: item.daily_limit,
        description: item.description,
        tags: item.tags || [],
        isActive: item.is_active,
        usageCountToday: item.usage_count_today,
        totalUsageCount: item.total_usage_count,
        createdAt: item.created_at,
        // TODO: 添加模型健康状态检查
        modelHealth: []
      }))

      return { success: true, keys }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 更新共享Key
  async updateSharedKey(keyId: string, userId: string, updates: any): Promise<{ success: boolean; error?: string }> {
    try {
      // 验证所有权
      const { data: keyData, error: fetchError } = await this.supabase
        .from('shared_keys')
        .select('user_id')
        .eq('id', keyId)
        .single()

      if (fetchError) {
        return { success: false, error: 'Key not found' }
      }

      if (keyData.user_id !== userId) {
        return { success: false, error: 'Unauthorized to update this key' }
      }

      // 更新数据
      const { error } = await this.supabase
        .from('shared_keys')
        .update(updates)
        .eq('id', keyId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
