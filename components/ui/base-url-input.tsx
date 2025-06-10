'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-i18n';
import {
  CheckCircle,
  XCircle,
  ShieldAlert
} from 'lucide-react';

interface BaseURLInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

interface URLValidationResult {
  isValid: boolean;
  isBlocked: boolean;
  reason?: string;
  blockedDomain?: string;
}

export function BaseURLInput({
  value,
  onChange,
  onValidationChange,
  className,
  placeholder,
  disabled = false
}: BaseURLInputProps) {
  const [validation, setValidation] = useState<URLValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const t = useTranslation('sharedKeys');
  const tCommon = useTranslation('common');

  // 使用i18n的placeholder
  const defaultPlaceholder = placeholder || t('upload.urlValidation.placeholder');

  // 客户端URL验证（简化版）
  const validateURL = async (url: string): Promise<URLValidationResult> => {
    if (!url || !url.trim()) {
      return { isValid: false, isBlocked: false, reason: t('upload.urlValidation.empty') };
    }

    const cleanUrl = url.trim().toLowerCase();

    // 基本格式检查
    try {
      const urlWithProtocol = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      const parsedUrl = new URL(urlWithProtocol);

      // 检查协议
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { isValid: false, isBlocked: false, reason: t('upload.urlValidation.invalidProtocol') };
      }

      const hostname = parsedUrl.hostname;

      // 检查本地地址
      const localPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      if (localPatterns.includes(hostname) ||
          hostname.match(/^192\.168\./) ||
          hostname.match(/^10\./) ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        return {
          isValid: false,
          isBlocked: true,
          reason: t('upload.urlValidation.localAddress'),
          blockedDomain: hostname
        };
      }

      // 检查黑名单
      const blacklistedDomains = [
        // AI官方API
        'api.openai.com', 'openai.com', 'chat.openai.com',
        'api.anthropic.com', 'anthropic.com', 'claude.ai',
        'api.deepseek.com', 'deepseek.com', 'chat.deepseek.com',
        'dashscope.aliyuncs.com', 'qwen.aliyun.com', 'aliyun.com',
        'generativelanguage.googleapis.com', 'ai.google.dev', 'googleapis.com', 'google.com',
        'azure.com', 'microsoft.com', 'openai.azure.com',
        'aip.baidubce.com', 'baidu.com', 'baidubce.com',
        'hunyuan.tencent.com', 'tencent.com',
        'volcengine.com', 'bytedance.com',
        'xfyun.cn', 'iflytek.com',
        'zhipuai.cn', 'bigmodel.cn',
        'moonshot.cn', 'kimi.ai',
        'lingyiwanwu.com', '01.ai',
        'minimax.chat', 'minimaxi.com',
        // 政府和敏感域名
        'gov.cn', 'gov.us', 'gov.uk', 'gov.au', 'gov.ca',
        'mil.cn', 'mil.us', 'military.com',
        'edu.cn', 'edu.us', 'ac.uk', 'ac.cn',
        'bank.com', 'banking.com', 'finance.gov'
      ];

      for (const blockedDomain of blacklistedDomains) {
        if (hostname === blockedDomain || hostname.endsWith(`.${blockedDomain}`)) {
          return {
            isValid: false,
            isBlocked: true,
            reason: t('upload.urlValidation.blocked'),
            blockedDomain
          };
        }
      }

      // 通过验证的第三方URL
      return {
        isValid: true,
        isBlocked: false,
        reason: t('upload.urlValidation.passed')
      };

    } catch (error) {
      return { isValid: false, isBlocked: false, reason: t('upload.urlValidation.invalid') };
    }
  };

  // 防抖验证
  useEffect(() => {
    if (!value) {
      setValidation(null);
      onValidationChange?.(false);
      return;
    }

    setIsValidating(true);
    const timer = setTimeout(async () => {
      const result = await validateURL(value);
      setValidation(result);
      setIsValidating(false);
      onValidationChange?.(result.isValid);
    }, 500);

    return () => clearTimeout(timer);
  }, [value, onValidationChange]);

  const getStatusIcon = () => {
    if (isValidating) return <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />;
    if (!validation) return null;

    if (validation.isBlocked) return <ShieldAlert className="w-4 h-4 text-red-500" />;
    if (!validation.isValid) return <XCircle className="w-4 h-4 text-red-500" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getStatusColor = () => {
    if (!validation) return '';
    if (validation.isBlocked) return 'border-red-500 focus:ring-red-500 focus:border-red-500';
    if (!validation.isValid) return 'border-red-500 focus:ring-red-500 focus:border-red-500';
    return 'border-green-500 focus:ring-green-500 focus:border-green-500';
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultPlaceholder}
          disabled={disabled}
          className={cn('pr-10', getStatusColor(), className)}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {getStatusIcon()}
        </div>
      </div>

      {/* 验证状态显示 */}
      {validation && (
        <div className="space-y-2">
          {validation.isBlocked ? (
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <div className="space-y-2">
                  <p className="font-medium">{validation.reason}</p>
                  {validation.blockedDomain && (
                    <Badge variant="destructive" className="text-xs">
                      {tCommon('blockedDomain')}: {validation.blockedDomain}
                    </Badge>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          ) : !validation.isValid ? (
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {validation.reason}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {validation.reason}
              </AlertDescription>
            </Alert>
          )}


        </div>
      )}

      {/* 使用说明 */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>• {t('upload.urlValidation.tips.support')}</p>
        <p>• {t('upload.urlValidation.tips.security')}</p>
      </div>
    </div>
  );
}

// 使用示例组件
export function BaseURLInputExample() {
  const [url, setUrl] = useState('');
  const [isValid, setIsValid] = useState(false);

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Base URL 输入示例</h3>

      <BaseURLInput
        value={url}
        onChange={setUrl}
        onValidationChange={setIsValid}
        placeholder="请输入API服务地址"
      />

      <div className="flex items-center gap-2 text-sm">
        <span>验证状态:</span>
        <Badge variant={isValid ? "default" : "destructive"}>
          {isValid ? "有效" : "无效"}
        </Badge>
      </div>
    </div>
  );
}
