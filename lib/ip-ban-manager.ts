/**
 * IP封禁管理系统
 * 自动检测和封禁恶意IP地址
 */

import { supabaseAdmin } from './supabase';
import { logSecurityEvent } from './security-monitor';

export interface IPBanRecord {
  id?: string;
  ipAddress: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  bannedAt: string;
  expiresAt?: string;
  isActive: boolean;
  banType: 'manual' | 'automatic' | 'temporary';
  metadata?: Record<string, any>;
  createdBy?: string; // 管理员ID（手动封禁时）
}

export interface BanRule {
  eventType: string;
  threshold: number;
  timeWindow: number; // 分钟
  banDuration: number; // 分钟，0表示永久
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class IPBanManager {
  private static instance: IPBanManager;
  private bannedIPs = new Map<string, IPBanRecord>();
  private readonly CACHE_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟刷新缓存

  // 自动封禁规则配置
  private readonly AUTO_BAN_RULES: BanRule[] = [
    // 速率限制违规
    {
      eventType: 'rate_limit_exceeded',
      threshold: 5, // 降低到5次
      timeWindow: 10, // 10分钟内
      banDuration: 30, // 封禁30分钟
      severity: 'medium'
    },
    // 无效输入攻击
    {
      eventType: 'invalid_input',
      threshold: 20,
      timeWindow: 30,
      banDuration: 120, // 封禁2小时
      severity: 'medium'
    },
    // 未授权访问尝试
    {
      eventType: 'unauthorized_access',
      threshold: 5,
      timeWindow: 30,
      banDuration: 240, // 封禁4小时
      severity: 'high'
    },
    // 暴力破解尝试
    {
      eventType: 'brute_force_attempt',
      threshold: 3,
      timeWindow: 15,
      banDuration: 0, // 永久封禁
      severity: 'critical'
    },
    // 数据注入尝试
    {
      eventType: 'data_injection_attempt',
      threshold: 2,
      timeWindow: 60,
      banDuration: 0, // 永久封禁
      severity: 'critical'
    },
    // API滥用
    {
      eventType: 'api_abuse',
      threshold: 15,
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

  static getInstance(): IPBanManager {
    if (!IPBanManager.instance) {
      IPBanManager.instance = new IPBanManager();
    }
    return IPBanManager.instance;
  }

  /**
   * 检查IP是否被封禁
   */
  async isIPBanned(ipAddress: string): Promise<boolean> {
    // 首先检查缓存
    const cachedBan = this.bannedIPs.get(ipAddress);
    if (cachedBan) {
      // 检查是否过期
      if (cachedBan.expiresAt && new Date(cachedBan.expiresAt) < new Date()) {
        await this.unbanIP(ipAddress, 'expired');
        return false;
      }
      return cachedBan.isActive;
    }

    // 从数据库查询
    try {
      const { data: banRecord, error } = await supabaseAdmin
        .from('ip_bans')
        .select('*')
        .eq('ip_address', ipAddress)
        .eq('is_active', true)
        .single();

      if (error || !banRecord) {
        return false;
      }

      // 检查是否过期
      if (banRecord.expires_at && new Date(banRecord.expires_at) < new Date()) {
        await this.unbanIP(ipAddress, 'expired');
        return false;
      }

      // 更新缓存
      this.bannedIPs.set(ipAddress, {
        id: banRecord.id,
        ipAddress: banRecord.ip_address,
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
      console.error('Error checking IP ban status:', error);
      return false;
    }
  }

  /**
   * 手动封禁IP
   */
  async banIP(
    ipAddress: string,
    reason: string,
    duration: number = 0, // 0表示永久
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    adminId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date();
      const expiresAt = duration > 0 ? new Date(now.getTime() + duration * 60 * 1000) : null;

      const banRecord: IPBanRecord = {
        ipAddress,
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
        .from('ip_bans')
        .insert({
          ip_address: ipAddress,
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
      this.bannedIPs.set(ipAddress, banRecord);

      // 记录管理事件
      await logSecurityEvent({
        ipAddress,
        eventType: 'system_maintenance',
        severity: 'low',
        description: `IP manually banned: ${reason}`,
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
   * 自动封禁IP（基于安全事件）
   */
  async checkAndAutoBan(ipAddress: string): Promise<void> {
    try {
      // 检查是否已经被封禁
      if (await this.isIPBanned(ipAddress)) {
        return;
      }

      // 检查每个自动封禁规则
      for (const rule of this.AUTO_BAN_RULES) {
        const shouldBan = await this.checkBanRule(ipAddress, rule);
        if (shouldBan) {
          const reason = `Auto-banned for ${rule.eventType} (${rule.threshold} events in ${rule.timeWindow} minutes)`;

          await this.banIP(
            ipAddress,
            reason,
            rule.banDuration,
            rule.severity
          );

          // 记录自动封禁事件
          await logSecurityEvent({
            ipAddress,
            eventType: 'system_maintenance',
            severity: 'medium',
            description: `IP automatically banned: ${reason}`,
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
      console.error('Error in auto-ban check:', error);
    }
  }

  /**
   * 检查是否满足封禁规则
   */
  private async checkBanRule(ipAddress: string, rule: BanRule): Promise<boolean> {
    try {
      const timeWindow = new Date(Date.now() - rule.timeWindow * 60 * 1000);

      const { data: events, error } = await supabaseAdmin
        .from('security_events')
        .select('id')
        .eq('ip_address', ipAddress)
        .eq('event_type', rule.eventType)
        .gte('created_at', timeWindow.toISOString());

      if (error) {
        console.error('Error checking ban rule:', error);
        return false;
      }

      return events.length >= rule.threshold;
    } catch (error) {
      console.error('Error in checkBanRule:', error);
      return false;
    }
  }

  /**
   * 解封IP
   */
  async unbanIP(ipAddress: string, reason: string = 'manual'): Promise<{ success: boolean; error?: string }> {
    try {
      // 更新数据库
      const { error } = await supabaseAdmin
        .from('ip_bans')
        .update({
          is_active: false,
          unbanned_at: new Date().toISOString(),
          unban_reason: reason
        })
        .eq('ip_address', ipAddress)
        .eq('is_active', true);

      if (error) {
        return { success: false, error: error.message };
      }

      // 更新缓存
      this.bannedIPs.delete(ipAddress);

      // 记录解封事件
      await logSecurityEvent({
        ipAddress,
        eventType: 'system_maintenance',
        severity: 'low',
        description: `IP unbanned: ${reason}`,
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
   * 获取封禁列表
   */
  async getBannedIPs(page: number = 1, limit: number = 50): Promise<{
    data: IPBanRecord[];
    total: number;
    error?: string;
  }> {
    try {
      const offset = (page - 1) * limit;

      // 获取总数
      const { count, error: countError } = await supabaseAdmin
        .from('ip_bans')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (countError) {
        return { data: [], total: 0, error: countError.message };
      }

      // 获取数据
      const { data: bans, error } = await supabaseAdmin
        .from('ip_bans')
        .select('*')
        .eq('is_active', true)
        .order('banned_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return { data: [], total: 0, error: error.message };
      }

      const banRecords: IPBanRecord[] = bans.map(ban => ({
        id: ban.id,
        ipAddress: ban.ip_address,
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
        .from('ip_bans')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error refreshing ban cache:', error);
        return;
      }

      // 清空旧缓存
      this.bannedIPs.clear();

      // 重新填充缓存
      for (const ban of bans) {
        // 检查是否过期
        if (ban.expires_at && new Date(ban.expires_at) < new Date()) {
          await this.unbanIP(ban.ip_address, 'expired');
          continue;
        }

        this.bannedIPs.set(ban.ip_address, {
          id: ban.id,
          ipAddress: ban.ip_address,
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
      console.error('Error refreshing ban cache:', error);
    }
  }

  /**
   * 获取封禁统计信息
   */
  async getBanStats(): Promise<{
    totalActive: number;
    totalExpired: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentBans: number;
  }> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { data: stats, error } = await supabaseAdmin
        .from('ip_bans')
        .select('ban_type, severity, is_active, banned_at');

      if (error) {
        throw error;
      }

      const result = {
        totalActive: 0,
        totalExpired: 0,
        byType: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        recentBans: 0
      };

      for (const ban of stats) {
        if (ban.is_active) {
          result.totalActive++;
        } else {
          result.totalExpired++;
        }

        result.byType[ban.ban_type] = (result.byType[ban.ban_type] || 0) + 1;
        result.bySeverity[ban.severity] = (result.bySeverity[ban.severity] || 0) + 1;

        if (new Date(ban.banned_at) > oneDayAgo) {
          result.recentBans++;
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting ban stats:', error);
      return {
        totalActive: 0,
        totalExpired: 0,
        byType: {},
        bySeverity: {},
        recentBans: 0
      };
    }
  }
}

// 导出单例实例
export const ipBanManager = IPBanManager.getInstance();
