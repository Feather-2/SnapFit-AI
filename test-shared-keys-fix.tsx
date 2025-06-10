/**
 * 测试共享密钥功能修复的脚本
 * 这个文件用于验证共享密钥的多模型支持是否正常工作
 */

import { KeyManager } from '@/lib/key-manager'

// 测试数据
const testSharedKeyConfig = {
  userId: 'test-user-id',
  name: '测试配置',
  baseUrl: 'https://api.openai.com',
  apiKey: 'sk-test-key',
  availableModels: ['gpt-4o', 'gemini-2.5-flash-preview-05-20', 'gpt-3.5-turbo'],
  dailyLimit: 100,
  description: '测试用的共享密钥配置',
  tags: ['test', 'openai'],
  isActive: true,
  usageCountToday: 0,
  totalUsageCount: 0
}

async function testSharedKeyFunctionality() {
  console.log('🧪 开始测试共享密钥功能...')

  const keyManager = new KeyManager()

  try {
    // 测试1: 添加共享密钥
    console.log('📝 测试1: 添加共享密钥')
    const addResult = await keyManager.addSharedKey(testSharedKeyConfig)
    console.log('添加结果:', addResult)

    if (!addResult.success) {
      console.error('❌ 添加共享密钥失败:', addResult.error)
      return
    }

    const keyId = addResult.id!
    console.log('✅ 成功添加共享密钥，ID:', keyId)

    // 测试2: 获取可用密钥（基于模型）
    console.log('\n🔍 测试2: 获取可用密钥')
    for (const model of testSharedKeyConfig.availableModels) {
      const getResult = await keyManager.getAvailableKey(model)
      console.log(`模型 ${model}:`, getResult.key ? '✅ 找到可用密钥' : `❌ 未找到: ${getResult.error}`)
    }

    // 测试3: 获取用户密钥列表
    console.log('\n📋 测试3: 获取用户密钥列表')
    const userKeysResult = await keyManager.getUserKeys(testSharedKeyConfig.userId)
    console.log('用户密钥数量:', userKeysResult.keys.length)
    console.log('第一个密钥的可用模型:', userKeysResult.keys[0]?.availableModels)

    // 测试4: 更新密钥
    console.log('\n🔄 测试4: 更新密钥')
    const updateResult = await keyManager.updateSharedKey(keyId, {
      isActive: false,
      dailyLimit: 50
    })
    console.log('更新结果:', updateResult.success ? '✅ 成功' : `❌ 失败: ${updateResult.error}`)

    // 测试5: 验证更新后的状态
    console.log('\n✅ 测试5: 验证更新后的状态')
    const updatedKeysResult = await keyManager.getUserKeys(testSharedKeyConfig.userId)
    const updatedKey = updatedKeysResult.keys.find(k => k.id === keyId)
    console.log('密钥状态:', updatedKey?.isActive ? '激活' : '未激活')
    console.log('每日限制:', updatedKey?.dailyLimit)

    // 清理: 删除测试密钥
    console.log('\n🧹 清理: 删除测试密钥')
    const deleteResult = await keyManager.deleteSharedKey(keyId)
    console.log('删除结果:', deleteResult.success ? '✅ 成功' : `❌ 失败: ${deleteResult.error}`)

    console.log('\n🎉 所有测试完成！')

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

// 测试API Key测试功能
async function testApiKeyTesting() {
  console.log('\n🔑 测试API Key测试功能...')

  const keyManager = new KeyManager()

  // 注意：这里使用的是示例配置，实际测试时需要有效的API Key
  const testResult = await keyManager.testApiKey(
    'https://api.openai.com',
    'sk-test-invalid-key', // 无效的测试密钥
    'gpt-4o'
  )

  console.log('API测试结果:', testResult)
  console.log('是否成功:', testResult.success ? '✅' : '❌')
  if (testResult.availableModels) {
    console.log('发现的模型:', testResult.availableModels)
  }
  if (testResult.error) {
    console.log('错误信息:', testResult.error)
  }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  // 服务器端环境
  testSharedKeyFunctionality()
    .then(() => testApiKeyTesting())
    .catch(console.error)
}

export { testSharedKeyFunctionality, testApiKeyTesting }
