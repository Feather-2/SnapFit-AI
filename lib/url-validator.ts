/**
 * URL验证器
 * 用于验证Base URL，封禁官方API地址，只允许第三方源站
 */

// 被封禁的URL黑名单
const URL_BLACKLIST = [
  // OpenAI 官方 - 防止社区被官方封禁
  'api.openai.com',
  'openai.com',
  'chat.openai.com',

  // Anthropic Claude 官方
  'api.anthropic.com',
  'anthropic.com',
  'claude.ai',
  'console.anthropic.com',

  // DeepSeek 官方
  'api.deepseek.com',
  'deepseek.com',
  'chat.deepseek.com',
  'platform.deepseek.com',

  // 阿里云通义千问 官方
  'dashscope.aliyuncs.com',
  'qwen.aliyun.com',
  'tongyi.aliyun.com',
  'ecs.aliyuncs.com',
  'aliyun.com',
  'alibaba.com',
  'taobao.com',

  // Google Gemini 官方
  'generativelanguage.googleapis.com',
  'ai.google.dev',
  'makersuite.google.com',
  'googleapis.com',
  'google.com',
  'googleapi.com',
  'bard.google.com',

  // Microsoft/Azure 官方
  'azure.com',
  'microsoft.com',
  'openai.azure.com',
  'cognitiveservices.azure.com',

  // 百度文心一言
  'aip.baidubce.com',
  'baidu.com',
  'baidubce.com',

  // 腾讯混元
  'hunyuan.tencent.com',
  'tencent.com',
  'qq.com',

  // 字节跳动豆包
  'volcengine.com',
  'bytedance.com',
  'douyin.com',
  'tiktok.com',

  // 科大讯飞星火
  'xfyun.cn',
  'iflytek.com',

  // 智谱AI
  'zhipuai.cn',
  'bigmodel.cn',

  // 月之暗面 Kimi
  'moonshot.cn',
  'kimi.ai',

  // 零一万物
  'lingyiwanwu.com',
  '01.ai',

  // MiniMax
  'minimax.chat',
  'minimaxi.com',

  // 政府和敏感域名
  'gov.cn',
  'gov.us',
  'gov.uk',
  'gov.au',
  'gov.ca',
  'government.com',
  'mil.cn',
  'mil.us',
  'military.com',
  'army.mil',
  'navy.mil',
  'airforce.mil',

  // 教育机构（可能有限制）
  'edu.cn',
  'edu.us',

  // 银行和金融机构
  'bank.com',
  'banking.com',
  'finance.gov',

  // 其他敏感域名
  'police.gov',
  'fbi.gov',
  'cia.gov',
  'nsa.gov'
];

export interface URLValidationResult {
  isValid: boolean;
  isBlocked: boolean;
  reason?: string;
  blockedDomain?: string;
}

/**
 * 验证Base URL是否被允许
 */
export function validateBaseURL(url: string): URLValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      isBlocked: false,
      reason: 'URL不能为空'
    };
  }

  // 清理URL
  const cleanUrl = url.trim().toLowerCase();

  // 基本URL格式验证
  let parsedUrl: URL;
  try {
    // 如果没有协议，添加https
    const urlWithProtocol = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
    parsedUrl = new URL(urlWithProtocol);
  } catch (error) {
    return {
      isValid: false,
      isBlocked: false,
      reason: 'URL格式无效'
    };
  }

  // 检查协议
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return {
      isValid: false,
      isBlocked: false,
      reason: '只支持HTTP和HTTPS协议'
    };
  }

  const hostname = parsedUrl.hostname;

  // 检查是否为本地地址
  if (isLocalAddress(hostname)) {
    return {
      isValid: false,
      isBlocked: true,
      reason: '不允许使用本地地址',
      blockedDomain: hostname
    };
  }

  // 检查黑名单
  const blockedDomain = checkBlacklist(hostname);
  if (blockedDomain) {
    return {
      isValid: false,
      isBlocked: true,
      reason: '此URL被封禁，不允许使用',
      blockedDomain
    };
  }

  // 通过验证的第三方URL
  return {
    isValid: true,
    isBlocked: false,
    reason: 'URL验证通过'
  };
}

/**
 * 检查域名是否在黑名单中
 */
function checkBlacklist(hostname: string): string | null {
  for (const blockedDomain of URL_BLACKLIST) {
    if (hostname === blockedDomain || hostname.endsWith(`.${blockedDomain}`)) {
      return blockedDomain;
    }
  }
  return null;
}

/**
 * 检查是否为本地地址
 */
function isLocalAddress(hostname: string): boolean {
  const localPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1'
  ];

  // 检查明确的本地地址
  if (localPatterns.includes(hostname)) {
    return true;
  }

  // 检查私有IP范围
  if (hostname.match(/^192\.168\./)) return true;
  if (hostname.match(/^10\./)) return true;
  if (hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return true;

  return false;
}

/**
 * 获取被封禁域名列表（用于显示）
 */
export function getBlockedDomains(): string[] {
  return [...URL_BLACKLIST];
}

/**
 * 检查URL是否为官方API
 */
export function isOfficialAPI(url: string): boolean {
  try {
    const cleanUrl = url.trim().toLowerCase();
    const urlWithProtocol = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
    const parsedUrl = new URL(urlWithProtocol);
    return checkBlacklist(parsedUrl.hostname) !== null;
  } catch {
    return false;
  }
}

/**
 * 格式化URL用于显示
 */
export function formatURLForDisplay(url: string): string {
  try {
    const cleanUrl = url.trim();
    const urlWithProtocol = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
    const parsedUrl = new URL(urlWithProtocol);
    return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
  } catch {
    return url;
  }
}

/**
 * 获取URL验证规则说明
 */
export function getURLValidationRules(): {
  blocked: string[];
  requirements: string[];
} {
  return {
    blocked: [
      '官方AI API服务（防止社区被封禁）',
      '政府和军事域名（.gov, .mil等）',
      '教育机构域名（.edu, .ac等）',
      '银行和金融机构域名',
      '本地和内网地址'
    ],
    requirements: [
      '必须使用HTTPS或HTTP协议',
      '不能使用本地地址',
      '不能使用被封禁的域名',
      'URL格式必须正确',
      '建议使用可信的第三方代理服务'
    ]
  };
}
