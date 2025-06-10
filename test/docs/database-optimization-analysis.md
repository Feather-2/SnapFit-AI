# 数据库表结构优化分析

## 🤔 **key_usage_logs vs daily_logs**

### **现状分析**

#### **key_usage_logs 表**
```sql
-- 用途：记录共享API Key的具体使用情况
CREATE TABLE key_usage_logs (
  id uuid PRIMARY KEY,
  shared_key_id uuid REFERENCES shared_keys(id),
  user_id uuid REFERENCES users(id),
  api_endpoint text,
  model_used text,
  tokens_used integer,
  cost_estimate numeric,
  success boolean,
  error_message text,
  created_at timestamp
);
```

#### **daily_logs 表**
```sql
-- 用途：记录用户每日使用限额统计
CREATE TABLE daily_logs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  date date NOT NULL,
  log_data jsonb NOT NULL,  -- 聚合数据
  last_modified timestamp,
  UNIQUE(user_id, date)
);
```

## 🎯 **建议方案：保留两表但优化**

### **原因分析**

#### **1. 用途不同**
- **key_usage_logs**: 详细的API调用记录（审计、计费、调试）
- **daily_logs**: 聚合的使用统计（限额控制、用户体验）

#### **2. 查询模式不同**
- **key_usage_logs**: 按Key查询、按时间范围查询、错误分析
- **daily_logs**: 按用户查询今日使用量、快速限额检查

#### **3. 数据量级不同**
- **key_usage_logs**: 高频写入，每次API调用一条
- **daily_logs**: 低频写入，每用户每天一条

## 🔧 **优化建议**

### **1. 数据关联优化**

#### **在 daily_logs 中增加共享服务使用统计**
```sql
-- 优化 daily_logs 的 log_data 结构
{
  "conversation_count": 15,        -- 对话次数
  "api_call_count": 45,           -- API调用次数
  "upload_count": 3,              -- 上传次数
  "shared_service_usage": {       -- 🔥 新增：共享服务使用
    "total_calls": 12,
    "successful_calls": 11,
    "failed_calls": 1,
    "tokens_used": 15420,
    "estimated_cost": 0.23,
    "keys_used": ["key1", "key2"]
  },
  "last_conversation_at": "2024-01-15T10:30:00Z",
  "last_api_call_at": "2024-01-15T11:45:00Z"
}
```

### **2. 自动聚合机制**

#### **创建触发器自动更新 daily_logs**
```sql
-- 当 key_usage_logs 有新记录时，自动更新 daily_logs
CREATE OR REPLACE FUNCTION update_daily_logs_from_key_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新用户的每日统计
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    NEW.user_id,
    CURRENT_DATE,
    jsonb_build_object(
      'api_call_count', 1,
      'shared_service_usage', jsonb_build_object(
        'total_calls', 1,
        'successful_calls', CASE WHEN NEW.success THEN 1 ELSE 0 END,
        'failed_calls', CASE WHEN NEW.success THEN 0 ELSE 1 END,
        'tokens_used', COALESCE(NEW.tokens_used, 0),
        'estimated_cost', COALESCE(NEW.cost_estimate, 0)
      )
    )
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = daily_logs.log_data || jsonb_build_object(
      'api_call_count', 
      COALESCE((daily_logs.log_data->>'api_call_count')::int, 0) + 1,
      'shared_service_usage', 
      daily_logs.log_data->'shared_service_usage' || jsonb_build_object(
        'total_calls', 
        COALESCE((daily_logs.log_data->'shared_service_usage'->>'total_calls')::int, 0) + 1,
        'successful_calls',
        COALESCE((daily_logs.log_data->'shared_service_usage'->>'successful_calls')::int, 0) + 
        CASE WHEN NEW.success THEN 1 ELSE 0 END,
        'tokens_used',
        COALESCE((daily_logs.log_data->'shared_service_usage'->>'tokens_used')::int, 0) + 
        COALESCE(NEW.tokens_used, 0)
      )
    ),
    last_modified = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_logs_from_key_usage
  AFTER INSERT ON key_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_logs_from_key_usage();
```

### **3. 数据清理策略**

#### **分层清理策略**
```sql
-- key_usage_logs: 保留30天详细记录
CREATE OR REPLACE FUNCTION cleanup_old_key_usage_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM key_usage_logs 
  WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- daily_logs: 保留90天聚合记录
CREATE OR REPLACE FUNCTION cleanup_old_daily_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM daily_logs 
  WHERE date < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

## 📊 **使用场景分工**

### **key_usage_logs 专用场景**
- ✅ **API调用审计**: 谁在什么时候调用了哪个API
- ✅ **错误分析**: 失败的API调用详情
- ✅ **成本计算**: 精确的token消耗和成本统计
- ✅ **Key性能分析**: 哪个Key使用频率高、成功率如何
- ✅ **调试支持**: 具体的错误信息和调用参数

### **daily_logs 专用场景**
- ✅ **限额检查**: 快速检查用户今日是否还有额度
- ✅ **使用统计**: 用户的使用趋势和习惯分析
- ✅ **界面显示**: 导航栏的使用量进度条
- ✅ **报表生成**: 用户使用情况报表
- ✅ **性能优化**: 避免复杂的聚合查询

## 🔄 **数据流程优化**

### **写入流程**
```
1. 用户调用API
2. 记录到 key_usage_logs (详细记录)
3. 触发器自动更新 daily_logs (聚合统计)
4. 前端查询 daily_logs 显示使用情况
```

### **查询优化**
```typescript
// 快速限额检查 - 查询 daily_logs
async checkUsageLimit(userId: string) {
  return await supabase
    .from('daily_logs')
    .select('log_data')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
}

// 详细使用分析 - 查询 key_usage_logs
async getDetailedUsage(userId: string, keyId: string) {
  return await supabase
    .from('key_usage_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('shared_key_id', keyId)
    .gte('created_at', startDate)
}
```

## 💡 **最终建议**

### **保留两个表的理由**
1. ✅ **职责分离**: 详细记录 vs 聚合统计
2. ✅ **性能优化**: 避免复杂的实时聚合查询
3. ✅ **数据完整性**: 保留完整的审计轨迹
4. ✅ **扩展性**: 支持不同的查询需求

### **优化措施**
1. 🔧 **自动聚合**: 触发器自动更新聚合数据
2. 🗑️ **分层清理**: 不同的数据保留策略
3. 📊 **索引优化**: 针对不同查询模式优化索引
4. 🔄 **数据同步**: 确保两表数据一致性

### **代码层面的整合**
```typescript
class UsageManager {
  // 使用 daily_logs 进行快速限额检查
  async checkLimit(userId: string): Promise<UsageCheckResult>
  
  // 使用 key_usage_logs 记录详细使用
  async recordKeyUsage(keyId: string, usage: KeyUsageLog): Promise<void>
  
  // 使用 daily_logs 获取聚合统计
  async getUserStats(userId: string): Promise<UsageStats>
  
  // 使用 key_usage_logs 获取详细分析
  async getDetailedAnalysis(userId: string): Promise<DetailedUsage>
}
```

## 🎯 **结论**

**建议保留两个表**，但通过以下方式优化：

1. ✅ **明确分工**: key_usage_logs负责详细记录，daily_logs负责聚合统计
2. ✅ **自动同步**: 通过触发器保持数据一致性
3. ✅ **性能优化**: 针对不同用途优化查询策略
4. ✅ **数据治理**: 实施分层的数据清理策略

这样既保证了数据的完整性和可追溯性，又优化了查询性能和用户体验。
