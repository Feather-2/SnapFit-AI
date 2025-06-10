'use client';

import React from 'react';
import { useTranslation } from '@/hooks/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BaseURLInput } from '@/components/ui/base-url-input';

export default function TranslationTestPage() {
  const tSharedKeys = useTranslation('sharedKeys');
  const tCommon = useTranslation('common');

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">翻译测试页面</h1>
          <p className="text-muted-foreground mt-2">
            验证URL验证组件的翻译是否正确
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>翻译键测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="font-semibold">命名空间</div>
              <div className="font-semibold">翻译键</div>
              <div className="font-semibold">翻译结果</div>
              
              <div>sharedKeys</div>
              <div className="font-mono">upload.urlValidation.passed</div>
              <div className="bg-green-50 p-2 rounded">{tSharedKeys('upload.urlValidation.passed')}</div>
              
              <div>sharedKeys</div>
              <div className="font-mono">upload.urlValidation.blocked</div>
              <div className="bg-red-50 p-2 rounded">{tSharedKeys('upload.urlValidation.blocked')}</div>
              
              <div>sharedKeys</div>
              <div className="font-mono">upload.urlValidation.tips.support</div>
              <div className="bg-blue-50 p-2 rounded">{tSharedKeys('upload.urlValidation.tips.support')}</div>
              
              <div>sharedKeys</div>
              <div className="font-mono">upload.urlValidation.tips.security</div>
              <div className="bg-blue-50 p-2 rounded">{tSharedKeys('upload.urlValidation.tips.security')}</div>
              
              <div>common</div>
              <div className="font-mono">blockedDomain</div>
              <div className="bg-yellow-50 p-2 rounded">{tCommon('blockedDomain')}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BaseURLInput 组件测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium mb-2">测试被封禁的URL（应该显示被封禁域名）</h4>
              <BaseURLInput
                value="https://api.deepseek.com"
                onChange={() => {}}
              />
            </div>
            
            <div>
              <h4 className="font-medium mb-2">测试OpenAI官方URL（应该显示被封禁域名）</h4>
              <BaseURLInput
                value="https://api.openai.com"
                onChange={() => {}}
              />
            </div>
            
            <div>
              <h4 className="font-medium mb-2">测试政府域名（应该显示被封禁域名）</h4>
              <BaseURLInput
                value="https://gov.cn"
                onChange={() => {}}
              />
            </div>
            
            <div>
              <h4 className="font-medium mb-2">测试有效的第三方URL（应该显示验证通过）</h4>
              <BaseURLInput
                value="https://api.example-proxy.com"
                onChange={() => {}}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>预期结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>被封禁的URL应该显示：</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>红色警告框</li>
                <li>错误消息："{tSharedKeys('upload.urlValidation.blocked')}"</li>
                <li>被封禁域名标签："{tCommon('blockedDomain')}: [域名]"</li>
              </ul>
              
              <p className="mt-4"><strong>有效的URL应该显示：</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>绿色成功框</li>
                <li>成功消息："{tSharedKeys('upload.urlValidation.passed')}"</li>
              </ul>
              
              <p className="mt-4"><strong>使用提示应该显示：</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>• {tSharedKeys('upload.urlValidation.tips.support')}</li>
                <li>• {tSharedKeys('upload.urlValidation.tips.security')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
