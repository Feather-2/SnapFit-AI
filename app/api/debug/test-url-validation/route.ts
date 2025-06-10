import { NextRequest, NextResponse } from 'next/server';
import { validateBaseURL } from '@/lib/url-validator';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('Testing URL:', url);
    
    const validation = validateBaseURL(url);
    
    console.log('Validation result:', validation);

    return NextResponse.json({
      success: true,
      url,
      validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('URL validation test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'URL Validation Test API',
    usage: 'POST with { "url": "https://example.com" }',
    examples: [
      'https://api.openai.com (should be blocked)',
      'https://api.anthropic.com (should be blocked)', 
      'https://api.example-proxy.com (should be allowed)',
      'https://localhost:3000 (should be blocked)',
      'https://gov.cn (should be blocked)'
    ]
  });
}
