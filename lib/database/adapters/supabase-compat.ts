// Supabase 兼容性适配器 - 让现有代码无需修改即可切换数据库
import { db, DB_PROVIDER } from '../index'
import type { DatabaseClient } from '../types'

// 模拟 Supabase 客户端接口
export interface SupabaseCompatClient {
  from(table: string): SupabaseQueryBuilder
  rpc(functionName: string, params?: any): Promise<{ data: any; error: any }>
}

export interface SupabaseQueryBuilder {
  select(columns?: string): SupabaseQueryBuilder
  insert(data: any): SupabaseQueryBuilder
  update(data: any): SupabaseQueryBuilder
  upsert(data: any): SupabaseQueryBuilder
  delete(): SupabaseQueryBuilder
  eq(column: string, value: any): SupabaseQueryBuilder
  in(column: string, values: any[]): SupabaseQueryBuilder
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder
  limit(count: number): SupabaseQueryBuilder
  range(from: number, to: number): SupabaseQueryBuilder
  single(): Promise<{ data: any; error: any }>
  then(resolve: (result: { data: any; error: any; count?: number }) => void): void
}

class SupabaseQueryBuilderImpl implements SupabaseQueryBuilder {
  private table: string
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private selectColumns = '*'
  private whereConditions: Record<string, any> = {}
  private orderByConditions: { column: string; ascending?: boolean }[] = []
  private limitCount?: number
  private offsetValue?: number
  private insertData?: any
  private updateData?: any
  private isSingleResult = false

  constructor(private dbClient: DatabaseClient, table: string) {
    this.table = table
  }

  select(columns = '*'): SupabaseQueryBuilder {
    this.operation = 'select'
    this.selectColumns = columns
    return this
  }

  insert(data: any): SupabaseQueryBuilder {
    this.operation = 'insert'
    this.insertData = data
    return this
  }

  update(data: any): SupabaseQueryBuilder {
    this.operation = 'update'
    this.updateData = data
    return this
  }

  upsert(data: any): SupabaseQueryBuilder {
    this.operation = 'upsert'
    this.insertData = data
    return this
  }

  delete(): SupabaseQueryBuilder {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: any): SupabaseQueryBuilder {
    this.whereConditions[column] = value
    return this
  }

  in(column: string, values: any[]): SupabaseQueryBuilder {
    // 简化实现，实际需要更复杂的 IN 查询处理
    this.whereConditions[column] = values[0] // 临时实现
    return this
  }

  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder {
    this.orderByConditions.push({ column, ascending: options?.ascending })
    return this
  }

  limit(count: number): SupabaseQueryBuilder {
    this.limitCount = count
    return this
  }

  range(from: number, to: number): SupabaseQueryBuilder {
    this.offsetValue = from
    this.limitCount = to - from + 1
    return this
  }

  single(): Promise<{ data: any; error: any }> {
    this.isSingleResult = true
    return this.execute()
  }

  then(resolve: (result: { data: any; error: any; count?: number }) => void): void {
    this.execute().then(resolve)
  }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const options = {
        select: this.selectColumns,
        where: Object.keys(this.whereConditions).length > 0 ? this.whereConditions : undefined,
        orderBy: this.orderByConditions.length > 0 ? this.orderByConditions : undefined,
        limit: this.limitCount,
        offset: this.offsetValue,
      }

      let result: any

      switch (this.operation) {
        case 'select':
          if (this.isSingleResult) {
            result = await this.dbClient.selectOne(this.table, options)
          } else {
            result = await this.dbClient.select(this.table, options)
          }
          break

        case 'insert':
          result = await this.dbClient.insert(this.table, this.insertData, {
            returning: this.selectColumns !== '*' ? this.selectColumns : undefined
          })
          break

        case 'update':
          result = await this.dbClient.update(this.table, this.updateData, {
            ...options,
            returning: this.selectColumns !== '*' ? this.selectColumns : undefined
          })
          break

        case 'upsert':
          result = await this.dbClient.upsert(this.table, this.insertData, {
            returning: this.selectColumns !== '*' ? this.selectColumns : undefined
          })
          break

        case 'delete':
          result = await this.dbClient.delete(this.table, options)
          break

        default:
          throw new Error(`Unsupported operation: ${this.operation}`)
      }

      return {
        data: result.data,
        error: result.error,
        count: result.count
      }
    } catch (error) {
      return {
        data: null,
        error: error as Error
      }
    }
  }
}

class SupabaseCompatClientImpl implements SupabaseCompatClient {
  constructor(private dbClient: DatabaseClient) {}

  from(table: string): SupabaseQueryBuilder {
    return new SupabaseQueryBuilderImpl(this.dbClient, table)
  }

  async rpc(functionName: string, params?: any): Promise<{ data: any; error: any }> {
    const result = await this.dbClient.rpc({ functionName, params })
    return {
      data: result.data,
      error: result.error
    }
  }
}

// 创建兼容性客户端
export function createSupabaseCompatClient(useServiceRole = false): SupabaseCompatClient {
  if (DB_PROVIDER === 'supabase') {
    // 如果使用 Supabase，直接返回原生客户端
    const { createSupabaseClient, createSupabaseAdmin } = require('../providers/supabase')
    return useServiceRole ? createSupabaseAdmin() : createSupabaseClient()
  } else {
    // 如果使用其他数据库，返回兼容性适配器
    return new SupabaseCompatClientImpl(db)
  }
}

// 导出便捷函数，替换原有的 supabase 导入
export const supabase = createSupabaseCompatClient()
export const supabaseAdmin = createSupabaseCompatClient(true)
