/**
 * 安全事件增强器
 * 用于补充和关联安全事件中缺失的用户信息
 */

import { supabaseAdmin } from './supabase';

export interface SecurityEventUpdate {
  eventId?: string;
  ipAddress?: string;
  userId?: string;
  timeWindow?: number; // 分钟
}

export class SecurityEventEnhancer {
  private static instance: SecurityEventEnhancer;

  static getInstance(): SecurityEventEnhancer {
    if (!SecurityEventEnhancer.instance) {
      SecurityEventEnhancer.instance = new SecurityEventEnhancer();
    }
    return SecurityEventEnhancer.instance;
  }

  /**
   * 为最近的安全事件补充用户ID
   * 当用户在API中进行操作时，回溯关联最近的安全事件
   */
  async enhanceRecentEvents(userId: string, ipAddress: string, timeWindow: number = 5): Promise<number> {
    try {
      const windowStart = new Date(Date.now() - timeWindow * 60 * 1000);

      // 查找最近时间窗口内，相同IP但缺少用户ID的安全事件
      const { data: events, error } = await supabaseAdmin
        .from('security_events')
        .select('id, created_at, event_type')
        .eq('ip_address', ipAddress)
        .is('user_id', null)
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false });

      if (error || !events || events.length === 0) {
        return 0;
      }

      // 更新这些事件，添加用户ID
      const eventIds = events.map(event => event.id);
      
      const { error: updateError } = await supabaseAdmin
        .from('security_events')
        .update({ 
          user_id: userId,
          metadata: supabaseAdmin.raw(`
            COALESCE(metadata, '{}'::jsonb) || 
            '{"enhanced": true, "enhanced_at": "${new Date().toISOString()}", "enhancement_reason": "user_activity_correlation"}'::jsonb
          `)
        })
        .in('id', eventIds);

      if (updateError) {
        console.error('Error enhancing security events:', updateError);
        return 0;
      }

      // 记录增强操作
      await this.logEnhancementActivity(userId, ipAddress, events.length, timeWindow);

      return events.length;
    } catch (error) {
      console.error('Error in enhanceRecentEvents:', error);
      return 0;
    }
  }

  /**
   * 基于用户活动模式关联安全事件
   * 分析用户的IP使用模式，关联可能的安全事件
   */
  async correlateUserActivity(userId: string): Promise<{
    enhanced: number;
    patterns: Array<{
      ipAddress: string;
      eventCount: number;
      timeRange: string;
    }>;
  }> {
    try {
      // 获取用户最近的活动IP
      const { data: userActivity, error: activityError } = await supabaseAdmin
        .from('security_events')
        .select('ip_address, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (activityError || !userActivity) {
        return { enhanced: 0, patterns: [] };
      }

      // 分析IP使用模式
      const ipPatterns = new Map<string, { count: number; firstSeen: Date; lastSeen: Date }>();
      
      for (const activity of userActivity) {
        const ip = activity.ip_address;
        const timestamp = new Date(activity.created_at);
        
        if (!ipPatterns.has(ip)) {
          ipPatterns.set(ip, { count: 1, firstSeen: timestamp, lastSeen: timestamp });
        } else {
          const pattern = ipPatterns.get(ip)!;
          pattern.count++;
          if (timestamp < pattern.firstSeen) pattern.firstSeen = timestamp;
          if (timestamp > pattern.lastSeen) pattern.lastSeen = timestamp;
        }
      }

      let totalEnhanced = 0;
      const patterns: Array<{ ipAddress: string; eventCount: number; timeRange: string }> = [];

      // 为每个IP模式关联安全事件
      for (const [ipAddress, pattern] of ipPatterns) {
        if (pattern.count >= 3) { // 只处理有足够活动的IP
          const enhanced = await this.enhanceEventsByIPPattern(
            userId, 
            ipAddress, 
            pattern.firstSeen, 
            pattern.lastSeen
          );
          
          totalEnhanced += enhanced;
          
          if (enhanced > 0) {
            patterns.push({
              ipAddress,
              eventCount: enhanced,
              timeRange: `${pattern.firstSeen.toISOString()} - ${pattern.lastSeen.toISOString()}`
            });
          }
        }
      }

      return { enhanced: totalEnhanced, patterns };
    } catch (error) {
      console.error('Error in correlateUserActivity:', error);
      return { enhanced: 0, patterns: [] };
    }
  }

  /**
   * 基于IP模式增强安全事件
   */
  private async enhanceEventsByIPPattern(
    userId: string, 
    ipAddress: string, 
    startTime: Date, 
    endTime: Date
  ): Promise<number> {
    try {
      // 查找时间范围内相同IP但缺少用户ID的事件
      const { data: events, error } = await supabaseAdmin
        .from('security_events')
        .select('id')
        .eq('ip_address', ipAddress)
        .is('user_id', null)
        .gte('created_at', startTime.toISOString())
        .lte('created_at', endTime.toISOString());

      if (error || !events || events.length === 0) {
        return 0;
      }

      // 更新事件
      const { error: updateError } = await supabaseAdmin
        .from('security_events')
        .update({ 
          user_id: userId,
          metadata: supabaseAdmin.raw(`
            COALESCE(metadata, '{}'::jsonb) || 
            '{"enhanced": true, "enhanced_at": "${new Date().toISOString()}", "enhancement_reason": "ip_pattern_correlation"}'::jsonb
          `)
        })
        .in('id', events.map(e => e.id));

      if (updateError) {
        console.error('Error updating events by IP pattern:', updateError);
        return 0;
      }

      return events.length;
    } catch (error) {
      console.error('Error in enhanceEventsByIPPattern:', error);
      return 0;
    }
  }

  /**
   * 记录增强操作活动
   */
  private async logEnhancementActivity(
    userId: string, 
    ipAddress: string, 
    enhancedCount: number, 
    timeWindow: number
  ): Promise<void> {
    try {
      await supabaseAdmin.from('security_events').insert({
        user_id: userId,
        ip_address: ipAddress,
        event_type: 'system_maintenance',
        severity: 'low',
        description: `Enhanced ${enhancedCount} security events with user correlation`,
        metadata: {
          enhancement_type: 'user_correlation',
          enhanced_count: enhancedCount,
          time_window_minutes: timeWindow,
          enhanced_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error logging enhancement activity:', error);
    }
  }

  /**
   * 获取增强统计信息
   */
  async getEnhancementStats(): Promise<{
    totalEnhanced: number;
    enhancedToday: number;
    byReason: Record<string, number>;
    recentEnhancements: Array<{
      userId: string;
      enhancedCount: number;
      enhancedAt: string;
      reason: string;
    }>;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 获取所有增强过的事件
      const { data: enhancedEvents, error } = await supabaseAdmin
        .from('security_events')
        .select('metadata, created_at, user_id')
        .not('metadata->enhanced', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        throw error;
      }

      const stats = {
        totalEnhanced: enhancedEvents?.length || 0,
        enhancedToday: 0,
        byReason: {} as Record<string, number>,
        recentEnhancements: [] as Array<{
          userId: string;
          enhancedCount: number;
          enhancedAt: string;
          reason: string;
        }>
      };

      const enhancementActivities = new Map<string, {
        userId: string;
        count: number;
        lastEnhanced: string;
        reason: string;
      }>();

      for (const event of enhancedEvents || []) {
        const metadata = event.metadata as any;
        const enhancedAt = new Date(metadata.enhanced_at);
        const reason = metadata.enhancement_reason || 'unknown';

        // 统计今天的增强数量
        if (enhancedAt >= today) {
          stats.enhancedToday++;
        }

        // 按原因统计
        stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;

        // 收集增强活动
        const key = `${event.user_id}-${reason}`;
        if (!enhancementActivities.has(key)) {
          enhancementActivities.set(key, {
            userId: event.user_id,
            count: 1,
            lastEnhanced: metadata.enhanced_at,
            reason
          });
        } else {
          const activity = enhancementActivities.get(key)!;
          activity.count++;
          if (metadata.enhanced_at > activity.lastEnhanced) {
            activity.lastEnhanced = metadata.enhanced_at;
          }
        }
      }

      // 转换为数组并排序
      stats.recentEnhancements = Array.from(enhancementActivities.values())
        .sort((a, b) => new Date(b.lastEnhanced).getTime() - new Date(a.lastEnhanced).getTime())
        .slice(0, 10)
        .map(activity => ({
          userId: activity.userId,
          enhancedCount: activity.count,
          enhancedAt: activity.lastEnhanced,
          reason: activity.reason
        }));

      return stats;
    } catch (error) {
      console.error('Error getting enhancement stats:', error);
      return {
        totalEnhanced: 0,
        enhancedToday: 0,
        byReason: {},
        recentEnhancements: []
      };
    }
  }
}

// 导出单例实例
export const securityEventEnhancer = SecurityEventEnhancer.getInstance();
