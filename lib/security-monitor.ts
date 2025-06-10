/**
 * 安全监控系统
 * 检测和记录可疑活动
 */

import { supabaseAdmin } from './supabase';
import { ipBanManager } from './ip-ban-manager';
import { userBanManager } from './user-ban-manager';

export interface SecurityEvent {
  id?: string;
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  eventType: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export type SecurityEventType =
  | 'rate_limit_exceeded'
  | 'invalid_input'
  | 'unauthorized_access'
  | 'suspicious_activity'
  | 'brute_force_attempt'
  | 'data_injection_attempt'
  | 'file_upload_violation'
  | 'api_abuse'
  | 'privilege_escalation_attempt'
  | 'system_maintenance';

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private suspiciousIPs = new Map<string, { count: number; lastSeen: number }>();
  private readonly SUSPICIOUS_THRESHOLD = 10; // 10次可疑活动后标记为可疑IP
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1小时清理一次

  constructor() {
    // 定期清理过期的可疑IP记录
    setInterval(() => {
      this.cleanupSuspiciousIPs();
    }, this.CLEANUP_INTERVAL);
  }

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * 记录安全事件
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const securityEvent: SecurityEvent = {
        ...event,
        timestamp: new Date().toISOString()
      };

      // 记录到数据库
      await this.saveToDatabase(securityEvent);

      // 更新可疑IP统计
      this.updateSuspiciousIPStats(event.ipAddress, event.severity);

      // 如果是高危事件，立即处理
      if (event.severity === 'critical' || event.severity === 'high') {
        await this.handleHighSeverityEvent(securityEvent);
      }

      // 🚨 检查是否需要自动封禁IP和用户
      if (event.severity === 'medium' || event.severity === 'high' || event.severity === 'critical') {
        // 异步执行自动封禁检查，不阻塞主流程
        setImmediate(async () => {
          try {
            // 检查IP封禁
            await ipBanManager.checkAndAutoBan(event.ipAddress);

            // 检查用户封禁（如果有用户ID）
            if (event.userId) {
              await userBanManager.checkAndAutoBan(event.userId);
            }
          } catch (error) {
            console.error('Error in auto-ban check:', error);
          }
        });
      }

      console.warn(`[Security] ${event.eventType}: ${event.description}`, {
        ip: event.ipAddress,
        userId: event.userId,
        severity: event.severity
      });

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * 检查IP是否可疑
   */
  isSuspiciousIP(ipAddress: string): boolean {
    const record = this.suspiciousIPs.get(ipAddress);
    return record ? record.count >= this.SUSPICIOUS_THRESHOLD : false;
  }

  /**
   * 获取IP的可疑活动计数
   */
  getSuspiciousActivityCount(ipAddress: string): number {
    const record = this.suspiciousIPs.get(ipAddress);
    return record ? record.count : 0;
  }

  /**
   * 检测可疑的用户行为模式
   */
  async detectSuspiciousPattern(userId: string, ipAddress: string): Promise<boolean> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // 查询最近1小时的安全事件
      const { data: recentEvents, error } = await supabaseAdmin
        .from('security_events')
        .select('event_type, severity, created_at')
        .or(`user_id.eq.${userId},ip_address.eq.${ipAddress}`)
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false });

      if (error || !recentEvents) {
        return false;
      }

      // 分析模式
      const eventCounts = recentEvents.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 检测可疑模式
      const suspiciousPatterns = [
        // 频繁的速率限制违规
        eventCounts['rate_limit_exceeded'] >= 5,
        // 多次无效输入尝试
        eventCounts['invalid_input'] >= 10,
        // 多次未授权访问尝试
        eventCounts['unauthorized_access'] >= 3,
        // 总事件数过多
        recentEvents.length >= 20
      ];

      return suspiciousPatterns.some(pattern => pattern);

    } catch (error) {
      console.error('Error detecting suspicious pattern:', error);
      return false;
    }
  }

  /**
   * 更新可疑IP统计
   */
  private updateSuspiciousIPStats(ipAddress: string, severity: string): void {
    const current = this.suspiciousIPs.get(ipAddress) || { count: 0, lastSeen: 0 };

    // 根据严重程度增加不同的计数
    const increment = severity === 'critical' ? 5 : severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;

    this.suspiciousIPs.set(ipAddress, {
      count: current.count + increment,
      lastSeen: Date.now()
    });
  }

  /**
   * 处理高危安全事件
   */
  private async handleHighSeverityEvent(event: SecurityEvent): Promise<void> {
    try {
      // 如果是关键事件，可以考虑自动封禁IP
      if (event.severity === 'critical') {
        await this.logSecurityEvent({
          ipAddress: event.ipAddress,
          userId: event.userId,
          eventType: 'suspicious_activity',
          severity: 'high',
          description: `Critical security event detected from IP ${event.ipAddress}`,
          metadata: { originalEvent: event }
        });
      }

      // 这里可以添加更多的自动响应措施，比如：
      // - 发送警报邮件
      // - 自动封禁IP
      // - 限制用户权限
      // - 触发额外的监控

    } catch (error) {
      console.error('Error handling high severity event:', error);
    }
  }

  /**
   * 清理过期的可疑IP记录
   */
  private cleanupSuspiciousIPs(): void {
    const now = Date.now();
    const expireTime = 24 * 60 * 60 * 1000; // 24小时

    for (const [ip, record] of this.suspiciousIPs.entries()) {
      if (now - record.lastSeen > expireTime) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }

  /**
   * 保存安全事件到数据库
   */
  private async saveToDatabase(event: SecurityEvent): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('security_events')
        .insert({
          user_id: event.userId || null,
          ip_address: event.ipAddress,
          user_agent: event.userAgent || null,
          event_type: event.eventType,
          severity: event.severity,
          description: event.description,
          metadata: event.metadata || {},
          created_at: event.timestamp
        });

      if (error) {
        console.error('Failed to save security event to database:', error);
      }
    } catch (error) {
      console.error('Database error when saving security event:', error);
    }
  }

  /**
   * 获取安全统计信息
   */
  async getSecurityStats(days: number = 7): Promise<any> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: events, error } = await supabaseAdmin
        .from('security_events')
        .select('event_type, severity, created_at, ip_address')
        .gte('created_at', startDate);

      if (error || !events) {
        return { error: 'Failed to fetch security stats' };
      }

      // 统计分析
      const stats = {
        totalEvents: events.length,
        eventsByType: {} as Record<string, number>,
        eventsBySeverity: {} as Record<string, number>,
        topSuspiciousIPs: {} as Record<string, number>,
        dailyTrends: {} as Record<string, number>
      };

      events.forEach(event => {
        // 按类型统计
        stats.eventsByType[event.event_type] = (stats.eventsByType[event.event_type] || 0) + 1;

        // 按严重程度统计
        stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;

        // 可疑IP统计
        stats.topSuspiciousIPs[event.ip_address] = (stats.topSuspiciousIPs[event.ip_address] || 0) + 1;

        // 每日趋势
        const date = event.created_at.split('T')[0];
        stats.dailyTrends[date] = (stats.dailyTrends[date] || 0) + 1;
      });

      return stats;

    } catch (error) {
      console.error('Error getting security stats:', error);
      return { error: 'Internal error' };
    }
  }
}

// 导出单例实例
export const securityMonitor = SecurityMonitor.getInstance();

// 便捷的日志记录函数
export const logSecurityEvent = (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => {
  return securityMonitor.logSecurityEvent(event);
};
