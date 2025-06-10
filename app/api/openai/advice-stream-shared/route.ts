import { streamText } from "ai"
import { SharedOpenAIClient } from "@/lib/shared-openai-client"
import type { DailyLog, UserProfile } from "@/lib/types"
import { formatDailyStatusForAI } from "@/lib/utils"
import { checkApiAuth } from '@/lib/api-auth-helper'

export async function POST(req: Request) {
  try {
    const { dailyLog, userProfile, aiConfig } = await req.json() as {
      dailyLog: DailyLog;
      userProfile: UserProfile;
      aiConfig?: any;
    }

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

    console.log('🔍 Using selected model for advice stream:', selectedModel)
    console.log('🔍 Model source:', aiConfig?.agentModel?.source)
    console.log('🔍 Fallback config available:', !!fallbackConfig)

    // 创建共享客户端（支持私有模式fallback）
    const sharedClient = new SharedOpenAIClient({
      userId: session.user.id,
      preferredModel: selectedModel,
      fallbackConfig,
      preferPrivate: !isSharedMode // 私有模式优先使用私有配置
    })

    // 确定使用的体重
    const currentWeight = dailyLog.weight && dailyLog.weight > 0 ? dailyLog.weight : userProfile.weight

    // 构建提示词
    const prompt = `
      你是一个专业的健康顾问，请根据用户的健康数据提供个性化的建议。

      用户资料:
      - 体重: ${currentWeight} kg
      - 身高: ${userProfile.height} cm
      - 年龄: ${userProfile.age} 岁
      - 性别: ${userProfile.gender === "male" ? "男" : userProfile.gender === "female" ? "女" : "其他"}
      - 活动水平: ${
        ({
          sedentary: "久坐不动",
          light: "轻度活跃",
          moderate: "中度活跃",
          active: "高度活跃",
          very_active: "非常活跃",
        } as Record<string, string>)[userProfile.activityLevel] || userProfile.activityLevel
      }
      - 健康目标: ${
        ({
          lose_weight: "减重",
          maintain: "保持体重",
          gain_weight: "增重",
          build_muscle: "增肌",
          improve_health: "改善健康",
        } as Record<string, string>)[userProfile.goal] || userProfile.goal
      }
      ${userProfile.targetWeight ? `- 目标体重: ${userProfile.targetWeight} kg` : ""}
      ${userProfile.targetCalories ? `- 目标每日卡路里: ${userProfile.targetCalories} kcal` : ""}
      ${(() => {
        const notesContent = [
          userProfile.notes,
          userProfile.professionalMode && userProfile.medicalHistory ? `\n\n详细医疗信息:\n${userProfile.medicalHistory}` : '',
          userProfile.professionalMode && userProfile.lifestyle ? `\n\n生活方式信息:\n${userProfile.lifestyle}` : '',
          userProfile.professionalMode && userProfile.healthAwareness ? `\n\n健康认知与期望:\n${userProfile.healthAwareness}` : ''
        ].filter(Boolean).join('');
        return notesContent ? `- 其他注意事项: ${notesContent}` : '';
      })()}

      今日健康数据 (${dailyLog.date}):
      - 总卡路里摄入: ${dailyLog.summary.totalCaloriesConsumed.toFixed(0)} kcal
      - 总卡路里消耗: ${dailyLog.summary.totalCaloriesBurned.toFixed(0)} kcal
      - 净卡路里: ${(dailyLog.summary.totalCaloriesConsumed - dailyLog.summary.totalCaloriesBurned).toFixed(0)} kcal
      - 宏量营养素分布: 碳水 ${dailyLog.summary.macros.carbs.toFixed(1)}g, 蛋白质 ${dailyLog.summary.macros.protein.toFixed(
        1,
      )}g, 脂肪 ${dailyLog.summary.macros.fat.toFixed(1)}g

      食物记录:
      ${dailyLog.foodEntries
        .map(
          (entry) =>
            `- ${entry.food_name} (${entry.consumed_grams}g): ${entry.total_nutritional_info_consumed.calories.toFixed(
              0,
            )} kcal${entry.time_period ? ` - ${entry.time_period}` : ""}`,
        )
        .join("\n")}

      运动记录:
      ${dailyLog.exerciseEntries
        .map(
          (entry) =>
            `- ${entry.exercise_name} (${entry.duration_minutes}分钟${entry.time_period ? `, ${entry.time_period}` : ""}): ${entry.calories_burned_estimated.toFixed(
              0,
            )} kcal`,
        )
        .join("\n")}

      ${dailyLog.dailyStatus ? `
      每日状态:
      ${formatDailyStatusForAI(dailyLog.dailyStatus)}
      ` : ""}

      请提供个性化、可操作的健康建议，包括饮食和运动方面的具体建议。建议应该是积极、鼓励性的，并且与用户的健康目标相符。
      ${dailyLog.dailyStatus ? "请特别考虑用户的每日状态（压力、心情、健康状况、睡眠质量）对建议的影响。" : ""}
      请用中文回答，不超过300字，不需要分段，直接给出建议内容。
    `

    // 由于 SharedOpenAIClient 目前不支持流式，我们先使用普通生成然后返回
    // TODO: 后续可以扩展 SharedOpenAIClient 支持流式
    const { text } = await sharedClient.generateText({
      model: selectedModel,
      prompt,
    })

    // 返回文本响应（模拟流式）
    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Advice stream API error:', error)
    return Response.json({
      error: "Failed to generate advice",
      code: "AI_SERVICE_ERROR"
    }, { status: 500 })
  }
}
