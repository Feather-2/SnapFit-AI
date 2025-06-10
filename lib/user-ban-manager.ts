/**
 * 用户封禁管理系统
 * 管理用户账户的封禁和限制
 */

import { supabaseAdmin } from './supabase';
import { logSecurityEvent } from './security-monitor';

export interface UserBanRecord {
  id?: string;
  userId: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  bannedAt: string;
  expiresAt?: string;
  isActive: boolean;
  banType: 'manual' | 'automatic' | 'temporary';
  metadata?: Record<string, any>;
  createdBy?: string; // 管理员ID（手动封禁时）
}

export interface UserBanRule {
  eventType: string;
  threshold: number;
  timeWindow: number; // 分钟
  banDuration: number; // 分钟，0表示永久
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class UserBanManager {
  private static instance: UserBanManager;
  private bannedUsers = new Map<string, UserBanRecord>();
  private readonly CACHE_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟刷新缓存

  // 自动封禁规则配置
  private readonly AUTO_BAN_RULES: UserBanRule[] = [
    // 速率限制违规（用户级别）
    {
      eventType: 'rate_limit_exceeded',
      threshold: 3, // 降低到3次，比IP封禁更严格
      timeWindow: 15, // 15分钟内
      banDuration: 60, // 封禁1小时
      severity: 'medium'
    },
    // 无效输入攻击
    {
      eventType: 'invalid_input',
      threshold: 15,
      timeWindow: 60,
      banDuration: 120, // 封禁2小时
      severity: 'medium'
    },
    // 未授权访问尝试
    {
      eventType: 'unauthorized_access',
      threshold: 3,
      timeWindow: 30,
      banDuration: 240, // 封禁4小时
      severity: 'high'
    },
    // 暴力破解尝试
    {
      eventType: 'brute_force_attempt',
      threshold: 2,
      timeWindow: 15,
      banDuration: 0, // 永久封禁
      severity: 'critical'
    },
    // 数据注入尝试
    {
      eventType: 'data_injection_attempt',
      threshold: 1,
      timeWindow: 60,
      banDuration: 0, // 永久封禁
      severity: 'critical'
    },
    // API滥用
    {
      eventType: 'api_abuse',
      threshold: 20,
      timeWindow: 60,
      banDuration: 180, // 封禁3小时
      severity: 'high'
    }
  ];

  constructor() {
    // 定期刷新缓存
    setInterval(() => {
      this.refreshBanCache();
    }, this.CACHE_REFRESH_INTERVAL);

    // 初始化时加载封禁列表
    this.refreshBanCache();
  }

  static getInstance(): UserBanManager {
    if (!UserBanManager.instance) {
      UserBanManager.instance = new UserBanManager();
    }
    return UserBanManager.instance;
  }

  /**
   * 检查用户是否被封禁
   */
  async isUserBanned(userId: string): Promise<boolean> {
    // 首先检查缓存
    const cachedBan = this.bannedUsers.get(userId);
    if (cachedBan) {
      // 检查是否过期
      if (cachedBan.expiresAt && new Date(cachedBan.expiresAt) < new Date()) {
        await this.unbanUser(userId, 'expired');
        return false;
      }
      return cachedBan.isActive;
    }

    // 从数据库查询
    try {
      const { data: banRecord, error } = await supabaseAdmin
        .from('user_bans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !banRecord) {
        return false;
      }

      // 检查是否过期
      if (banRecord.expires_at && new Date(banRecord.expires_at) < new Date()) {
        await this.unbanUser(userId, 'expired');
        return false;
      }

      // 更新缓存
      this.bannedUsers.set(userId, {
        id: banRecord.id,
        userId: banRecord.user_id,
        reason: banRecord.reason,
        severity: banRecord.severity,
        bannedAt: banRecord.banned_at,
        expiresAt: banRecord.expires_at,
        isActive: banRecord.is_active,
        banType: banRecord.ban_type,
        metadata: banRecord.metadata,
        createdBy: banRecord.created_by
      });

      return true;
    } catch (error) {
      console.error('Error checking user ban status:', error);
      return false;
    }
  }

  /**
   * 手动封禁用户
   */
  async banUser(
    userId: string,
    reason: string,
    duration: number = 0, // 0表示永久
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    adminId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date();
      const expiresAt = duration > 0 ? new Date(now.getTime() + duration * 60 * 1000) : null;

      const banRecord: UserBanRecord = {
        userId,
        reason,
        severity,
        bannedAt: now.toISOString(),
        expiresAt: expiresAt?.toISOString(),
        isActive: true,
        banType: 'manual',
        createdBy: adminId
      };

      // 保存到数据库
      const { data, error } = await supabaseAdmin
        .from('user_bans')
        .insert({
          user_id: userId,
          reason,
          severity,
          banned_at: now.toISOString(),
          expires_at: expiresAt?.toISOString(),
          is_active: true,
          ban_type: 'manual',
          created_by: adminId
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // 更新缓存
      banRecord.id = data.id;
      this.bannedUsers.set(userId, banRecord);

      // 记录管理事件
      await logSecurityEvent({
        userId,
        ipAddress: '0.0.0.0', // 用户封禁不依赖IP
        eventType: 'system_maintenance',
        severity: 'low',
        description: `User manually banned: ${reason}`,
        metadata: {
          banType: 'manual',
          duration,
          adminId
        }
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 自动封禁用户（基于安全事件）
   */
  async checkAndAutoBan(userId: string): Promise<void> {
    if (!userId) return;

    try {
      // 检查是否已经被封禁
      if (await this.isUserBanned(userId)) {
        return;
      }

      // 检查每个自动封禁规则
      for (const rule of this.AUTO_BAN_RULES) {
        const shouldBan = await this.checkBanRule(userId, rule);
        if (shouldBan) {
          const reason = `Auto-banned for ${rule.eventType} (${rule.threshold} events in ${rule.timeWindow} minutes)`;

          await this.banUser(
            userId,
            reason,
            rule.banDuration,
            rule.severity
          );

          // 记录自动封禁事件
          await logSecurityEvent({
            userId,
            ipAddress: '0.0.0.0',
            eventType: 'system_maintenance',
            severity: 'medium',
            description: `User automatically banned: ${reason}`,
            metadata: {
              banType: 'automatic',
              rule: rule,
              duration: rule.banDuration
            }
          });

          break; // 只执行第一个匹配的规则
        }
      }
    } catch (error) {
      console.error('Error in user auto-ban check:', error);
    }
  }

  /**
   * 检查是否满足封禁规则
   */
  private async checkBanRule(userId: string, rule: UserBanRule): Promise<boolean> {
    try {
      const timeWindow = new Date(Date.now() - rule.timeWindow * 60 * 1000);

      const { data: events, error } = await supabaseAdmin
        .from('security_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', rule.eventType)
        .gte('created_at', timeWindow.toISOString());

      if (error) {
        console.error('Error checking user ban rule:', error);
        return false;
      }

      return events.length >= rule.threshold;
    } catch (error) {
      console.error('Error in checkBanRule:', error);
      return false;
    }
  }

  /**
   * 解封用户
   */
  async unbanUser(userId: string, reason: string = 'manual'): Promise<{ success: boolean; error?: string }> {
    try {
      // 更新数据库
      const { error } = await supabaseAdmin
        .from('user_bans')
        .update({
          is_active: false,
          unbanned_at: new Date().toISOString(),
          unban_reason: reason
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        return { success: false, error: error.message };
      }

      // 更新缓存
      this.bannedUsers.delete(userId);

      // 记录解封事件
      await logSecurityEvent({
        userId,
        ipAddress: '0.0.0.0',
        eventType: 'system_maintenance',
        severity: 'low',
        description: `User unbanned: ${reason}`,
        metadata: { unbanReason: reason }
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取用户封禁详情
   */
  async getBanDetails(userId: string): Promise<{ success: boolean; data?: UserBanRecord; error?: string }> {
    try {
      const { data: banRecord, error } = await supabaseAdmin
        .from('user_bans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !banRecord) {
        return { success: false, error: 'No active ban found' };
      }

      return {
        success: true,
        data: {
          id: banRecord.id,
          userId: banRecord.user_id,
          reason: banRecord.reason,
          severity: banRecord.severity,
          bannedAt: banRecord.banned_at,
          expiresAt: banRecord.expires_at,
          isActive: banRecord.is_active,
          banType: banRecord.ban_type,
          metadata: banRecord.metadata,
          createdBy: banRecord.created_by
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取被封禁用户列表
   */
  async getBannedUsers(page: number = 1, limit: number = 50): Promise<{
    data: UserBanRecord[];
    total: number;
    error?: string;
  }> {
    try {
      const offset = (page - 1) * limit;

      // 获取总数
      const { count, error: countError } = await supabaseAdmin
        .from('user_bans')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (countError) {
        return { data: [], total: 0, error: countError.message };
      }

      // 获取数据
      const { data: bans, error } = await supabaseAdmin
        .from('user_bans')
        .select('*')
        .eq('is_active', true)
        .order('banned_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return { data: [], total: 0, error: error.message };
      }

      const banRecords: UserBanRecord[] = bans.map(ban => ({
        id: ban.id,
        userId: ban.user_id,
        reason: ban.reason,
        severity: ban.severity,
        bannedAt: ban.banned_at,
        expiresAt: ban.expires_at,
        isActive: ban.is_active,
        banType: ban.ban_type,
        metadata: ban.metadata,
        createdBy: ban.created_by
      }));

      return {
        data: banRecords,
        total: count || 0
      };
    } catch (error) {
      return {
        data: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 刷新封禁缓存
   */
  private async refreshBanCache(): Promise<void> {
    try {
      const { data: bans, error } = await supabaseAdmin
        .from('user_bans')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error refreshing user ban cache:', error);
        return;
      }

      // 清空旧缓存
      this.bannedUsers.clear();

      // 重新填充缓存
      for (const ban of bans) {
        // 检查是否过期
        if (ban.expires_at && new Date(ban.expires_at) < new Date()) {
          await this.unbanUser(ban.user_id, 'expired');
          continue;
        }

        this.bannedUsers.set(ban.user_id, {
          id: ban.id,
          userId: ban.user_id,
          reason: ban.reason,
          severity: ban.severity,
          bannedAt: ban.banned_at,
          expiresAt: ban.expires_at,
          isActive: ban.is_active,
          banType: ban.ban_type,
          metadata: ban.metadata,
          createdBy: ban.created_by
        });
      }
    } catch (error) {
      console.error('Error refreshing user ban cache:', error);
    }
  }
}

// 导出单例实例
export const userBanManager = UserBanManager.getInstance();
