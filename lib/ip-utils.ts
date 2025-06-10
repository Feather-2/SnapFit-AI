/**
 * IP地址获取和处理工具
 * 统一处理各种环境下的IP获取逻辑
 */

import { NextRequest } from 'next/server';

/**
 * 从请求中获取客户端真实IP地址
 * 支持各种代理和CDN环境
 */
export function getClientIP(req: NextRequest): string {
  // 尝试从各种头部获取真实IP（按优先级排序）
  const headers = [
    'cf-connecting-ip',     // Cloudflare
    'x-real-ip',           // Nginx
    'x-forwarded-for',     // 标准代理头
    'x-client-ip',         // Apache
    'x-cluster-client-ip', // 集群
    'x-forwarded',         // 其他代理
    'forwarded-for',       // 其他代理
    'forwarded'            // RFC 7239
  ];

  let clientIP = 'unknown';

  // 按优先级检查各个头部
  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      if (header === 'x-forwarded-for' || header === 'forwarded-for') {
        // 这些头部可能包含多个IP，取第一个（最原始的客户端IP）
        clientIP = value.split(',')[0].trim();
      } else {
        clientIP = value.trim();
      }
      break;
    }
  }

  // 如果没有从头部获取到，尝试使用 req.ip
  if (clientIP === 'unknown' && req.ip) {
    clientIP = req.ip;
  }

  // 处理本地开发环境的特殊情况
  clientIP = normalizeLocalIP(clientIP);

  // 验证IP格式
  if (!isValidIP(clientIP)) {
    console.warn(`Invalid IP detected: ${clientIP}, using fallback`);
    clientIP = getLocalFallbackIP();
  }

  return clientIP;
}

/**
 * 标准化本地IP地址
 * 将各种本地地址格式统一为标准格式
 */
function normalizeLocalIP(ip: string): string {
  if (!ip || ip === 'unknown') {
    return ip;
  }

  // IPv6本地地址转换
  if (ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '0:0:0:0:0:0:0:1') {
    return '127.0.0.1';
  }

  // 移除IPv6前缀
  if (ip.startsWith('::ffff:')) {
    const ipv4Part = ip.substring(7);
    if (isValidIPv4(ipv4Part)) {
      return ipv4Part;
    }
  }

  return ip;
}

/**
 * 验证IP地址格式
 */
function isValidIP(ip: string): boolean {
  if (!ip || ip === 'unknown' || ip === 'invalid') {
    return false;
  }

  return isValidIPv4(ip) || isValidIPv6(ip);
}

/**
 * 验证IPv4地址格式
 */
function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  
  if (!match) {
    return false;
  }

  // 检查每个数字是否在0-255范围内
  for (let i = 1; i <= 4; i++) {
    const num = parseInt(match[i], 10);
    if (num < 0 || num > 255) {
      return false;
    }
  }

  return true;
}

/**
 * 验证IPv6地址格式（简化版）
 */
function isValidIPv6(ip: string): boolean {
  // 简化的IPv6验证，支持常见格式
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  return ipv6Regex.test(ip);
}

/**
 * 获取本地环境的回退IP
 */
function getLocalFallbackIP(): string {
  // 在开发环境中，使用本地IP作为回退
  if (process.env.NODE_ENV === 'development') {
    return '127.0.0.1';
  }
  
  // 生产环境中，返回unknown让系统知道无法获取真实IP
  return 'unknown';
}

/**
 * 检查IP是否为本地地址
 */
export function isLocalIP(ip: string): boolean {
  if (!ip) return false;
  
  const localPatterns = [
    '127.0.0.1',
    'localhost',
    '::1',
    '0.0.0.0'
  ];
  
  return localPatterns.includes(ip) || 
         ip.startsWith('192.168.') || 
         ip.startsWith('10.') || 
         ip.startsWith('172.');
}

/**
 * 获取IP的地理位置信息（占位符，可以集成第三方服务）
 */
export function getIPLocation(ip: string): { country?: string; city?: string; region?: string } {
  // 本地IP
  if (isLocalIP(ip)) {
    return { country: 'Local', city: 'Development', region: 'Local' };
  }
  
  // 这里可以集成第三方IP地理位置服务
  // 比如 MaxMind GeoIP, ipapi.co, ip-api.com 等
  return {};
}

/**
 * 格式化IP地址用于显示
 */
export function formatIPForDisplay(ip: string): string {
  if (!ip || ip === 'unknown') {
    return 'Unknown';
  }
  
  if (isLocalIP(ip)) {
    return `${ip} (Local)`;
  }
  
  return ip;
}

/**
 * 生成IP的哈希值（用于匿名化）
 */
export function hashIP(ip: string): string {
  if (!ip || ip === 'unknown') {
    return 'unknown';
  }
  
  // 简单的哈希函数（生产环境建议使用更安全的哈希）
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  return Math.abs(hash).toString(16);
}
