import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  validateBaseURL,
  getBlockedDomains,
  getURLValidationRules,
  isOfficialAPI,
  formatURLForDisplay
} from '@/lib/url-validator';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rules = getURLValidationRules();

    return NextResponse.json({
      success: true,
      title: 'URL Blacklist Test & Information',
      blacklist: {
        totalBlocked: getBlockedDomains().length,
        blockedDomains: getBlockedDomains(),
        categories: {
          aiServices: getBlockedDomains().filter(d =>
            d.includes('openai') || d.includes('anthropic') || d.includes('claude') ||
            d.includes('deepseek') || d.includes('google') || d.includes('googleapis') ||
            d.includes('aliyun') || d.includes('alibaba') || d.includes('baidu') ||
            d.includes('tencent') || d.includes('bytedance') || d.includes('moonshot') ||
            d.includes('zhipuai') || d.includes('minimax')
          ),
          government: getBlockedDomains().filter(d =>
            d.includes('gov.') || d.includes('mil.') || d.includes('police.')
          ),
          education: getBlockedDomains().filter(d =>
            d.includes('edu.') || d.includes('ac.')
          ),
          financial: getBlockedDomains().filter(d =>
            d.includes('bank.') || d.includes('banking.') || d.includes('finance.')
          )
        }
      },
      rules,
      testEndpoints: {
        'POST /test-url': 'Test specific URL validation',
        'POST /test-batch': 'Test multiple URLs at once',
        'POST /test-official-detection': 'Test official API detection'
      }
    });

  } catch (error) {
    console.error('URL blacklist test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testType, data } = await request.json();

    let result: any = {
      testType,
      timestamp: new Date().toISOString()
    };

    switch (testType) {
      case 'test-url':
        // 测试单个URL
        const { url } = data;

        if (!url) {
          return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const validation = validateBaseURL(url);
        const isOfficial = isOfficialAPI(url);
        const formatted = formatURLForDisplay(url);

        result.urlTest = {
          originalUrl: url,
          formattedUrl: formatted,
          validation,
          isOfficialAPI: isOfficial,
          passed: validation.isValid,
          recommendation: validation.isValid
            ? '✅ 可以使用此URL'
            : validation.isBlocked
              ? '🚫 此URL被封禁，请使用第三方代理'
              : '❌ URL格式无效'
        };
        break;

      case 'test-batch':
        // 批量测试URL
        const { urls } = data;

        if (!Array.isArray(urls)) {
          return NextResponse.json({ error: 'URLs must be an array' }, { status: 400 });
        }

        const batchResults = urls.map(url => {
          const validation = validateBaseURL(url);
          const isOfficial = isOfficialAPI(url);

          return {
            url,
            validation,
            isOfficialAPI: isOfficial,
            passed: validation.isValid
          };
        });

        const summary = {
          total: batchResults.length,
          passed: batchResults.filter(r => r.passed).length,
          blocked: batchResults.filter(r => r.validation.isBlocked).length,
          invalid: batchResults.filter(r => !r.validation.isValid && !r.validation.isBlocked).length
        };

        result.batchTest = {
          results: batchResults,
          summary,
          passRate: Math.round((summary.passed / summary.total) * 100)
        };
        break;

      case 'test-official-detection':
        // 测试官方API检测
        const testUrls = [
          'https://api.openai.com/v1/chat/completions',
          'https://api.anthropic.com/v1/messages',
          'https://api.deepseek.com/v1/chat/completions',
          'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
          'https://generativelanguage.googleapis.com/v1beta/models',
          'https://api.openai-proxy.com/v1/chat/completions',
          'https://api.chatanywhere.com.cn/v1/chat/completions',
          'https://example.com/api/v1/chat'
        ];

        const detectionResults = testUrls.map(url => {
          const validation = validateBaseURL(url);
          const isOfficial = isOfficialAPI(url);

          return {
            url,
            isOfficialAPI: isOfficial,
            isBlocked: validation.isBlocked,
            isValid: validation.isValid,
            reason: validation.reason,
            category: isOfficial ? 'official' : validation.isValid ? 'third-party' : 'invalid'
          };
        });

        result.detectionTest = {
          results: detectionResults,
          categories: {
            official: detectionResults.filter(r => r.category === 'official').length,
            thirdParty: detectionResults.filter(r => r.category === 'third-party').length,
            invalid: detectionResults.filter(r => r.category === 'invalid').length
          }
        };
        break;

      case 'test-edge-cases':
        // 测试边缘情况
        const edgeCases = [
          '',
          'not-a-url',
          'http://localhost:3000',
          'https://127.0.0.1:8080',
          'ftp://api.openai.com',
          'https://api.openai.com.evil.com',
          'https://sub.api.openai.com',
          'https://api-openai.com',
          'https://openai.com.proxy.example.com'
        ];

        const edgeResults = edgeCases.map(url => {
          const validation = validateBaseURL(url);

          return {
            url: url || '(empty)',
            validation,
            expectedBlocked: url.includes('openai.com') || url.includes('localhost') || url.includes('127.0.0.1'),
            actualBlocked: validation.isBlocked,
            correct: (url.includes('openai.com') || url.includes('localhost') || url.includes('127.0.0.1')) === validation.isBlocked
          };
        });

        result.edgeCaseTest = {
          results: edgeResults,
          accuracy: Math.round((edgeResults.filter(r => r.correct).length / edgeResults.length) * 100)
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('URL blacklist test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
