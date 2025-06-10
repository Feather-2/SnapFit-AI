import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import type { DailyLog, UserProfile, AIConfig } from "@/lib/types"
import { formatDailyStatusForAI } from "@/lib/utils"

export async function POST(req: Request) {
  console.log("=== Advice Stream API Request Started ===")

  try {
    const { dailyLog, userProfile } = await req.json() as { dailyLog: DailyLog; userProfile: UserProfile }

    if (!dailyLog || !userProfile) {
      return Response.json({ error: "Missing required data" }, { status: 400 })
    }

    // 获取AI配置
    const aiConfigStr = req.headers.get("x-ai-config")
    if (!aiConfigStr) {
      return Response.json({ error: "AI configuration not found" }, { status: 400 })
    }

    const aiConfig = JSON.parse(aiConfigStr) as AIConfig
    const modelConfig = aiConfig.agentModel

    console.log("Agent model config:", {
      name: modelConfig?.name,
      baseUrl: modelConfig?.baseUrl,
      hasApiKey: !!modelConfig?.apiKey,
    })

    // 创建自定义OpenAI实例
    const openai = createOpenAI({
      baseURL: modelConfig.baseUrl.endsWith("/v1") ? modelConfig.baseUrl : `${modelConfig.baseUrl}/v1`,
      apiKey: modelConfig.apiKey,
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
            `- ${entry.exercise_name} (${entry.duration_minutes}分钟): ${entry.calories_burned_estimated.toFixed(
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

    console.log("Creating advice stream with AI SDK...")

    // 使用AI SDK的streamText
    const result = await streamText({
      model: openai(modelConfig.name),
      prompt,
    })

    console.log("Advice stream created successfully")

    // 返回流式响应
    return result.toTextStreamResponse()
  } catch (error) {
    console.error("=== Advice Stream API Error ===")
    console.error("Error details:", error)
    return Response.json({ error: "Failed to generate advice" }, { status: 500 })
  }
}
