// 服务端数据库兼容性适配器
import { DB_PROVIDER } from '../index'
import type { SupabaseCompatClient } from './supabase-compat'

// 创建服务端客户端的工厂函数
export async function createServerClient(): Promise<SupabaseCompatClient> {
  if (DB_PROVIDER === 'supabase') {
    // 使用 Supabase SSR 客户端
    const { SupabaseServerProvider } = await import('../providers/supabase')
    const provider = new SupabaseServerProvider()
    const client = await provider.createServerClient()
    
    // 返回原生 Supabase 客户端
    return client
  } else {
    // 使用 PostgreSQL 适配器
    const { createPostgreSQLServer } = await import('../providers/postgresql')
    const { SupabaseCompatClientImpl } = await import('./supabase-compat')
    
    const provider = createPostgreSQLServer()
    return new (SupabaseCompatClientImpl as any)(provider)
  }
}

// 导出便捷函数，替换原有的服务端导入
export { createServerClient as createClient }
