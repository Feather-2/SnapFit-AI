import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // 测试数据库连接和基本操作
    const testResults = {
      status: 'success',
      tests: [] as any[],
      timestamp: new Date().toISOString(),
    }

    // 测试1: 创建用户
    try {
      const user = await DatabaseService.createOrGetUser('test@example.com', 'Test User')
      testResults.tests.push({
        name: '创建用户',
        status: 'success',
        result: { id: user.id, email: user.email, name: user.name }
      })

      // 测试2: 创建用户配置文件
      const profile = await DatabaseService.getOrCreateUserProfile(user.id)
      testResults.tests.push({
        name: '创建用户配置文件',
        status: 'success',
        result: { id: profile.id, userId: profile.userId }
      })

      // 测试3: 更新AI配置
      const aiConfig = await DatabaseService.updateAIConfig(user.id, {
        agentModel: {
          name: 'gpt-4',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'test-key'
        }
      })
      testResults.tests.push({
        name: '更新AI配置',
        status: 'success',
        result: { id: aiConfig.id, agentModelName: aiConfig.agentModelName }
      })

      // 测试4: 创建日志记录
      const today = new Date().toISOString().split('T')[0]
      const dailyLog = await DatabaseService.createOrUpdateDailyLog(user.id, today, {
        weight: 70,
        totalCaloriesConsumed: 2000,
        totalCaloriesBurned: 500,
        netCalories: 1500,
        mood: 'happy',
        sleepHours: 8
      })
      testResults.tests.push({
        name: '创建日志记录',
        status: 'success',
        result: { id: dailyLog.id, date: dailyLog.date, weight: dailyLog.weight }
      })

      // 测试5: 添加食物记录
      const foodEntry = await DatabaseService.addFoodEntry(dailyLog.id, {
        name: '苹果',
        calories: 80,
        carbs: 20,
        protein: 0.5,
        fat: 0.2,
        amount: '1个'
      })
      testResults.tests.push({
        name: '添加食物记录',
        status: 'success',
        result: { id: foodEntry.id, name: foodEntry.name, calories: foodEntry.calories }
      })

      // 测试6: 添加运动记录
      const exerciseEntry = await DatabaseService.addExerciseEntry(dailyLog.id, {
        name: '跑步',
        type: 'cardio',
        duration: 30,
        calories: 300,
        intensity: 'medium'
      })
      testResults.tests.push({
        name: '添加运动记录',
        status: 'success',
        result: { id: exerciseEntry.id, name: exerciseEntry.name, calories: exerciseEntry.calories }
      })

      // 测试7: 保存AI记忆
      await DatabaseService.saveAIMemory(user.id, 'user_preferences', 'diet_goal', 'lose_weight', '用户目标')
      testResults.tests.push({
        name: '保存AI记忆',
        status: 'success',
        result: { category: 'user_preferences', key: 'diet_goal', value: 'lose_weight' }
      })

      // 测试8: 获取完整的日志数据
      const fullLog = await DatabaseService.getDailyLog(user.id, today)
      testResults.tests.push({
        name: '获取完整日志数据',
        status: 'success',
        result: {
          foodEntriesCount: fullLog?.foodEntries.length || 0,
          exerciseEntriesCount: fullLog?.exerciseEntries.length || 0
        }
      })

    } catch (error: any) {
      testResults.tests.push({
        name: '测试失败',
        status: 'error',
        error: error.message
      })
    }

    return NextResponse.json(testResults, { 
      headers: { 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 