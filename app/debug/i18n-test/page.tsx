'use client';

import React from 'react';
import { useTranslation } from '@/hooks/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BaseURLInput } from '@/components/ui/base-url-input';

export default function I18nTestPage() {
  const tShared = useTranslation('sharedKeys');
  const tCommon = useTranslation('common');

  const testKeys = [
    { key: 'upload.urlValidation.passed', t: tShared },
    { key: 'upload.urlValidation.blocked', t: tShared },
    { key: 'upload.urlValidation.invalid', t: tShared },
    { key: 'upload.urlValidation.localAddress', t: tShared },
    { key: 'upload.urlValidation.invalidProtocol', t: tShared },
    { key: 'upload.urlValidation.empty', t: tShared },
    { key: 'upload.urlValidation.tips.support', t: tShared },
    { key: 'upload.urlValidation.tips.security', t: tShared },
    { key: 'upload.urlValidation.placeholder', t: tShared },
    { key: 'blockedDomain', t: tCommon }
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">i18n 翻译测试</h1>
          <p className="text-muted-foreground mt-2">
            测试URL验证相关的翻译键
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>翻译键测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testKeys.map((item) => (
              <div key={item.key} className="border rounded p-3">
                <div className="text-sm font-mono text-muted-foreground mb-1">
                  {item.key}
                </div>
                <div className="text-sm">
                  {item.t(item.key)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BaseURLInput 组件测试</CardTitle>
          </CardHeader>
          <CardContent>
            <BaseURLInput
              value=""
              onChange={() => {}}
              placeholder={t('sharedServices.upload.urlValidation.placeholder')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>测试不同URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">测试官方API URL (应该被封禁):</h4>
              <BaseURLInput
                value="https://api.openai.com"
                onChange={() => {}}
              />
            </div>

            <div>
              <h4 className="font-medium mb-2">测试第三方URL (应该通过):</h4>
              <BaseURLInput
                value="https://api.example-proxy.com"
                onChange={() => {}}
              />
            </div>

            <div>
              <h4 className="font-medium mb-2">测试本地地址 (应该被封禁):</h4>
              <BaseURLInput
                value="http://localhost:3000"
                onChange={() => {}}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
