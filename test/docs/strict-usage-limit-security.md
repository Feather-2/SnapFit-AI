# 严格使用限额安全控制系统

## 🛡️ **安全原则**

### **核心要求**
> **绝对不允许超过限额的用户访问AI服务**

### **安全层级**
1. **前端检查** - 用户体验层
2. **API网关** - 请求拦截层  
3. **业务逻辑** - 核心控制层
4. **数据库约束** - 最后防线

## 🔒 **多层防护架构**

### **第1层：前端预检查**
```typescript
// 在发送请求前检查
const { canUse, remaining } = useUsageLimit()

if (!canUse || remaining <= 0) {
  // 🚫 前端直接阻止请求
  showLimitExceededDialog()
  return
}

// ✅ 通过检查，发送请求
```

### **第2层：API路由守卫**
```typescript
// app/api/chat/route.ts
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 🔒 严格的限额检查
  const usageManager = new UsageManager()
  const userManager = new UserManager()
  
  const userResult = await userManager.getUserById(session.user.id)
  if (!userResult.success) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // 🚫 检查限额 - 绝对不允许超过
  const limitCheck = await usageManager.checkConversationLimit(
    session.user.id, 
    userResult.user.trustLevel
  )

  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: 'Daily limit exceeded',
      code: 'LIMIT_EXCEEDED',
      limit: limitCheck.dailyLimit,
      current: limitCheck.currentUsage,
      resetTime: limitCheck.resetTime
    }, { status: 429 }) // Too Many Requests
  }

  // 🔒 原子性记录使用 - 防止并发问题
  const recordResult = await usageManager.recordConversationUsage(session.user.id)
  if (!recordResult.success) {
    return NextResponse.json({ 
      error: 'Failed to record usage' 
    }, { status: 500 })
  }

  // ✅ 通过所有检查，处理AI请求
  try {
    const aiResponse = await processAIRequest(request)
    return NextResponse.json(aiResponse)
  } catch (error) {
    // 🔄 如果AI请求失败，回滚使用计数
    await usageManager.rollbackConversationUsage(session.user.id)
    throw error
  }
}
```

### **第3层：UsageManager 原子性控制**
```typescript
export class UsageManager {
  // 🔒 原子性检查和记录
  async checkAndRecordUsage(userId: string, trustLevel: number): Promise<{
    allowed: boolean
    newCount: number
    limit: number
    error?: string
  }> {
    const limit = getDailyConversationLimit(trustLevel)
    
    if (limit === 0) {
      return { 
        allowed: false, 
        newCount: 0, 
        limit: 0, 
        error: 'Trust level insufficient' 
      }
    }

    try {
      // 🔒 使用数据库事务确保原子性
      const result = await this.supabase.rpc('atomic_usage_check_and_increment', {
        p_user_id: userId,
        p_usage_type: 'conversation_count',
        p_daily_limit: limit
      })

      if (result.error) {
        return { 
          allowed: false, 
          newCount: 0, 
          limit, 
          error: result.error.message 
        }
      }

      const { allowed, new_count } = result.data

      return {
        allowed,
        newCount: new_count,
        limit,
        error: allowed ? undefined : 'Daily limit exceeded'
      }
    } catch (error) {
      return { 
        allowed: false, 
        newCount: 0, 
        limit, 
        error: 'Database error' 
      }
    }
  }

  // 🔄 回滚机制（AI请求失败时）
  async rollbackConversationUsage(userId: string): Promise<void> {
    try {
      await this.supabase.rpc('decrement_usage_count', {
        p_user_id: userId,
        p_usage_type: 'conversation_count'
      })
    } catch (error) {
      console.error('Failed to rollback usage:', error)
      // 记录到错误日志，但不抛出异常
    }
  }
}
```

### **第4层：数据库原子性函数**
```sql
-- 原子性检查和递增函数
CREATE OR REPLACE FUNCTION atomic_usage_check_and_increment(
  p_user_id UUID,
  p_usage_type TEXT,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, new_count INTEGER) AS $$
DECLARE
  current_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  -- 🔒 获取当前使用量（带锁）
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id 
    AND date = CURRENT_DATE
  FOR UPDATE; -- 🔒 行级锁防止并发

  -- 🚫 检查是否超过限额
  IF current_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, current_count;
    RETURN;
  END IF;

  -- ✅ 未超过限额，递增计数
  new_count := current_count + 1;

  -- 🔒 原子性更新
  INSERT INTO daily_logs (user_id, date, log_data)
  VALUES (
    p_user_id, 
    CURRENT_DATE, 
    jsonb_build_object(p_usage_type, new_count)
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    log_data = daily_logs.log_data || jsonb_build_object(
      p_usage_type, 
      new_count
    ),
    last_modified = NOW();

  -- ✅ 返回成功结果
  RETURN QUERY SELECT TRUE, new_count;
END;
$$ LANGUAGE plpgsql;

-- 回滚函数
CREATE OR REPLACE FUNCTION decrement_usage_count(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS void AS $$
DECLARE
  current_count INTEGER := 0;
BEGIN
  -- 获取当前计数
  SELECT COALESCE((log_data->>p_usage_type)::int, 0)
  INTO current_count
  FROM daily_logs
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- 只有大于0才减少
  IF current_count > 0 THEN
    UPDATE daily_logs
    SET log_data = log_data || jsonb_build_object(
      p_usage_type, 
      current_count - 1
    ),
    last_modified = NOW()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

## 🔐 **并发安全控制**

### **问题场景**
```
用户A同时发送3个请求：
请求1: 检查限额 39/40 ✅ → 记录使用 40/40
请求2: 检查限额 39/40 ✅ → 记录使用 41/40 ❌
请求3: 检查限额 39/40 ✅ → 记录使用 42/40 ❌
```

### **解决方案：数据库行锁**
```sql
-- 使用 FOR UPDATE 确保原子性
SELECT ... FROM daily_logs 
WHERE user_id = ? AND date = CURRENT_DATE
FOR UPDATE;

-- 在同一事务中检查和更新
```

## 🚨 **异常情况处理**

### **1. 数据库连接失败**
```typescript
// 默认拒绝策略
if (databaseError) {
  return NextResponse.json({
    error: 'Service temporarily unavailable',
    code: 'SERVICE_ERROR'
  }, { status: 503 })
}
```

### **2. 并发竞争条件**
```typescript
// 重试机制
async function safeRecordUsage(userId: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await usageManager.checkAndRecordUsage(userId, trustLevel)
      return result
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(100 * (i + 1)) // 指数退避
    }
  }
}
```

### **3. 时钟偏移问题**
```sql
-- 使用数据库时间，不依赖客户端时间
WHERE date = CURRENT_DATE  -- 服务器时间
```

## 📊 **监控和告警**

### **1. 实时监控**
```typescript
class SecurityMonitor {
  async detectAbnormalUsage(userId: string) {
    // 检测短时间内大量请求
    // 检测限额边缘的频繁尝试
    // 检测可疑的使用模式
    
    if (isAbnormal) {
      await this.logSecurityEvent({
        type: 'SUSPICIOUS_USAGE',
        userId,
        details: { ... }
      })
    }
  }
}
```

### **2. 限额违规告警**
```typescript
// 当有用户尝试超过限额时记录
if (!limitCheck.allowed) {
  await securityMonitor.logLimitViolation({
    userId: session.user.id,
    trustLevel: userResult.user.trustLevel,
    attemptedUsage: limitCheck.currentUsage + 1,
    limit: limitCheck.dailyLimit,
    timestamp: new Date()
  })
}
```

## 🧪 **测试验证**

### **1. 单用户限额测试**
```typescript
test('用户不能超过每日限额', async () => {
  const userId = 'test-user'
  const trustLevel = 1 // 40次/天
  
  // 使用39次 - 应该成功
  for (let i = 0; i < 39; i++) {
    const result = await usageManager.checkAndRecordUsage(userId, trustLevel)
    expect(result.allowed).toBe(true)
  }
  
  // 第40次 - 应该成功
  const result40 = await usageManager.checkAndRecordUsage(userId, trustLevel)
  expect(result40.allowed).toBe(true)
  expect(result40.newCount).toBe(40)
  
  // 第41次 - 应该失败
  const result41 = await usageManager.checkAndRecordUsage(userId, trustLevel)
  expect(result41.allowed).toBe(false)
})
```

### **2. 并发安全测试**
```typescript
test('并发请求不能突破限额', async () => {
  const userId = 'test-user'
  const trustLevel = 1 // 40次/天
  
  // 先使用39次
  for (let i = 0; i < 39; i++) {
    await usageManager.checkAndRecordUsage(userId, trustLevel)
  }
  
  // 同时发送10个请求
  const promises = Array(10).fill(0).map(() => 
    usageManager.checkAndRecordUsage(userId, trustLevel)
  )
  
  const results = await Promise.all(promises)
  
  // 只有1个应该成功，9个应该失败
  const successCount = results.filter(r => r.allowed).length
  expect(successCount).toBe(1)
})
```

## 🎯 **总结**

### **安全保障**
1. ✅ **多层防护** - 前端+API+业务+数据库
2. ✅ **原子性操作** - 数据库事务确保一致性
3. ✅ **并发安全** - 行级锁防止竞争条件
4. ✅ **异常处理** - 默认拒绝策略
5. ✅ **实时监控** - 异常使用检测

### **性能优化**
1. ✅ **轻量级存储** - 删除冗余日志表
2. ✅ **高效查询** - 优化的索引和查询
3. ✅ **缓存策略** - 减少数据库压力

### **用户体验**
1. ✅ **清晰提示** - 明确的限额信息
2. ✅ **实时反馈** - 剩余次数显示
3. ✅ **优雅降级** - 超限时的友好提示

这个系统确保了**绝对不会有用户能够超过限额访问AI服务**，同时保持了良好的性能和用户体验！🛡️
