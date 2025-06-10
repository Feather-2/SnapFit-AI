'use client';

import React, { useState } from 'react';
import { BaseURLInput } from '@/components/ui/base-url-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-i18n';

export default function URLValidationTestPage() {
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('https://api.openai.com');
  const [url3, setUrl3] = useState('https://api.example-proxy.com');
  const [isValid1, setIsValid1] = useState(false);
  const [isValid2, setIsValid2] = useState(false);
  const [isValid3, setIsValid3] = useState(false);

  const t = useTranslation('sharedKeys');
  const tCommon = useTranslation('common');

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">URL验证组件测试</h1>
          <p className="text-muted-foreground mt-2">
            测试BaseURLInput组件的i18n翻译功能
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>翻译键测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>翻译键</strong>
              </div>
              <div>
                <strong>翻译结果</strong>
              </div>
              
              <div className="font-mono text-muted-foreground">
                upload.urlValidation.passed
              </div>
              <div>
                {t('upload.urlValidation.passed')}
              </div>
              
              <div className="font-mono text-muted-foreground">
                upload.urlValidation.blocked
              </div>
              <div>
                {t('upload.urlValidation.blocked')}
              </div>
              
              <div className="font-mono text-muted-foreground">
                upload.urlValidation.tips.support
              </div>
              <div>
                {t('upload.urlValidation.tips.support')}
              </div>
              
              <div className="font-mono text-muted-foreground">
                upload.urlValidation.tips.security
              </div>
              <div>
                {t('upload.urlValidation.tips.security')}
              </div>
              
              <div className="font-mono text-muted-foreground">
                upload.urlValidation.placeholder
              </div>
              <div>
                {t('upload.urlValidation.placeholder')}
              </div>
              
              <div className="font-mono text-muted-foreground">
                common.blockedDomain
              </div>
              <div>
                {tCommon('blockedDomain')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>URL验证测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium mb-2">测试1: 空URL</h4>
              <BaseURLInput
                value={url1}
                onChange={setUrl1}
                onValidationChange={setIsValid1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                验证状态: {isValid1 ? '✅ 有效' : '❌ 无效'}
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">测试2: 官方API URL (应该被封禁)</h4>
              <BaseURLInput
                value={url2}
                onChange={setUrl2}
                onValidationChange={setIsValid2}
              />
              <p className="text-xs text-muted-foreground mt-1">
                验证状态: {isValid2 ? '✅ 有效' : '❌ 无效'}
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">测试3: 第三方代理URL (应该通过)</h4>
              <BaseURLInput
                value={url3}
                onChange={setUrl3}
                onValidationChange={setIsValid3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                验证状态: {isValid3 ? '✅ 有效' : '❌ 无效'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => setUrl1('https://api.anthropic.com')}
              >
                测试Anthropic官方API
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setUrl1('https://localhost:3000')}
              >
                测试本地地址
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setUrl1('https://gov.cn')}
              >
                测试政府域名
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setUrl1('https://api.proxy-service.com')}
              >
                测试代理服务
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
