import { OpenAICompatibleClient } from "@/lib/openai-client";
import type { DailyLog, UserProfile } from "@/lib/types";
import { formatDailyStatusForAI } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const { dailyLog, userProfile, recentLogs } = await req.json();

    if (!dailyLog || !userProfile) {
      return Response.json({ error: "Missing required data" }, { status: 400 });
    }

    // 获取AI配置
    const aiConfigStr = req.headers.get("x-ai-config");
    if (!aiConfigStr) {
      return Response.json(
        { error: "AI configuration not found" },
        { status: 400 }
      );
    }

    const aiConfig = JSON.parse(aiConfigStr);
    const modelConfig = aiConfig.agentModel;

    // 创建客户端
    const client = new OpenAICompatibleClient(
      modelConfig.baseUrl,
      modelConfig.apiKey
    );

    // 准备数据摘要
    const dataSummary = {
      today: {
        date: dailyLog.date,
        calories: dailyLog.summary.totalCaloriesConsumed,
        protein: dailyLog.summary.macros.protein,
        carbs: dailyLog.summary.macros.carbs,
        fat: dailyLog.summary.macros.fat,
        exercise: dailyLog.summary.totalCaloriesBurned,
        weight: dailyLog.weight,
        bmr: dailyLog.calculatedBMR,
        tdee: dailyLog.calculatedTDEE,
        tefAnalysis: dailyLog.tefAnalysis,
        foodEntries: dailyLog.foodEntries.map((entry) => ({
          name: entry.food_name,
          mealType: entry.meal_type,
          calories: entry.total_nutritional_info_consumed?.calories || 0,
          protein: entry.total_nutritional_info_consumed?.protein || 0,
          timestamp: entry.timestamp,
        })),
        exerciseEntries: dailyLog.exerciseEntries.map((entry) => ({
          name: entry.exercise_name,
          calories: entry.calories_burned,
          duration: entry.duration_minutes,
        })),
        dailyStatus: formatDailyStatusForAI(dailyLog.dailyStatus),
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
        notes:
          [
            userProfile.notes,
            userProfile.professionalMode && userProfile.medicalHistory
              ? `\n\n医疗信息: ${userProfile.medicalHistory}`
              : "",
            userProfile.professionalMode && userProfile.lifestyle
              ? `\n\n生活方式: ${userProfile.lifestyle}`
              : "",
            userProfile.professionalMode && userProfile.healthAwareness
              ? `\n\n健康认知: ${userProfile.healthAwareness}`
              : "",
          ]
            .filter(Boolean)
            .join("") || undefined,
      },
      recent: recentLogs
        ? recentLogs.slice(0, 7).map((log: any) => ({
            date: log.date,
            calories: log.summary.totalCaloriesConsumed,
            exercise: log.summary.totalCaloriesBurned,
            weight: log.weight,
            foodNames: log.foodEntries
              .map((entry: any) => entry.food_name)
              .slice(0, 5), // 只取前5个食物名称
            exerciseNames: log.exerciseEntries
              .map((entry: any) => entry.exercise_name)
              .slice(0, 3), // 只取前3个运动名称
            dailyStatus: formatDailyStatusForAI(log.dailyStatus),
          }))
        : [],
    };

    // 定义不同类型的建议提示词
    const suggestionPrompts = {
      nutrition: `
        你是一位注册营养师(RD)，专精宏量营养素配比和膳食结构优化。

        数据：${JSON.stringify(dataSummary, null, 2)}

        专业分析要点：
        1. 宏量营养素配比评估（蛋白质15-25%，脂肪20-35%，碳水45-65%）
        2. 热量平衡与目标匹配度
        3. 食物选择的营养密度分析
        4. 微量营养素潜在缺口识别
        5. 每日状态对营养需求的影响（压力、心情、健康状况、睡眠质量）

        请提供3-4个具体的营养优化建议，每个建议需包含：
        - 明确的营养学依据
        - 具体的食物替换或添加方案
        - 量化的改进目标

        JSON格式：
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

        专业分析要点：
        1. 运动量与TDEE目标的匹配度评估
        2. 有氧vs无氧运动配比优化（基于用户目标）
        3. 运动时机与代谢窗口利用
        4. 运动强度区间建议（基于心率储备）
        5. 每日状态对运动能力的影响（压力水平、心情状态、健康状况、睡眠质量）

        请提供2-3个基于运动科学的训练优化建议：
        - 具体的运动类型、强度、时长
        - 运动时机与营养配合策略
        - 渐进式训练计划

        JSON格式：
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
      `,

      metabolism: `
        你是一位内分泌代谢专家，专精能量代谢调节和体重管理的生理机制。

        数据：${JSON.stringify(dataSummary, null, 2)}

        专业分析要点：
        1. 基础代谢率与实际消耗的匹配度
        2. TEF优化策略（基于食物热效应数据）
        3. 代谢适应性评估（基于体重变化趋势）
        4. 胰岛素敏感性和代谢灵活性指标

        请提供2-3个基于代谢生理学的优化建议：
        - 进餐时机与代谢节律同步
        - 宏量营养素时序分配
        - 代谢率提升的具体策略

        JSON格式：
        {
          "category": "代谢调节优化",
          "priority": "high|medium|low",
          "suggestions": [
            {
              "title": "代谢优化方案",
              "description": "基于内分泌生理学的详细调节策略",
              "actionable": true,
              "icon": "🔥"
            }
          ],
          "summary": "代谢效率专业评价"
        }
      `,

      behavior: `
        你是一位行为心理学专家，专精健康行为改变和习惯养成的科学方法。

        数据：${JSON.stringify(dataSummary, null, 2)}

        专业分析要点：
        1. 饮食行为模式识别（基于进餐时间和频率）
        2. 行为一致性评估（基于7天数据趋势）
        3. 习惯形成的关键触发点分析
        4. 行为改变的阻力因素识别
        5. 心理状态对行为的影响（压力、心情对饮食和运动习惯的影响）

        请提供2-3个基于行为科学的习惯优化建议：
        - 具体的行为改变策略（基于行为链分析）
        - 环境设计和提示系统
        - 渐进式习惯建立计划

        JSON格式：
        {
          "category": "行为习惯优化",
          "priority": "high|medium|low",
          "suggestions": [
            {
              "title": "行为改变方案",
              "description": "基于行为心理学的详细习惯养成策略",
              "actionable": true,
              "icon": "🧠"
            }
          ],
          "summary": "行为模式专业评价"
        }
      `,

      timing: `
        你是一位时间营养学专家，专精生物节律与营养时机的优化策略。

        数据：${JSON.stringify(dataSummary, null, 2)}

        专业分析要点：
        1. 进餐时机与昼夜节律的同步性
        2. 运动时机与代谢窗口的匹配
        3. 营养素时序分配的优化空间
        4. 睡眠-代谢-营养的协调性
        5. 睡眠时间和质量对时机安排的影响（基于睡眠数据优化作息）

        请提供2-3个基于时间生物学的时机优化建议：
        - 最佳进餐和运动时间窗口
        - 营养素的时序化摄入策略
        - 生物节律同步的具体方法

        JSON格式：
        {
          "category": "时机优化策略",
          "priority": "high|medium|low",
          "suggestions": [
            {
              "title": "时机优化方案",
              "description": "基于时间营养学的详细时序安排",
              "actionable": true,
              "icon": "⏰"
            }
          ],
          "summary": "时机协调专业评价"
        }
      `,

      wellness: `
        你是一位整体健康专家，专精压力管理、睡眠优化和心理健康的综合调节。

        数据：${JSON.stringify(dataSummary, null, 2)}

        专业分析要点：
        1. 压力水平对代谢和食欲的影响评估
        2. 心情状态与饮食行为的关联分析
        3. 睡眠质量对恢复和代谢的影响
        4. 整体健康状况的综合评价
        5. 压力-睡眠-营养-运动的协调优化

        请提供2-3个基于整体健康的优化建议：
        - 压力管理和情绪调节策略
        - 睡眠质量改善方案
        - 心理健康与身体健康的协调方法

        JSON格式：
        {
          "category": "整体健康优化",
          "priority": "high|medium|low",
          "suggestions": [
            {
              "title": "整体健康方案",
              "description": "基于心理生理学的综合健康优化策略",
              "actionable": true,
              "icon": "🌟"
            }
          ],
          "summary": "整体健康状况专业评价"
        }
      `,
    };

    // 并发获取所有建议
    const suggestionPromises = Object.entries(suggestionPrompts).map(
      async ([key, prompt]) => {
        try {
          const { text } = await client.generateText({
            model: modelConfig.name,
            prompt,
            response_format: { type: "json_object" },
          });

          const result = JSON.parse(text);
          return { key, ...result };
        } catch (error) {
          console.warn(`Failed to get ${key} suggestions:`, error);
          return {
            key,
            category: key,
            priority: "low",
            suggestions: [],
            summary: "分析暂时不可用",
          };
        }
      }
    );

    // 等待所有建议完成
    const allSuggestions = await Promise.all(suggestionPromises);

    // 按优先级排序
    const priorityOrder: Record<string, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };
    allSuggestions.sort(
      (a: any, b: any) =>
        (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
    );

    return Response.json({
      suggestions: allSuggestions,
      generatedAt: new Date().toISOString(),
      dataDate: dailyLog.date,
    });
  } catch (error) {
    console.error("Smart Suggestions Error:", error);
    return Response.json(
      {
        error: "Failed to generate suggestions",
        suggestions: [],
      },
      { status: 500 }
    );
  }
}
