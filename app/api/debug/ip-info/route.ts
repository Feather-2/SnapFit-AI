import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, isLocalIP, formatIPForDisplay } from '@/lib/ip-utils';

export async function GET(request: NextRequest) {
  try {
    // 获取所有可能的IP相关头部
    const headers = {
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
      'x-real-ip': request.headers.get('x-real-ip'),
      'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
      'x-client-ip': request.headers.get('x-client-ip'),
      'x-cluster-client-ip': request.headers.get('x-cluster-client-ip'),
      'x-forwarded': request.headers.get('x-forwarded'),
      'forwarded-for': request.headers.get('forwarded-for'),
      'forwarded': request.headers.get('forwarded'),
      'user-agent': request.headers.get('user-agent')
    };

    // 获取处理后的客户端IP
    const clientIP = getClientIP(request);
    
    // 获取原始的 req.ip
    const rawIP = request.ip;

    // 分析IP信息
    const ipInfo = {
      clientIP,
      rawIP,
      isLocal: isLocalIP(clientIP),
      formatted: formatIPForDisplay(clientIP),
      headers,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        netlify: !!process.env.NETLIFY,
        railway: !!process.env.RAILWAY_ENVIRONMENT,
        render: !!process.env.RENDER
      },
      url: {
        host: request.headers.get('host'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer')
      }
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ipInfo,
      message: 'IP information retrieved successfully'
    });

  } catch (error) {
    console.error('IP debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
