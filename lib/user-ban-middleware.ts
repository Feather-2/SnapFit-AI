/**
 * 用户封禁中间件
 * 检查用户是否被封禁，如果被封禁则阻止访问
 */

import { NextRequest, NextResponse } from 'next/server';
import { userBanManager } from './user-ban-manager';
import { auth } from './auth';

/**
 * 检查用户封禁状态的中间件函数
 */
export async function checkUserBan(req: NextRequest): Promise<NextResponse | null> {
  try {
    // 获取用户会话
    const session = await auth();
    
    // 如果没有登录，不需要检查用户封禁
    if (!session?.user?.id) {
      return null;
    }

    const userId = session.user.id;

    // 检查用户是否被封禁
    const isBanned = await userBanManager.isUserBanned(userId);
    
    if (isBanned) {
      // 获取封禁详情
      const { data: banDetails } = await userBanManager.getBanDetails(userId);
      
      return NextResponse.json(
        {
          error: 'Account banned',
          code: 'USER_BANNED',
          message: 'Your account has been banned due to policy violations.',
          banDetails: {
            reason: banDetails?.reason || 'Policy violation',
            severity: banDetails?.severity || 'medium',
            bannedAt: banDetails?.bannedAt,
            expiresAt: banDetails?.expiresAt,
            isPermanent: !banDetails?.expiresAt
          }
        },
        {
          status: 403,
          headers: {
            'X-Ban-Status': 'banned',
            'X-Ban-Type': 'user',
            'X-Ban-Reason': banDetails?.reason || 'policy_violation'
          }
        }
      );
    }

    return null; // 用户未被封禁，继续处理请求
  } catch (error) {
    console.error('Error checking user ban status:', error);
    // 出错时不阻止请求，但记录错误
    return null;
  }
}

/**
 * API路由的用户封禁检查装饰器
 */
export function withUserBanCheck(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // 先检查用户封禁状态
    const banResponse = await checkUserBan(req);
    if (banResponse) {
      return banResponse;
    }

    // 如果没有被封禁，继续执行原始处理器
    return handler(req);
  };
}

/**
 * 检查特定用户是否被封禁（用于服务端组件）
 */
export async function isUserBannedServer(userId: string): Promise<{
  isBanned: boolean;
  banDetails?: {
    reason: string;
    severity: string;
    bannedAt: string;
    expiresAt?: string;
    isPermanent: boolean;
  };
}> {
  try {
    const isBanned = await userBanManager.isUserBanned(userId);
    
    if (!isBanned) {
      return { isBanned: false };
    }

    const { data: banDetails } = await userBanManager.getBanDetails(userId);
    
    return {
      isBanned: true,
      banDetails: {
        reason: banDetails?.reason || 'Policy violation',
        severity: banDetails?.severity || 'medium',
        bannedAt: banDetails?.bannedAt || new Date().toISOString(),
        expiresAt: banDetails?.expiresAt,
        isPermanent: !banDetails?.expiresAt
      }
    };
  } catch (error) {
    console.error('Error checking user ban status:', error);
    return { isBanned: false };
  }
}
