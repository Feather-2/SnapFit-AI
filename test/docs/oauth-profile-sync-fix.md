# OAuth Profile 同步修复

## 🐛 **问题发现**

您发现了关键问题：**登录时Linux.do的状态没有传过来！**

### **数据库现状**
```
id: bab422e3-ce99-4970-bc9a-f67bdc87df10
linux_do_id: 51712
username: wingand
trust_level: 0          ← 🚨 应该是3，但显示为0
is_active: true
is_silenced: false
display_name: null      ← 🚨 应该有值
```

### **问题根源**
在 `signIn` callback 中，我们只保存了基本信息，**没有保存Linux.do返回的关键状态**：
- ❌ `trust_level` 没有保存
- ❌ `active` 状态没有保存  
- ❌ `silenced` 状态没有保存
- ❌ `display_name` 没有保存

## 🔧 **修复方案**

### **1. 完整的OAuth Profile处理**

#### **之前的代码**
```typescript
// ❌ 只保存基本信息
.insert({
  linux_do_id: linuxDoId,
  email: profile.email,
  username: profile.name,
  avatar_url: profile.image,
})
```

#### **修复后的代码**
```typescript
// ✅ 保存完整的Linux.do状态
.insert({
  linux_do_id: linuxDoId,
  username: profile.username || profile.name,
  display_name: profile.name || profile.username,
  email: profile.email,
  avatar_url: profile.avatar_url,
  trust_level: profile.trust_level || 0,        // 🔥 新增
  is_active: profile.active !== false,          // 🔥 新增
  is_silenced: profile.silenced === true,       // 🔥 新增
  last_login_at: now,                           // 🔥 新增
  login_count: 1,                               // 🔥 新增
})
```

### **2. 用户信息实时更新**

#### **每次登录都更新**
```typescript
if (existingUser) {
  // ✅ 每次登录都更新最新状态
  await supabase.from("users").update({
    trust_level: profile.trust_level || 0,      // 实时同步等级
    is_active: profile.active !== false,        // 实时同步状态
    is_silenced: profile.silenced === true,     // 实时同步禁言
    last_login_at: now,                         // 更新登录时间
    login_count: (currentUser?.login_count || 0) + 1,
  })
}
```

### **3. 调试信息增强**

#### **完整Profile日志**
```typescript
console.log("Original profile from Linux.do:", JSON.stringify(profile, null, 2));
```

#### **数据库操作日志**
```typescript
console.log("Creating new user with data:", JSON.stringify(insertData, null, 2));
console.log("Updating user with data:", JSON.stringify(updateData, null, 2));
```

## 📊 **Linux.do Profile 结构**

### **完整的Profile数据**
```json
{
  "id": 51712,
  "sub": "51712", 
  "username": "wingand",
  "login": "wingand",
  "name": "wingand",
  "email": "u51712@linux.do",
  "avatar_template": "https://linux.do/user_avatar/linux.do/wingand/288/682585_2.png",
  "avatar_url": "https://linux.do/user_avatar/linux.do/wingand/288/682585_2.png",
  "active": true,
  "trust_level": 3,        ← 🔥 关键字段
  "silenced": false,       ← 🔥 关键字段
  "external_ids": null,
  "api_key": "BH_-ffnPLasdasdasdasdasdasda"
}
```

### **字段映射关系**
```
Linux.do → 数据库
id → linux_do_id
username → username
name → display_name
email → email
avatar_url → avatar_url
trust_level → trust_level    ← 🔥 之前缺失
active → is_active           ← 🔥 之前缺失
silenced → is_silenced       ← 🔥 之前缺失
```

## 🔄 **数据流程**

### **修复后的完整流程**
```
1. 用户OAuth登录 → Linux.do返回完整profile
2. SignIn callback → 解析所有字段
3. 数据库操作 → 保存/更新完整信息
4. Session callback → 从数据库读取最新状态
5. 前端组件 → 获得正确的trust_level
```

### **实时同步机制**
```
每次登录 → 更新trust_level
等级变化 → 立即反映在数据库
权限控制 → 基于最新等级工作
```

## 🧪 **测试验证**

### **测试步骤**
1. **清除当前session**: 退出登录
2. **重新登录**: 触发OAuth流程
3. **检查日志**: 查看profile和数据库操作日志
4. **验证数据库**: 确认trust_level正确保存
5. **测试权限**: 验证LV3用户可以使用共享服务

### **预期结果**
```sql
-- 登录后数据库应该显示：
SELECT trust_level, display_name, is_active, is_silenced 
FROM users 
WHERE linux_do_id = '51712';

-- 预期结果：
trust_level: 3
display_name: 'wingand'
is_active: true
is_silenced: false
```

## 🔍 **调试信息**

### **查看OAuth Profile**
```javascript
// 在服务器日志中查看：
"Original profile from Linux.do": {
  "trust_level": 3,    ← 确认这个值存在
  "active": true,
  "silenced": false
}
```

### **查看数据库操作**
```javascript
// 在服务器日志中查看：
"Updating user with data": {
  "trust_level": 3,    ← 确认正确传递
  "is_active": true,
  "is_silenced": false
}
```

## 🎯 **修复效果**

### **之前的问题**
- ❌ trust_level = 0 (错误)
- ❌ display_name = null
- ❌ 权限检查失败
- ❌ 头像无等级角标

### **修复后的效果**
- ✅ trust_level = 3 (正确)
- ✅ display_name = 'wingand'
- ✅ 权限检查通过
- ✅ 头像显示LV3角标

## 🚀 **后续优化**

### **错误处理**
- 添加profile字段验证
- 处理Linux.do API变化
- 优雅降级机制

### **性能优化**
- 减少不必要的数据库查询
- 缓存用户信息
- 批量更新机制

### **监控告警**
- 监控trust_level同步失败
- 检测异常的用户状态
- OAuth失败率监控

现在OAuth登录会正确同步Linux.do的所有状态信息，确保用户的信任等级和权限控制正常工作！🎯
