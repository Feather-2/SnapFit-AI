// Supabase 数据库提供商实现
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { 
  DatabaseClient, 
  ServerDatabaseClient, 
  QueryResult, 
  QueryOptions, 
  UpsertOptions, 
  RPCOptions 
} from '../types'

export class SupabaseProvider implements DatabaseClient {
  private client: any

  constructor(useServiceRole = false) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    
    if (useServiceRole) {
      // 使用 Service Role Key（服务端）
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      this.client = createClient(supabaseUrl, serviceRoleKey)
    } else {
      // 使用 Anon Key（客户端）
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.client = createClient(supabaseUrl, anonKey)
    }
  }

  async select<T = any>(table: string, options?: QueryOptions): Promise<QueryResult<T[]>> {
    try {
      let query = this.client.from(table).select(options?.select || '*')
      
      // 应用 where 条件
      if (options?.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      
      // 应用排序
      if (options?.orderBy) {
        options.orderBy.forEach(({ column, ascending = true }) => {
          query = query.order(column, { ascending })
        })
      }
      
      // 应用分页
      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 1000) - 1)
      }
      
      const { data, error, count } = await query
      return { data, error, count }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async selectOne<T = any>(table: string, options?: QueryOptions): Promise<QueryResult<T>> {
    try {
      let query = this.client.from(table).select(options?.select || '*')
      
      // 应用 where 条件
      if (options?.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      
      const { data, error } = await query.single()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async insert<T = any>(table: string, data: any, options?: UpsertOptions): Promise<QueryResult<T>> {
    try {
      let query = this.client.from(table).insert(data)
      
      if (options?.returning) {
        query = query.select(options.returning)
      }
      
      const result = await query
      return { data: result.data, error: result.error }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async update<T = any>(table: string, data: any, options?: QueryOptions & UpsertOptions): Promise<QueryResult<T>> {
    try {
      let query = this.client.from(table).update(data)
      
      // 应用 where 条件
      if (options?.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      
      if (options?.returning) {
        query = query.select(options.returning)
      }
      
      const result = await query
      return { data: result.data, error: result.error }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async upsert<T = any>(table: string, data: any, options?: UpsertOptions): Promise<QueryResult<T>> {
    try {
      let query = this.client.from(table).upsert(data)
      
      if (options?.returning) {
        query = query.select(options.returning)
      }
      
      const result = await query
      return { data: result.data, error: result.error }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async delete<T = any>(table: string, options?: QueryOptions): Promise<QueryResult<T>> {
    try {
      let query = this.client.from(table).delete()
      
      // 应用 where 条件
      if (options?.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      
      const result = await query
      return { data: result.data, error: result.error }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async rpc<T = any>(options: RPCOptions): Promise<QueryResult<T>> {
    try {
      const { data, error } = await this.client.rpc(options.functionName, options.params)
      return { data, error }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    // Supabase 不直接支持事务，使用 RPC 函数实现
    return callback(this)
  }
}

// 服务端 Supabase 客户端（支持 SSR）
export class SupabaseServerProvider extends SupabaseProvider implements ServerDatabaseClient {
  private serverClient: any

  constructor() {
    super(true) // 使用 Service Role
  }

  async createServerClient() {
    const cookieStore = await cookies()
    
    this.serverClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Component 中忽略错误
            }
          },
        },
      }
    )
    
    return this.serverClient
  }

  withAuth(userId?: string): DatabaseClient {
    // 返回带认证上下文的客户端
    return new SupabaseProvider(true)
  }
}

// 导出便捷函数
export const createSupabaseClient = () => new SupabaseProvider()
export const createSupabaseAdmin = () => new SupabaseProvider(true)
export const createSupabaseServer = () => new SupabaseServerProvider()
