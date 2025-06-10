# 共享密钥功能修复总结

## 问题描述

在共享密钥功能的"第一步：选择共享模型"中出现问题，主要原因是数据库表结构与代码实现之间存在不一致：

- **数据库表结构**: 使用 `model_name` 字段（单个模型）
- **代码实现**: 使用 `available_models` 字段（模型数组）

这导致了以下问题：
1. 共享密钥上传时数据格式不匹配
2. 模型选择功能无法正常工作
3. API 路由处理逻辑错误
4. 公共密钥列表获取失败

## 修复内容

### 1. 数据库表结构更新

**文件**: `SHARED_KEYS_SETUP.md`
- 将 `model_name text NOT NULL` 改为 `available_models text[] NOT NULL`
- 支持每个密钥配置多个可用模型

### 2. Supabase 类型定义更新

**文件**: `lib/supabase.ts`
- 更新 `shared_keys` 表的 TypeScript 类型定义
- 将 `model_name: string` 改为 `available_models: string[]`

### 3. API 路由修复

**文件**: `app/api/shared-keys/route.ts`
- 修复 POST 请求处理逻辑
- 从请求体中获取 `availableModels` 而不是 `modelName`
- 更新验证逻辑以支持模型数组
- 使用第一个模型进行 API Key 测试

**文件**: `app/api/cron/update-models/route.ts`
- 更新定时任务以使用新的字段名
- 添加公共解密方法调用
- 修复模型名称引用

### 4. KeyManager 类增强

**文件**: `lib/key-manager.ts`
- 添加公共解密方法 `decryptApiKeyPublic()`
- 确保所有方法都正确处理 `available_models` 数组

### 5. 前端组件修复

**文件**: `components/shared-keys/key-upload-form.tsx`
- 确保表单提交时发送正确的数据格式
- 明确指定 `availableModels` 字段

## 数据库迁移

创建了迁移脚本 `database-migration-available-models.sql` 来处理现有数据：

1. 添加新的 `available_models` 字段
2. 将现有 `model_name` 数据迁移到数组格式
3. 提供验证查询来确认迁移结果
4. 可选的清理步骤（删除旧字段）

## 测试验证

创建了测试脚本 `test-shared-keys-fix.tsx` 来验证修复：

1. 测试共享密钥的添加功能
2. 验证基于模型的密钥获取
3. 检查用户密钥列表功能
4. 测试密钥更新和删除
5. 验证 API Key 测试功能

## 部署步骤

### 1. 备份数据库
```sql
-- 创建备份表
CREATE TABLE shared_keys_backup AS SELECT * FROM shared_keys;
```

### 2. 执行数据库迁移
```bash
# 在 Supabase 控制台中执行
psql -f database-migration-available-models.sql
```

### 3. 部署代码更新
```bash
# 部署到生产环境
git add .
git commit -m "fix: 修复共享密钥多模型支持"
git push origin main
```

### 4. 验证功能
1. 访问设置页面的 AI 配置部分
2. 选择"共享池"作为数据源
3. 验证"第一步：选择共享模型"是否正常显示模型列表
4. 测试模型选择和密钥配置功能

## 注意事项

1. **数据备份**: 在执行迁移前务必备份数据库
2. **渐进式迁移**: 建议先保留 `model_name` 字段一段时间作为备份
3. **测试环境**: 先在测试环境中验证所有功能正常
4. **监控**: 部署后密切监控错误日志和用户反馈

## 预期效果

修复完成后，用户应该能够：

1. ✅ 正常访问共享密钥配置页面
2. ✅ 看到可用的共享模型列表
3. ✅ 选择特定的模型进行配置
4. ✅ 在自动和手动模式之间切换
5. ✅ 成功保存和使用共享密钥配置

## 后续优化

1. 添加模型兼容性检查
2. 实现更智能的负载均衡算法
3. 增加模型使用统计和分析
4. 优化用户界面和体验
