import { supabaseAdmin } from './supabase'

export interface LinuxDoProfile {
  id: number
  sub: string
  username: string
  login: string
  name: string
  email: string
  avatar_template: string
  avatar_url: string
  active: boolean
  trust_level: number
  silenced: boolean
  external_ids: any
  api_key?: string
}

export interface UserProfile {
  id: string
  linuxDoId: string
  username: string
  displayName: string
  email: string
  avatarUrl: string
  trustLevel: number
  isActive: boolean
  isSilenced: boolean
  lastLoginAt: string
  loginCount: number
  createdAt: string
  updatedAt: string
}

export class UserManager {
  private supabase = supabaseAdmin

  // 创建或更新用户信息（OAuth登录时调用）
  async upsertUser(profile: LinuxDoProfile): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const linuxDoId = profile.id.toString()
      const now = new Date().toISOString()

      // 检查用户是否已存在
      const { data: existingUser, error: fetchError } = await this.supabase
        .from('users')
        .select('*')
        .eq('linux_do_id', linuxDoId)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        return { success: false, error: fetchError.message }
      }

      const userData = {
        linux_do_id: linuxDoId,
        username: profile.username,
        display_name: profile.name || profile.username,
        email: profile.email,
        avatar_url: profile.avatar_url,
        trust_level: profile.trust_level,
        is_active: profile.active,
        is_silenced: profile.silenced,
        last_login_at: now,
        login_count: existingUser ? (existingUser.login_count || 0) + 1 : 1,
        updated_at: now
      }

      let result
      if (existingUser) {
        // 更新现有用户
        result = await this.supabase
          .from('users')
          .update(userData)
          .eq('id', existingUser.id)
          .select()
          .single()
      } else {
        // 创建新用户
        result = await this.supabase
          .from('users')
          .insert({
            ...userData,
            created_at: now
          })
          .select()
          .single()
      }

      if (result.error) {
        return { success: false, error: result.error.message }
      }

      const user = this.formatUserProfile(result.data)
      return { success: true, user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 根据ID获取用户信息
  async getUserById(userId: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      const user = this.formatUserProfile(data)
      return { success: true, user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 根据Linux.do ID获取用户信息
  async getUserByLinuxDoId(linuxDoId: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('linux_do_id', linuxDoId)
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      const user = this.formatUserProfile(data)
      return { success: true, user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 获取活跃用户统计
  async getActiveUsersStats(): Promise<{
    success: boolean;
    stats?: {
      totalUsers: number;
      activeUsers: number;
      newUsersToday: number;
      topContributors: any[];
    };
    error?: string
  }> {
    try {
      const today = new Date().toISOString().split('T')[0]

      // 总用户数
      const { count: totalUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // 活跃用户数
      const { count: activeUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // 今日新用户
      const { count: newUsersToday } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today)

      // 顶级贡献者（按共享Key数量）
      const { data: topContributors } = await this.supabase
        .from('users')
        .select(`
          id,
          username,
          display_name,
          avatar_url,
          trust_level,
          shared_keys!inner(id)
        `)
        .eq('is_active', true)
        .limit(10)

      return {
        success: true,
        stats: {
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          newUsersToday: newUsersToday || 0,
          topContributors: topContributors || []
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 更新用户最后登录时间
  async updateLastLogin(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

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

  // 格式化用户数据
  private formatUserProfile(data: any): UserProfile {
    return {
      id: data.id,
      linuxDoId: data.linux_do_id,
      username: data.username,
      displayName: data.display_name || data.username,
      email: data.email,
      avatarUrl: data.avatar_url,
      trustLevel: data.trust_level || 0,
      isActive: data.is_active,
      isSilenced: data.is_silenced,
      lastLoginAt: data.last_login_at,
      loginCount: data.login_count || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  }

  // 检查用户权限（基于信任等级）
  canUseSharedService(trustLevel: number): boolean {
    return trustLevel >= 1 && trustLevel <= 4 // 只有LV1-4可以使用共享服务
  }

  canShareKeys(trustLevel: number): boolean {
    return this.canUseSharedService(trustLevel) // 必须先能使用共享服务
  }

  canManageKeys(trustLevel: number): boolean {
    return this.canUseSharedService(trustLevel) // 必须先能使用共享服务
  }

  isVipUser(trustLevel: number): boolean {
    return trustLevel >= 3 && trustLevel <= 4 // VIP用户也必须在有效等级范围内
  }
}
