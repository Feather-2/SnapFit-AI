import { SharedOpenAIClient } from "@/lib/shared-openai-client"
import type { DailyLog, UserProfile } from "@/lib/types"
import { formatDailyStatusForAI } from "@/lib/utils"
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { dailyLog, userProfile, recentLogs } = await req.json()

    if (!dailyLog || !userProfile) {
      return Response.json({ error: "Missing required data" }, { status: 400 })
    }

    // 获取用户身份（从认证头或session）
    const authHeader = req.headers.get("authorization")
    let userId: string | null = null
    let fallbackConfig: any = null

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
        if (!authError && user) {
          userId = user.id
        }
      } catch (error) {
        console.warn('Failed to get user from token:', error)
      }
    }

    // 如果没有用户身份，尝试从AI配置获取fallback
    if (!userId) {
      const aiConfigStr = req.headers.get("x-ai-config")
      if (aiConfigStr) {
        try {
          const aiConfig = JSON.parse(aiConfigStr)
          const modelConfig = aiConfig.agentModel
          if (modelConfig?.baseUrl && modelConfig?.apiKey) {
            fallbackConfig = {
              baseUrl: modelConfig.baseUrl,
              apiKey: modelConfig.apiKey
            }
            userId = 'anonymous' // 匿名用户
          }
        } catch (error) {
          console.warn('Failed to parse AI config:', error)
        }
      }
    }

    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    // 创建共享客户端
    const sharedClient = new SharedOpenAIClient({
      userId,
      preferredModel: "gpt-4o",
      fallbackConfig
    })

    // 准备数据摘要（与原版相同）
    const dataSummary = {
      today: {
        date: dailyLog.date,
        calories: dailyLog.summary.totalCalories,
        protein: dailyLog.summary.totalProtein,
        carbs: dailyLog.summary.totalCarbohydrates,
        fat: dailyLog.summary.totalFat,
        exercise: dailyLog.summary.totalExerciseCalories,
        weight: dailyLog.weight,
        bmr: dailyLog.calculatedBMR,
        tdee: dailyLog.calculatedTDEE,
        tefAnalysis: dailyLog.tefAnalysis,
        foodEntries: dailyLog.foodEntries.map((entry: any) => ({
          name: entry.food_name,
          mealType: entry.meal_type,
          calories: entry.total_nutritional_info_consumed?.calories || 0,
          protein: entry.total_nutritional_info_consumed?.protein || 0,
          timestamp: entry.timestamp
        })),
        exerciseEntries: dailyLog.exerciseEntries.map((entry: any) => ({
          name: entry.exercise_name,
          calories: entry.calories_burned,
          duration: entry.duration_minutes
        })),
        dailyStatus: formatDailyStatusForAI(dailyLog.dailyStatus)
      },
      profile: {
        age: userProfile.age,
        gender: userProfile.gender,
        height: userProfile.height,
        weight: userProfile.weight,
        activityLevel: userProfile.activityLevel,
        goal: userProfile.goal,
        targetWeight: userProfile.targetWeight,
        targetCalories: userProfile.targetCalories,
        notes: [
          userProfile.notes,
          userProfile.professionalMode && userProfile.medicalHistory ? `\n\n医疗信息: ${userProfile.medicalHistory}` : '',
          userProfile.professionalMode && userProfile.lifestyle ? `\n\n生活方式: ${userProfile.lifestyle}` : '',
          userProfile.professionalMode && userProfile.healthAwareness ? `\n\n健康认知: ${userProfile.healthAwareness}` : ''
        ].filter(Boolean).join('') || undefined
      },
      recent: recentLogs ? recentLogs.slice(0, 7).map((log: any) => ({
        date: log.date,
        calories: log.summary.totalCalories,
        exercise: log.summary.totalExerciseCalories,
        weight: log.weight,
        foodNames: log.foodEntries.map((entry: any) => entry.food_name).slice(0, 5),
        exerciseNames: log.exerciseEntries.map((entry: any) => entry.exercise_name).slice(0, 3),
        dailyStatus: formatDailyStatusForAI(log.dailyStatus)
      })) : []
    }

    // 定义建议提示词（简化版本，只包含营养和运动）
    const suggestionPrompts = {
      nutrition: `
        你是一位注册营养师(RD)，专精宏量营养素配比和膳食结构优化。

        数据：${JSON.stringify(dataSummary, null, 2)}

        请提供3-4个具体的营养优化建议，JSON格式：
        {
          "category": "营养配比优化",
          "priority": "high|medium|low",
          "suggestions": [
            {
              "title": "具体建议标题",
              "description": "基于营养学原理的详细说明和执行方案",
              "actionable": true,
              "icon": "🥗"
            }
          ],
          "summary": "营养状况专业评价"
        }
      `,
      
      exercise: `
        你是一位认证的运动生理学家，专精运动处方设计和能量代谢优化。

        数据：${JSON.stringify(dataSummary, null, 2)}

        请提供2-3个基于运动科学的训练优化建议，JSON格式：
        {
          "category": "运动处方优化",
          "priority": "high|medium|low",
          "suggestions": [
            {
              "title": "具体运动方案",
              "description": "基于运动生理学的详细训练计划",
              "actionable": true,
              "icon": "🏃‍♂️"
            }
          ],
          "summary": "运动效能专业评价"
        }
      `
    }

    // 并发获取所有建议，使用共享Key
    const suggestionPromises = Object.entries(suggestionPrompts).map(async ([key, prompt]) => {
      try {
        const { text, keyInfo } = await sharedClient.generateText({
          model: "gpt-4o",
          prompt,
          response_format: { type: "json_object" },
        })
        
        const result = JSON.parse(text)
        return { 
          key, 
          ...result,
          keyInfo // 包含使用的Key信息
        }
      } catch (error) {
        console.warn(`Failed to get ${key} suggestions:`, error)
        return {
          key,
          category: key,
          priority: "low",
          suggestions: [],
          summary: "分析暂时不可用",
          keyInfo: null
        }
      }
    })

    // 等待所有建议完成
    const allSuggestions = await Promise.all(suggestionPromises)

    // 按优先级排序
    const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 }
    allSuggestions.sort((a: any, b: any) =>
      (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
    )

    // 获取当前使用的Key信息
    const currentKeyInfo = sharedClient.getCurrentKeyInfo()

    return Response.json({
      suggestions: allSuggestions,
      generatedAt: new Date().toISOString(),
      dataDate: dailyLog.date,
      keyInfo: currentKeyInfo // 返回Key信息用于显示感谢信息
    })

  } catch (error) {
    console.error("Smart Suggestions Error:", error)
    return Response.json({ 
      error: "Failed to generate suggestions",
      suggestions: []
    }, { status: 500 })
  }
}
