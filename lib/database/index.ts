// 数据库抽象层 - 支持 Supabase 和 PostgreSQL 一键切换
import { DatabaseProvider, DatabaseClient } from './types'
import { SupabaseProvider } from './providers/supabase'
import { PostgreSQLProvider } from './providers/postgresql'

// 从环境变量获取数据库提供商
const DB_PROVIDER = (process.env.DB_PROVIDER || 'supabase') as DatabaseProvider

// 创建数据库客户端工厂
export function createDatabaseClient(): DatabaseClient {
  switch (DB_PROVIDER) {
    case 'supabase':
      return new SupabaseProvider()
    case 'postgresql':
      return new PostgreSQLProvider()
    default:
      throw new Error(`Unsupported database provider: ${DB_PROVIDER}`)
  }
}

// 导出单例实例
export const db = createDatabaseClient()

// 导出类型
export * from './types'
export { DB_PROVIDER }
