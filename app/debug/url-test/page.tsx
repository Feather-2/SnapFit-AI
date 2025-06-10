'use client';

import React, { useState } from 'react';
import { BaseURLInput } from '@/components/ui/base-url-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function URLTestPage() {
  const [url, setUrl] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testUrls = [
    'https://api.openai.com',
    'https://api.anthropic.com', 
    'https://api.deepseek.com',
    'https://dashscope.aliyuncs.com',
    'https://api.example-proxy.com',
    'https://localhost:3000',
    'https://gov.cn',
    'https://api.chatanywhere.com.cn'
  ];

  const handleTest = async () => {
    if (!url) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/debug/test-url-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({ error: 'Test failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickTest = (testUrl: string) => {
    setUrl(testUrl);
    setTestResult(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">URL 黑名单验证测试</h1>
          <p className="text-muted-foreground mt-2">
            测试Base URL验证和黑名单功能
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>URL 输入测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BaseURLInput
              value={url}
              onChange={setUrl}
              onValidationChange={setIsValid}
              placeholder="输入要测试的URL"
            />
            
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleTest} 
                disabled={!url || isLoading}
              >
                {isLoading ? '测试中...' : '测试URL'}
              </Button>
              
              <div className="flex items-center gap-2">
                <span className="text-sm">前端验证:</span>
                <Badge variant={isValid ? "default" : "destructive"}>
                  {isValid ? "有效" : "无效"}
                </Badge>
              </div>
            </div>

            {testResult && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">API验证结果</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速测试URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {testUrls.map((testUrl, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handleQuickTest(testUrl)}
                  className="justify-start text-left h-auto p-3"
                >
                  <div>
                    <div className="font-mono text-sm">{testUrl}</div>
                    <div className="text-xs text-muted-foreground">
                      {testUrl.includes('openai') || testUrl.includes('anthropic') || 
                       testUrl.includes('deepseek') || testUrl.includes('dashscope') ||
                       testUrl.includes('localhost') || testUrl.includes('gov.cn')
                        ? '应该被封禁' 
                        : '应该被允许'}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>验证规则说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>被封禁的URL类型：</strong></div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>AI官方API（OpenAI、Anthropic、DeepSeek等）</li>
              <li>政府域名（.gov.cn、.gov.us等）</li>
              <li>军事域名（.mil.cn、.mil.us等）</li>
              <li>教育机构域名（.edu.cn、.edu.us等）</li>
              <li>本地地址（localhost、127.0.0.1等）</li>
            </ul>
            
            <div className="mt-4"><strong>允许的URL：</strong></div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>第三方API代理服务</li>
              <li>自建API服务</li>
              <li>其他非黑名单域名</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
