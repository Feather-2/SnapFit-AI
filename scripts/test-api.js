// 简单的 API 测试脚本
const BASE_URL = 'http://localhost:3001'

async function testAPI() {
  console.log('开始测试 API...\n')

  try {
    // 1. 测试注册
    console.log('1. 测试用户注册...')
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'testuser',
        password: 'testpass123',
        inviteCode: 'snapifit2024'
      })
    })

    if (registerResponse.ok) {
      const registerData = await registerResponse.json()
      console.log('✓ 注册成功:', registerData.user.username)
      
      const token = registerData.token
      
      // 2. 测试获取用户信息
      console.log('\n2. 测试获取用户信息...')
      const meResponse = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (meResponse.ok) {
        const meData = await meResponse.json()
        console.log('✓ 获取用户信息成功:', meData.user.username)
      } else {
        console.log('✗ 获取用户信息失败')
      }

      // 3. 测试保存用户配置
      console.log('\n3. 测试保存用户配置...')
      const profileResponse = await fetch(`${BASE_URL}/api/db/user-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          weight: 70,
          height: 175,
          age: 25,
          gender: 'male',
          activityLevel: 'moderate',
          goal: 'maintain'
        })
      })
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        console.log('✓ 保存用户配置成功')
      } else {
        console.log('✗ 保存用户配置失败')
      }

      // 4. 测试保存每日日志
      console.log('\n4. 测试保存每日日志...')
      const logResponse = await fetch(`${BASE_URL}/api/db/daily-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: '2024-01-01',
          weight: 70.5,
          activityLevel: 'moderate'
        })
      })
      
      if (logResponse.ok) {
        const logData = await logResponse.json()
        console.log('✓ 保存每日日志成功')
      } else {
        console.log('✗ 保存每日日志失败')
      }

      // 5. 测试导出数据
      console.log('\n5. 测试导出数据...')
      const exportResponse = await fetch(`${BASE_URL}/api/db/export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (exportResponse.ok) {
        const exportData = await exportResponse.json()
        console.log('✓ 导出数据成功，包含:', Object.keys(exportData))
      } else {
        console.log('✗ 导出数据失败')
      }

    } else {
      const errorData = await registerResponse.json()
      console.log('✗ 注册失败:', errorData.error)
    }

  } catch (error) {
    console.error('测试过程中发生错误:', error.message)
  }

  console.log('\nAPI 测试完成')
}

// 运行测试
testAPI()
