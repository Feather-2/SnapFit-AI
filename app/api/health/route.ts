import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 基本健康检查
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
      },
      version: process.env.npm_package_version || '0.1.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
      },
      services: {
        supabase: {
          configured: false,
          connected: false,
          error: null as string | null
        }
      }
    }

    // 检查 Supabase 环境变量
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    healthCheck.services.supabase.configured = !!(supabaseUrl && supabaseAnonKey && supabaseServiceKey);

    if (!healthCheck.services.supabase.configured) {
      healthCheck.services.supabase.error = 'Missing required Supabase environment variables';
      healthCheck.status = 'warning';
    } else {
      // 测试 Supabase 连接（仅在配置正确时）
      try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('count')
          .limit(1);

        if (error) {
          healthCheck.services.supabase.connected = false;
          healthCheck.services.supabase.error = error.message;
          healthCheck.status = 'warning';
        } else {
          healthCheck.services.supabase.connected = true;
        }
      } catch (supabaseError) {
        healthCheck.services.supabase.connected = false;
        healthCheck.services.supabase.error = supabaseError instanceof Error ? supabaseError.message : 'Supabase connection failed';
        healthCheck.status = 'warning';
      }
    }

    const statusCode = healthCheck.status === 'ok' ? 200 : 200; // 总是返回 200，但在响应中标明状态

    return NextResponse.json(healthCheck, { status: statusCode })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
