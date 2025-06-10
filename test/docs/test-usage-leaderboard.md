# 使用排行榜功能测试

## 功能概述

### ✨ **新功能特性**

#### **1. 使用排行榜**
- 显示所有活跃的共享配置
- 按总使用量排序
- 显示配置名称、描述、标签
- 显示可用模型和健康状态
- 支持模型列表展开/收起

#### **2. 贡献者权限**
- 只有配置的创建者可以看到操作按钮
- 支持启用/停用配置
- 支持删除配置
- 实时更新状态

#### **3. 模型健康状态**
- 每个模型显示健康状态图标
- 绿色：健康 ✅
- 红色：不健康 ❌  
- 灰色：未知状态 ⏳

## 测试步骤

### **步骤 1: 访问页面**
1. 登录系统
2. 访问 `/settings/keys` 页面
3. 点击"使用排行榜" Tab

### **步骤 2: 查看排行榜**
1. 验证配置按使用量排序
2. 检查配置信息显示：
   - 配置名称
   - 创建者信息
   - 使用次数
   - 描述信息
   - 标签展示

### **步骤 3: 模型展示**
1. 查看前3个模型直接显示
2. 如果超过3个，点击"+N"展开
3. 验证模型健康状态图标

### **步骤 4: 贡献者操作**
1. 找到自己创建的配置
2. 测试启用/停用按钮
3. 测试删除功能（谨慎操作）

## API 端点

### **新增端点**
- `GET /api/shared-keys/leaderboard` - 获取使用排行榜
- `PATCH /api/shared-keys/[id]` - 更新配置
- `DELETE /api/shared-keys/[id]` - 删除配置

### **数据结构**
```typescript
interface SharedKey {
  id: string
  name: string
  baseUrl: string
  availableModels: string[]
  dailyLimit: number
  description: string
  tags: string[]
  isActive: boolean
  usageCountToday: number
  totalUsageCount: number
  createdAt: string
  modelHealth?: ModelHealth[]
  user: {
    id: string
    username: string
    avatarUrl?: string
  }
}

interface ModelHealth {
  model: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  lastChecked: string
  responseTime?: number
}
```

## 预期结果

### ✅ **成功指标**
1. 排行榜正确显示所有活跃配置
2. 配置信息完整准确
3. 模型列表正确展示
4. 贡献者可以管理自己的配置
5. 操作反馈及时准确

### 🚨 **注意事项**
1. 删除操作不可撤销，请谨慎测试
2. 模型健康状态目前为模拟数据
3. 需要登录才能看到操作按钮
4. 只能操作自己创建的配置

## 后续优化

### **模型健康检测**
- 实现定时任务每4小时检测模型状态
- 添加响应时间统计
- 支持手动触发健康检查

### **用户体验**
- 添加配置编辑功能
- 支持批量操作
- 添加使用统计图表
- 优化移动端显示

### **安全性**
- 添加操作确认对话框
- 实现操作日志记录
- 添加权限验证中间件
