// 数据库抽象层类型定义

export type DatabaseProvider = 'supabase' | 'postgresql'

// 统一的查询结果接口
export interface QueryResult<T = any> {
  data: T | null
  error: Error | null
  count?: number
}

// 统一的查询选项
export interface QueryOptions {
  select?: string
  where?: Record<string, any>
  orderBy?: { column: string; ascending?: boolean }[]
  limit?: number
  offset?: number
}

// 统一的插入/更新选项
export interface UpsertOptions {
  onConflict?: string
  returning?: string
}

// RPC 调用选项
export interface RPCOptions {
  functionName: string
  params?: Record<string, any>
}

// 数据库客户端接口
export interface DatabaseClient {
  // 基本 CRUD 操作
  select<T = any>(table: string, options?: QueryOptions): Promise<QueryResult<T[]>>
  selectOne<T = any>(table: string, options?: QueryOptions): Promise<QueryResult<T>>
  insert<T = any>(table: string, data: any, options?: UpsertOptions): Promise<QueryResult<T>>
  update<T = any>(table: string, data: any, options?: QueryOptions & UpsertOptions): Promise<QueryResult<T>>
  upsert<T = any>(table: string, data: any, options?: UpsertOptions): Promise<QueryResult<T>>
  delete<T = any>(table: string, options?: QueryOptions): Promise<QueryResult<T>>
  
  // RPC 函数调用
  rpc<T = any>(options: RPCOptions): Promise<QueryResult<T>>
  
  // 事务支持
  transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>
  
  // 连接管理
  connect?(): Promise<void>
  disconnect?(): Promise<void>
}

// 服务端客户端接口（支持认证上下文）
export interface ServerDatabaseClient extends DatabaseClient {
  // 带认证上下文的操作
  withAuth(userId?: string): DatabaseClient
}

// 用户相关类型
export interface User {
  id: string
  linux_do_id?: string
  username?: string
  display_name?: string
  avatar_url?: string
  email?: string
  trust_level: number
  is_active: boolean
  is_silenced: boolean
  last_login_at?: string
  login_count: number
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  weight?: number
  height?: number
  age?: number
  gender?: string
  activity_level?: string
  goal?: string
  target_weight?: number
  target_calories?: number
  notes?: string
  professional_mode?: boolean
  medical_history?: string
  lifestyle?: string
  health_awareness?: string
  created_at: string
  updated_at: string
}

export interface SharedKey {
  id: string
  user_id: string
  name: string
  base_url: string
  api_key_encrypted: string
  available_models: string[]
  daily_limit: number
  description?: string
  tags?: string[]
  is_active: boolean
  usage_count_today: number
  total_usage_count: number
  last_used_at?: string
  created_at: string
  updated_at: string
}

export interface DailyLog {
  id: string
  user_id: string
  date: string
  log_data: any
  last_modified: string
}

export interface AIMemory {
  id: string
  user_id: string
  expert_id: string
  content: string
  version: number
  last_updated: string
  created_at: string
}
