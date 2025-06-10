# 数据库存储优化方案

## 🎯 **现状分析**

### **存储限制**
- 💾 **总存储**: 1GB
- 👥 **用户规模**: 1000人
- 🔥 **同时在线**: 50人左右
- 📊 **数据增长**: 需要控制

### **当前表结构问题**
```sql
-- key_usage_logs 表可能产生大量数据
CREATE TABLE key_usage_logs (
  id UUID PRIMARY KEY,           -- 36字节
  shared_key_id UUID,           -- 36字节  
  user_id UUID,                 -- 36字节
  request_data JSONB,           -- 可能很大
  response_data JSONB,          -- 可能很大
  created_at TIMESTAMP,         -- 8字节
  -- 每条记录可能 200-1000+ 字节
);
```

## 🔧 **优化策略**

### **方案1: 删除 key_usage_logs 表** ⭐ **推荐**

#### **删除理由**
- 📊 **数据冗余**: `daily_logs` 已经记录使用统计
- 💾 **存储占用**: 详细日志占用大量空间
- 🔄 **功能重叠**: 与新的使用量系统重复
- 🎯 **核心需求**: 限额控制比详细日志更重要

#### **保留的安全性**
```sql
-- 保留核心统计在 daily_logs
{
  "conversation_count": 15,
  "api_call_count": 45,
  "shared_key_usage": {
    "key_123": 10,
    "key_456": 5
  },
  "last_usage_at": "2024-01-15T10:30:00Z"
}
```

### **方案2: 精简 key_usage_logs 表**

#### **如果必须保留，极简化设计**
```sql
CREATE TABLE key_usage_logs (
  id BIGSERIAL PRIMARY KEY,      -- 8字节，比UUID小
  shared_key_id UUID NOT NULL,  -- 36字节
  user_id UUID NOT NULL,        -- 36字节
  usage_type SMALLINT,          -- 2字节 (1=对话,2=API调用)
  status_code SMALLINT,         -- 2字节 (200,400,500等)
  created_at TIMESTAMP,         -- 8字节
  -- 总计: ~90字节/记录
);

-- 只保留7天数据
CREATE INDEX idx_key_usage_logs_cleanup ON key_usage_logs(created_at);
```

#### **自动清理策略**
```sql
-- 每日清理7天前的数据
CREATE OR REPLACE FUNCTION cleanup_key_usage_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM key_usage_logs 
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

### **方案3: 混合统计方案** ⭐ **最佳平衡**

#### **核心思路**
- 🗑️ **删除详细日志**: 移除 `key_usage_logs`
- 📊 **增强统计**: 在 `daily_logs` 中记录更多统计
- 🔒 **保留安全**: 在 `shared_keys` 表中记录关键指标

#### **增强的 daily_logs 结构**
```sql
-- daily_logs.log_data 增强结构
{
  "conversation_count": 15,
  "api_call_count": 45,
  "upload_count": 3,
  
  // 🔥 新增：共享Key使用统计
  "shared_key_usage": {
    "total_calls": 25,
    "successful_calls": 23,
    "failed_calls": 2,
    "keys_used": ["key_123", "key_456"],
    "last_key_used": "key_123",
    "last_usage_at": "2024-01-15T10:30:00Z"
  },
  
  // 🔥 新增：错误统计
  "error_stats": {
    "rate_limit_hits": 1,
    "auth_failures": 0,
    "server_errors": 1
  }
}
```

#### **shared_keys 表增强**
```sql
-- 在 shared_keys 表中添加实时统计字段
ALTER TABLE shared_keys ADD COLUMN IF NOT EXISTS usage_stats JSONB DEFAULT '{}';

-- usage_stats 结构
{
  "total_usage_count": 1250,      // 总使用次数
  "usage_count_today": 45,        // 今日使用次数
  "last_used_at": "2024-01-15T10:30:00Z",
  "active_users_today": 12,       // 今日活跃用户数
  "success_rate_7d": 0.95,        // 7日成功率
  "avg_daily_usage_7d": 38        // 7日平均使用量
}
```

## 📊 **存储空间估算**

### **删除 key_usage_logs 后的存储**
```
用户表 (users): 1000用户 × 500字节 = 500KB
共享Key (shared_keys): 100个Key × 1KB = 100KB  
每日日志 (daily_logs): 1000用户 × 30天 × 500字节 = 15MB
其他表: ~5MB

总计: ~20MB (节省 >95% 存储空间)
```

### **保留精简日志的存储**
```
精简日志: 50人 × 100次/天 × 7天 × 90字节 = 3.15MB
其他数据: ~20MB

总计: ~25MB (仍然节省 >90% 存储空间)
```

## 🛡️ **安全性保障**

### **1. 实时监控**
```sql
-- 在应用层记录关键事件
CREATE TABLE security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50),        -- 'rate_limit', 'auth_fail', 'abuse'
  user_id UUID,
  shared_key_id UUID,
  severity SMALLINT,             -- 1-5
  details JSONB,                 -- 最小化的关键信息
  created_at TIMESTAMP
);

-- 只保留30天，自动清理
```

### **2. 聚合统计**
```sql
-- 每小时聚合统计
CREATE TABLE hourly_stats (
  id BIGSERIAL PRIMARY KEY,
  hour_start TIMESTAMP,
  shared_key_id UUID,
  total_requests INTEGER,
  successful_requests INTEGER,
  unique_users INTEGER,
  avg_response_time INTEGER
);
```

### **3. 异常检测**
```typescript
// 应用层实时检测
class SecurityMonitor {
  async checkAbnormalUsage(userId: string, keyId: string) {
    // 检查频率异常
    // 检查失败率异常  
    // 检查用户行为异常
    // 只记录异常事件，不记录正常使用
  }
}
```

## 🔄 **迁移方案**

### **步骤1: 数据备份**
```sql
-- 备份关键统计数据
CREATE TABLE key_usage_summary AS
SELECT 
  shared_key_id,
  COUNT(*) as total_usage,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as last_used_at
FROM key_usage_logs
GROUP BY shared_key_id;
```

### **步骤2: 更新 shared_keys**
```sql
-- 将统计数据迁移到 shared_keys 表
UPDATE shared_keys 
SET usage_stats = jsonb_build_object(
  'total_usage_count', COALESCE(s.total_usage, 0),
  'unique_users', COALESCE(s.unique_users, 0),
  'last_used_at', COALESCE(s.last_used_at, NOW())
)
FROM key_usage_summary s
WHERE shared_keys.id = s.shared_key_id;
```

### **步骤3: 删除旧表**
```sql
-- 确认数据迁移完成后删除
DROP TABLE IF EXISTS key_usage_logs;
```

## 📈 **性能优化**

### **1. 索引优化**
```sql
-- 只保留必要索引
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX idx_shared_keys_active ON shared_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_security_events_recent ON security_events(created_at) WHERE created_at > NOW() - INTERVAL '7 days';
```

### **2. 分区策略**
```sql
-- 按月分区 daily_logs (如果数据量大)
CREATE TABLE daily_logs_2024_01 PARTITION OF daily_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### **3. 压缩优化**
```sql
-- 启用JSONB压缩
ALTER TABLE daily_logs ALTER COLUMN log_data SET STORAGE EXTENDED;
ALTER TABLE shared_keys ALTER COLUMN usage_stats SET STORAGE EXTENDED;
```

## 🎯 **推荐方案**

### **最终建议: 方案3 (混合统计)**

#### **删除**
- ❌ `key_usage_logs` 表 (节省 >90% 存储)

#### **保留/增强**
- ✅ `daily_logs` 增强统计功能
- ✅ `shared_keys` 添加实时统计
- ✅ `security_events` 记录异常事件

#### **优势**
- 💾 **存储节省**: 从 >500MB 降至 <25MB
- 🔒 **安全保障**: 保留关键安全监控
- 📊 **功能完整**: 统计功能不受影响
- ⚡ **性能提升**: 查询速度更快

#### **实施步骤**
1. 🔄 迁移关键统计数据
2. 🗑️ 删除 `key_usage_logs` 表
3. 📊 部署新的统计系统
4. 🛡️ 实施异常监控

这样既能大幅节省存储空间，又能保持必要的安全性和功能完整性！🎯
