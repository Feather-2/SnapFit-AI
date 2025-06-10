import { OpenAICompatibleClient } from "@/lib/openai-client"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: Request) {
  try {
    const { text, type, userWeight } = await req.json()

    if (!text) {
      return Response.json({ error: "No text provided" }, { status: 400 })
    }

    // 获取AI配置
    const aiConfigStr = req.headers.get("x-ai-config")
    if (!aiConfigStr) {
      return Response.json({ error: "AI configuration not found" }, { status: 400 })
    }

    const aiConfig = JSON.parse(aiConfigStr)
    const modelConfig = type === "food" ? aiConfig.agentModel : aiConfig.agentModel

    // 创建客户端
    const client = new OpenAICompatibleClient(modelConfig.baseUrl, modelConfig.apiKey)

    // 根据类型选择不同的提示词和解析逻辑
    if (type === "food") {
      // 食物解析提示词
      const prompt = `
        请分析以下文本中描述的食物，并将其转换为结构化的 JSON 格式。
        文本: "${text}"

        请直接输出 JSON，不要有额外文本。如果无法确定数值，请给出合理估算，并在相应字段标记 is_estimated: true。

        每个食物项应包含以下字段:
        - log_id: 唯一标识符
        - food_name: 食物名称
        - consumed_grams: 消耗的克数
        - meal_type: 餐次类型 (breakfast, lunch, dinner, snack)
        - time_period: 时间段 (morning, noon, afternoon, evening)，根据文本内容推断
        - nutritional_info_per_100g: 每100克的营养成分，包括 calories, carbohydrates, protein, fat 等
        - total_nutritional_info_consumed: 基于消耗克数计算的总营养成分
        - is_estimated: 是否为估算值

        示例输出格式:
        {
          "food": [
            {
              "log_id": "uuid",
              "food_name": "全麦面包",
              "consumed_grams": 80,
              "meal_type": "breakfast",
              "time_period": "morning",
              "nutritional_info_per_100g": {
                "calories": 265,
                "carbohydrates": 48.5,
                "protein": 9.0,
                "fat": 3.2,
                "fiber": 7.4
              },
              "total_nutritional_info_consumed": {
                "calories": 212,
                "carbohydrates": 38.8,
                "protein": 7.2,
                "fat": 2.56,
                "fiber": 5.92
              },
              "is_estimated": true
            }
          ]
        }
      `

      const { text: resultText } = await client.generateText({
        model: modelConfig.name,
        prompt,
        response_format: { type: "json_object" },
      })

      // 清理从AI返回的JSON字符串，移除可能的markdown代码块
      const cleanedResultText = resultText.replace(/```json\n|```/g, "").trim();

      // 解析结果
      const result = JSON.parse(cleanedResultText)

      // 为每个食物项添加唯一 ID
      if (result.food && Array.isArray(result.food)) {
        result.food.forEach((item: any) => {
          item.log_id = uuidv4()
        })
      }

      return Response.json(result)
    } else if (type === "exercise") {
      // 运动解析提示词
      const prompt = `
        请分析以下文本中描述的运动，并将其转换为结构化的 JSON 格式。
        文本: "${text}"
        用户体重: ${userWeight || 70} kg

        请直接输出 JSON，不要有额外文本。如果无法确定数值，请给出合理估算，并在相应字段标记 is_estimated: true。

        每个运动项应包含以下字段:
        - log_id: 唯一标识符
        - exercise_name: 运动名称
        - exercise_type: 运动类型 (cardio, strength, flexibility, other)
        - duration_minutes: 持续时间(分钟)
        - distance_km: 距离(公里，仅适用于有氧运动)
        - sets: 组数(仅适用于力量训练)
        - reps: 次数(仅适用于力量训练)
        - weight_kg: 重量(公斤，仅适用于力量训练)
        - estimated_mets: 代谢当量(MET值)
        - user_weight: 用户体重(公斤)
        - calories_burned_estimated: 估算的卡路里消耗
        - muscle_groups: 锻炼的肌肉群
        - is_estimated: 是否为估算值

        示例输出格式:
        {
          "exercise": [
            {
              "log_id": "uuid",
              "exercise_name": "跑步",
              "exercise_type": "cardio",
              "duration_minutes": 30,
              "distance_km": 5,
              "estimated_mets": 8.3,
              "user_weight": 70,
              "calories_burned_estimated": 290.5,
              "muscle_groups": ["腿部", "核心"],
              "is_estimated": true
            }
          ]
        }
      `

      const { text: resultText } = await client.generateText({
        model: modelConfig.name,
        prompt,
        response_format: { type: "json_object" },
      })

      // 清理从AI返回的JSON字符串，移除可能的markdown代码块
      const cleanedResultText = resultText.replace(/```json\n|```/g, "").trim();

      // 解析结果
      const result = JSON.parse(cleanedResultText)

      // 为每个运动项添加唯一 ID
      if (result.exercise && Array.isArray(result.exercise)) {
        result.exercise.forEach((item: any) => {
          item.log_id = uuidv4()
        })
      }

      return Response.json(result)
    } else {
      return Response.json({ error: "Invalid type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error:", error)
    return Response.json({ error: "Failed to process request" }, { status: 500 })
  }
}
