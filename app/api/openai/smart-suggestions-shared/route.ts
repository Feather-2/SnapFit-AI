import { SharedOpenAIClient } from "@/lib/shared-openai-client"
import type { DailyLog, UserProfile } from "@/lib/types"
import { formatDailyStatusForAI } from "@/lib/utils"
import { checkApiAuth } from '@/lib/api-auth-helper'

export async function POST(req: Request) {
  try {
    const { dailyLog, userProfile, recentLogs, aiConfig } = await req.json()

    if (!dailyLog || !userProfile) {
      return Response.json({ error: "Missing required data" }, { status: 400 })
    }

    // 🔒 统一的身份验证和限制检查（只对共享模式进行限制）
    const authResult = await checkApiAuth(aiConfig, 'conversation_count')

    if (!authResult.success) {
      return Response.json({
        error: authResult.error!.message,
        code: authResult.error!.code
      }, { status: authResult.error!.status })
    }

    const { session } = authResult

    // 获取用户选择的工作模型并检查模式
    let selectedModel = "gemini-2.5-flash-preview-05-20" // 默认模型
    let fallbackConfig: { baseUrl: string; apiKey: string } | undefined = undefined
    const isSharedMode = aiConfig?.agentModel?.source === 'shared'

    if (isSharedMode && aiConfig?.agentModel?.sharedKeyConfig?.selectedModel) {
      // 共享模式：使用 selectedModel
      selectedModel = aiConfig.agentModel.sharedKeyConfig.selectedModel
    } else if (!isSharedMode) {
      // 私有模式：使用用户自己的配置
      if (aiConfig?.agentModel?.name) {
        selectedModel = aiConfig.agentModel.name
      }

      // 设置私有配置作为fallback
      if (aiConfig?.agentModel?.baseUrl && aiConfig?.agentModel?.apiKey) {
        fallbackConfig = {
          baseUrl: aiConfig.agentModel.baseUrl,
          apiKey: aiConfig.agentModel.apiKey
        }
      } else {
        return Response.json({
          error: "私有模式需要完整的AI配置（模型名称、API地址、API密钥）",
          code: "INCOMPLETE_AI_CONFIG"
        }, { status: 400 })
      }
    }

    console.log('🔍 Using selected model:', selectedModel)
    console.log('🔍 Model source:', aiConfig?.agentModel?.source)
    console.log('🔍 Fallback config available:', !!fallbackConfig)

    // 使用已验证的用户ID
    const userId = session.user.id

    // 创建共享客户端（支持私有模式fallback）
    const sharedClient = new SharedOpenAIClient({
      userId,
      preferredModel: selectedModel,
      fallbackConfig,
      preferPrivate: !isSharedMode // 私有模式优先使用私有配置
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
        exerciseNames: log.exerciseEntries.map((entry: any) => `${entry.exercise_name}${entry.time_period ? `(${entry.time_period})` : ""}`).slice(0, 3),
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
          model: selectedModel,
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
    const suggestionResults = await Promise.all(suggestionPromises)



    // 合并所有分类，并进行后处理
    // 每个 result 本身就是一个 category，不需要访问 .categories
    const allCategories = suggestionResults.filter(result => result.suggestions && result.suggestions.length > 0)



    // 对AI的原始输出进行清理和验证
    const validatedCategories = allCategories.map((category: any) => {
      // 如果summary缺失，从建议标题自动生成
      if (!category.summary || category.summary.trim() === "") {
        if (category.suggestions && category.suggestions.length > 0) {
          category.summary = "要点: " + category.suggestions.slice(0, 2).map((s: any) => s.title).join('; ')
        } else {
          category.summary = "暂无具体建议"
        }
      }
      return category
    })

    // 按优先级排序
    const priorityOrder: { [key: string]: number } = { high: 0, medium: 1, low: 2 }
    validatedCategories.sort((a, b) => {
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
    })

    // 获取当前使用的Key信息
    const currentKeyInfo = sharedClient.getCurrentKeyInfo()

    // 返回正确的数据结构，与前端期望的 SmartSuggestionsResponse 类型匹配
    return Response.json({
      suggestions: validatedCategories,
      generatedAt: new Date().toISOString(),
      dataDate: dailyLog.date,
      keyInfo: currentKeyInfo
    })

  } catch (error) {
    console.error('Smart suggestions API error:', error)
    return Response.json({
      error: "Failed to generate suggestions",
      code: "AI_SERVICE_ERROR",
      suggestions: []
    }, { status: 500 })
  }
}
