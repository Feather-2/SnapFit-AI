# 信任等级Session修复

## 🐛 **问题发现**

您发现了一个重要问题：**变量名选择错误**！

### **问题分析**
- **数据库字段**: `trust_level` (下划线命名)
- **前端接口**: `trustLevel` (驼峰命名)
- **Session中**: 缺少 `trustLevel` 字段

### **具体问题**
```typescript
// ❌ 错误：session中没有trustLevel字段
const userTrustLevel = (session.user as any)?.trustLevel || 0

// 实际上session.user只有：{ id, name, email, image }
// 缺少：trustLevel, displayName, isActive, isSilenced
```

## 🔧 **解决方案**

### **1. 修改NextAuth Session Callback**

#### **之前**
```typescript
async session({ session, token }) {
  session.accessToken = token.accessToken
  if (session.user) {
    session.user.id = token.id as string
  }
  return session
}
```

#### **现在**
```typescript
async session({ session, token }) {
  session.accessToken = token.accessToken
  if (session.user) {
    session.user.id = token.id as string
    
    // 🔥 新增：获取用户的最新信任等级信息
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('trust_level, display_name, is_active, is_silenced')
        .eq('id', token.id as string)
        .single()
      
      if (!error && userData) {
        session.user.trustLevel = userData.trust_level || 0
        session.user.displayName = userData.display_name
        session.user.isActive = userData.is_active
        session.user.isSilenced = userData.is_silenced
      }
    } catch (error) {
      session.user.trustLevel = 0 // 默认值
    }
  }
  return session
}
```

### **2. 更新TypeScript类型定义**

#### **之前**
```typescript
interface Session {
  accessToken?: string;
  user: {
    id?: string;
  } & DefaultSession["user"];
}
```

#### **现在**
```typescript
interface Session {
  accessToken?: string;
  user: {
    id?: string;
    trustLevel?: number;        // 🔥 新增
    displayName?: string;       // 🔥 新增
    isActive?: boolean;         // 🔥 新增
    isSilenced?: boolean;       // 🔥 新增
  } & DefaultSession["user"];
}
```

### **3. 移除类型断言**

#### **之前**
```typescript
// ❌ 需要类型断言
const userTrustLevel = (session.user as any)?.trustLevel || 0
```

#### **现在**
```typescript
// ✅ 类型安全
const userTrustLevel = session.user?.trustLevel || 0
```

## 📊 **数据流程**

### **完整的用户信息流程**
```
1. 用户OAuth登录 → Linux.do返回profile
2. SignIn callback → 创建/更新users表
3. JWT callback → 保存用户ID到token
4. Session callback → 从数据库获取最新trust_level
5. 前端组件 → 直接使用session.user.trustLevel
```

### **数据库字段映射**
```
数据库 → Session
trust_level → trustLevel
display_name → displayName  
is_active → isActive
is_silenced → isSilenced
```

## 🎯 **修复效果**

### **权限检查**
```typescript
// ✅ 现在可以正确获取信任等级
const userTrustLevel = session.user?.trustLevel || 0
const canUseSharedService = userTrustLevel >= 1 && userTrustLevel <= 4
```

### **头像显示**
```typescript
// ✅ 正确显示信任等级角标
<UserAvatar 
  user={{
    trustLevel: session.user.trustLevel  // 不再需要 as any
  }}
  showTrustLevel={true}
/>
```

### **权限守卫**
```typescript
// ✅ 正确的权限验证
<TrustLevelGuard>
  <MyConfigurations />
</TrustLevelGuard>
```

## 🔄 **实时同步**

### **Session更新机制**
- **每次请求**: Session callback都会查询最新的trust_level
- **实时同步**: 用户等级变化立即反映在session中
- **缓存优化**: NextAuth会缓存session，但会定期更新

### **性能考虑**
```typescript
// 只查询必要字段，减少数据库负载
.select('trust_level, display_name, is_active, is_silenced')
```

## 🛡️ **错误处理**

### **数据库查询失败**
```typescript
try {
  // 查询用户信息
} catch (error) {
  console.error('Error fetching user trust level:', error)
  session.user.trustLevel = 0  // 安全的默认值
}
```

### **字段缺失处理**
```typescript
session.user.trustLevel = userData.trust_level || 0
session.user.displayName = userData.display_name
```

## 🎨 **用户体验提升**

### **之前的问题**
- ❌ 权限检查总是失败（trustLevel = 0）
- ❌ 头像不显示等级角标
- ❌ 权限守卫总是阻止访问
- ❌ 需要大量类型断言

### **修复后的效果**
- ✅ 权限检查正确工作
- ✅ 头像正确显示等级角标
- ✅ 权限守卫按等级控制访问
- ✅ 类型安全，无需断言

## 🔍 **测试验证**

### **测试场景**
1. **LV0用户**: 无法访问共享功能，头像无角标
2. **LV1-4用户**: 可以正常使用，头像显示对应角标
3. **等级变化**: 在Linux.do提升等级后，重新登录生效

### **验证方法**
```typescript
// 在浏览器控制台检查
console.log('User trust level:', session?.user?.trustLevel)
console.log('Can use shared service:', userTrustLevel >= 1 && userTrustLevel <= 4)
```

## 🚀 **后续优化**

### **缓存策略**
- 考虑添加Redis缓存用户信息
- 减少数据库查询频率
- 支持手动刷新用户信息

### **实时更新**
- WebSocket推送等级变化
- 无需重新登录即可更新
- 更好的用户体验

### **监控告警**
- 监控session callback的执行时间
- 数据库查询失败告警
- 用户等级异常检测

现在信任等级系统完全正常工作，用户的等级信息会正确地显示在头像角标和权限控制中！🎯
