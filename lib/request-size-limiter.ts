/**
 * 请求大小限制器
 * 防止超大请求体攻击
 */

import { NextRequest, NextResponse } from 'next/server';
import { logSecurityEvent } from './security-monitor';
import { getClientIP } from './ip-utils';

// 不同API的大小限制配置（字节）
const SIZE_LIMITS = {
  // 默认限制：1MB
  default: 1 * 1024 * 1024,
  
  // 设置相关API：较小限制
  settings: 100 * 1024, // 100KB
  
  // 共享密钥API：中等限制
  'shared-keys': 50 * 1024, // 50KB
  
  // 聊天API：较大限制（支持图片）
  chat: 10 * 1024 * 1024, // 10MB
  
  // 上传API：最大限制
  upload: 50 * 1024 * 1024, // 50MB
  
  // 管理API：小限制
  admin: 200 * 1024, // 200KB
  
  // 同步API：小限制
  sync: 500 * 1024, // 500KB
  
  // AI API：大限制
  ai: 5 * 1024 * 1024, // 5MB
} as const;

/**
 * 获取API路径对应的大小限制
 */
function getSizeLimit(pathname: string): number {
  if (pathname.includes('/settings')) return SIZE_LIMITS.settings;
  if (pathname.includes('/shared-keys')) return SIZE_LIMITS['shared-keys'];
  if (pathname.includes('/chat') || pathname.includes('/openai')) return SIZE_LIMITS.chat;
  if (pathname.includes('/upload')) return SIZE_LIMITS.upload;
  if (pathname.includes('/admin')) return SIZE_LIMITS.admin;
  if (pathname.includes('/sync')) return SIZE_LIMITS.sync;
  if (pathname.includes('/ai/')) return SIZE_LIMITS.ai;
  
  return SIZE_LIMITS.default;
}

/**
 * 检查请求体大小
 */
export async function checkRequestSize(req: NextRequest): Promise<NextResponse | null> {
  try {
    const pathname = req.nextUrl.pathname;
    const method = req.method;
    
    // 只检查有请求体的方法
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return null;
    }

    // 获取Content-Length头
    const contentLength = req.headers.get('content-length');
    if (!contentLength) {
      // 如果没有Content-Length头，尝试读取请求体来检查大小
      return await checkRequestBodySize(req, pathname);
    }

    const size = parseInt(contentLength, 10);
    const limit = getSizeLimit(pathname);

    if (size > limit) {
      const ip = getClientIP(req);
      
      // 记录安全事件
      await logSecurityEvent({
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') || 'unknown',
        eventType: 'invalid_input',
        severity: 'medium',
        description: `Request body too large: ${size} bytes (limit: ${limit} bytes)`,
        metadata: {
          requestSize: size,
          sizeLimit: limit,
          path: pathname,
          method,
          sizeLimitType: getSizeLimitType(pathname)
        }
      });

      return NextResponse.json({
        error: 'Request body too large',
        code: 'REQUEST_TOO_LARGE',
        details: {
          size,
          limit,
          limitType: getSizeLimitType(pathname)
        }
      }, { 
        status: 413,
        headers: {
          'X-Size-Limit': limit.toString(),
          'X-Size-Limit-Type': getSizeLimitType(pathname)
        }
      });
    }

    return null;
  } catch (error) {
    console.error('Error checking request size:', error);
    return null; // 出错时不阻止请求
  }
}

/**
 * 检查请求体实际大小（当没有Content-Length时）
 */
async function checkRequestBodySize(req: NextRequest, pathname: string): Promise<NextResponse | null> {
  try {
    const limit = getSizeLimit(pathname);
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    // 创建一个可读流来检查大小
    const reader = req.body?.getReader();
    if (!reader) return null;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      if (value) {
        totalSize += value.length;
        
        // 如果超过限制，立即停止
        if (totalSize > limit) {
          const ip = getClientIP(req);
          
          await logSecurityEvent({
            ipAddress: ip,
            userAgent: req.headers.get('user-agent') || 'unknown',
            eventType: 'invalid_input',
            severity: 'medium',
            description: `Streaming request body too large: ${totalSize}+ bytes (limit: ${limit} bytes)`,
            metadata: {
              requestSize: totalSize,
              sizeLimit: limit,
              path: pathname,
              method: req.method,
              sizeLimitType: getSizeLimitType(pathname),
              streamingCheck: true
            }
          });

          return NextResponse.json({
            error: 'Request body too large',
            code: 'REQUEST_TOO_LARGE',
            details: {
              size: totalSize,
              limit,
              limitType: getSizeLimitType(pathname)
            }
          }, { 
            status: 413,
            headers: {
              'X-Size-Limit': limit.toString(),
              'X-Size-Limit-Type': getSizeLimitType(pathname)
            }
          });
        }
        
        chunks.push(value);
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking streaming request size:', error);
    return null;
  }
}

/**
 * 获取大小限制类型名称
 */
function getSizeLimitType(pathname: string): string {
  if (pathname.includes('/settings')) return 'settings';
  if (pathname.includes('/shared-keys')) return 'shared-keys';
  if (pathname.includes('/chat') || pathname.includes('/openai')) return 'chat';
  if (pathname.includes('/upload')) return 'upload';
  if (pathname.includes('/admin')) return 'admin';
  if (pathname.includes('/sync')) return 'sync';
  if (pathname.includes('/ai/')) return 'ai';
  
  return 'default';
}

/**
 * 格式化字节大小为可读格式
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 获取所有大小限制配置（用于调试）
 */
export function getSizeLimits(): Record<string, string> {
  const limits: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(SIZE_LIMITS)) {
    limits[key] = formatBytes(value);
  }
  
  return limits;
}
