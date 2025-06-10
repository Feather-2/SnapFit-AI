import { SharedOpenAIClient } from "@/lib/shared-openai-client"
import type { FoodEntry } from "@/lib/types"
import { checkApiAuth } from '@/lib/api-auth-helper'

export async function POST(req: Request) {
  try {
    const { foodEntries, aiConfig } = await req.json()

    if (!foodEntries || !Array.isArray(foodEntries)) {
      return Response.json({ error: "Invalid food entries provided" }, { status: 400 })
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

    // 创建共享客户端（支持私有模式fallback）
    const sharedClient = new SharedOpenAIClient({
      userId: session.user.id,
      preferredModel: selectedModel,
      fallbackConfig,
      preferPrivate: !isSharedMode // 私有模式优先使用私有配置
    })

    // 准备膳食数据用于分析
    const mealData = foodEntries.map((entry: FoodEntry) => ({
      food_name: entry.food_name,
      meal_type: entry.meal_type,
      time_period: entry.time_period,
      timestamp: entry.timestamp,
      consumed_grams: entry.consumed_grams,
      macros: {
        protein: entry.total_nutritional_info_consumed?.protein || 0,
        carbs: entry.total_nutritional_info_consumed?.carbohydrates || 0,
        fat: entry.total_nutritional_info_consumed?.fat || 0,
        calories: entry.total_nutritional_info_consumed?.calories || 0
      }
    }))

    // AI 分析提示词
    const prompt = `
      作为营养学专家，请分析以下膳食记录，重点关注可能影响食物热效应(TEF)的因素。

      膳食记录：
      ${JSON.stringify(mealData, null, 2)}

      请分析以下方面：

      1. **咖啡因摄入分析**：
         - 识别含咖啡因的食物/饮品（咖啡、茶类、巧克力等）
         - 评估摄入时间和可能的持续影响时间
         - 咖啡因可提高TEF 5-15%

      2. **药物和补剂影响**：
         - 识别可能影响代谢的物质（如绿茶提取物、辣椒素、生姜、肉桂、姜黄等）
         - 评估这些物质的TEF增强效果

      3. **食物特性分析**：
         - 辛辣食物（辣椒、胡椒、生姜等）可提高TEF 5-10%
         - 冷饮需要额外能量加热
         - 代谢增强物质（肉桂、柠檬、MCT油等）

      注意：不要分析高蛋白食物的TEF效果，因为蛋白质的热效应已经在基础计算中考虑了

      4. **时间因素**：
         - 分析各餐的时间间隔
         - TEF效应通常持续3-6小时
         - 考虑叠加效应

      5. **综合评估**：
         - 给出TEF增强乘数建议（1.0-1.3之间）
         - 列出主要影响因素
         - 提供改善建议

      请以JSON格式返回分析结果：
      {
        "enhancementMultiplier": 1.15,
        "enhancementFactors": ["咖啡因", "辛辣食物", "代谢增强物质"],
        "detailedAnalysis": {
          "caffeineAnalysis": "检测到咖啡摄入，预计影响3-6小时",
          "spicyFoodAnalysis": "含有辛辣成分，可提高代谢率",
          "coldDrinkAnalysis": "冷饮摄入需要额外热量加热",
          "timingAnalysis": "餐间时间合理，TEF效应可能叠加",
          "medicationAnalysis": "检测到代谢增强物质如肉桂、生姜等"
        },
        "recommendations": [
          "建议在运动前30分钟饮用咖啡以最大化TEF效果",
          "可以适量增加辛辣调料的使用",
          "考虑添加肉桂或生姜等天然代谢增强剂"
        ],
        "confidence": 0.85
      }

      注意：
      - 乘数范围应在1.0-1.3之间
      - 要考虑食物摄入的时间顺序
      - 分析要基于科学证据
      - 如果信息不足，请说明并给出保守估计
    `

    const { text, keyInfo } = await sharedClient.generateText({
      model: selectedModel,
      prompt,
      response_format: { type: "json_object" },
    })

    // 解析AI分析结果
    const analysisResult = JSON.parse(text)

    // 验证和规范化结果
    const enhancementMultiplier = Math.max(1.0, Math.min(1.3, analysisResult.enhancementMultiplier || 1.0))
    const enhancementFactors = Array.isArray(analysisResult.enhancementFactors)
      ? analysisResult.enhancementFactors
      : []

    return Response.json({
      enhancementMultiplier,
      enhancementFactors,
      detailedAnalysis: analysisResult.detailedAnalysis || {},
      recommendations: analysisResult.recommendations || [],
      confidence: analysisResult.confidence || 0.5,
      analysisTimestamp: new Date().toISOString(),
      keyInfo // 包含使用的Key信息
    })

  } catch (error) {
    console.error('TEF analysis API error:', error)
    return Response.json({
      error: "Failed to analyze TEF factors",
      code: "AI_SERVICE_ERROR",
      enhancementMultiplier: 1.0,
      enhancementFactors: [],
      detailedAnalysis: {},
      recommendations: [],
      confidence: 0
    }, { status: 500 })
  }
}
