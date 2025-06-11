import { SharedOpenAIClient } from "@/lib/shared-openai-client"
import type { DailyLog, UserProfile } from "@/lib/types"
import { formatDailyStatusForAI } from "@/lib/utils"
import { checkApiAuth } from '@/lib/api-auth-helper'
import { VERCEL_CONFIG } from '@/lib/vercel-config'

// 流式响应编码器 - 增强版本
function encodeChunk(data: any) {
  try {
    return `data: ${JSON.stringify(data)}\n\n`;
  } catch (error) {
    console.error('[Stream] Failed to encode chunk:', error);
    return `data: ${JSON.stringify({ type: 'error', message: 'Encoding error' })}\n\n`;
  }
}

// 心跳包发送器
function sendHeartbeat(controller: ReadableStreamDefaultController) {
  try {
    controller.enqueue(encodeChunk({
      type: "heartbeat",
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('[Stream] Failed to send heartbeat:', error);
  }
}

// 当生成单条建议时，立即发送给前端
function sendPartialSuggestion(
  controller: ReadableStreamDefaultController,
  category: string,
  suggestion: any,
  priority: string = 'medium',
  summary: string = '正在生成建议...'
) {
  try {
    const partialEvent = {
      type: 'partial',
      category,
      isSingleSuggestion: true,
      data: {
        suggestion,
        priority,
        summary
      },
      timestamp: Date.now()
    };

    // 直接使用encoder编码并发送，确保立即刷新
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));

    // 发送一个额外的空注释行，帮助某些浏览器立即刷新
    controller.enqueue(encoder.encode(": ping\n\n"));

    // 发送一个空白数据块，强制某些浏览器立即刷新缓冲区
    controller.enqueue(encoder.encode("data: {}\n\n"));
  } catch (error) {
    console.warn('[Stream] Failed to send partial suggestion:', error);
  }
}

// 定义专家提示词
const expertPrompts = {
  nutrition: (dataSummary: any) => ({
    category: "营养配比优化",
    icon: "🥗",
    prompt: `你是一位经验丰富的注册营养师。请基于以下用户健康数据，提供2-3个具体的、可执行的营养建议。

**用户数据:**
${JSON.stringify(dataSummary, null, 2)}

**输出要求:**
请严格按照以下JSON格式返回，不要添加任何额外的解释或文本。

\`\`\`json
{
  "category": "营养配比优化",
  "priority": "high",
  "suggestions": [
    {
      "title": "建议标题（10字内）",
      "description": "具体建议和分析（80-120字），要深入解释原因和提供量化方案。",
      "actionable": true,
      "icon": "🥗"
    }
  ],
  "summary": "对今日营养摄入的简要评价（30字内）"
}
\`\`\`
`
  }),
  exercise: (dataSummary: any) => ({
    category: "运动处方优化",
    icon: "🏃‍♂️",
    prompt: `你是一位认证运动生理学家。请根据以下用户健康数据，提供1-2个结构化的运动建议。

**用户数据:**
${JSON.stringify(dataSummary, null, 2)}

**输出要求:**
请严格按照以下JSON格式返回，不要添加任何额外的解释或文本。

\`\`\`json
{
  "category": "运动处方优化",
  "priority": "high",
  "suggestions": [
    {
      "title": "运动方案名称（10字内）",
      "description": "具体的训练计划，包括类型、强度、时长和频率（80-120字）。",
      "actionable": true,
      "icon": "🏃‍♂️"
    }
  ],
  "summary": "对今日运动表现的简要评价（30字内）"
}
\`\`\`
`
  }),
  metabolism: (dataSummary: any) => ({
    category: "代谢调节优化",
    icon: "🔥",
    prompt: `你是一位内分泌与代谢专家。请结合用户的BMR、TDEE、TEF和体重数据，分析其代谢状况，并提供2个提升代谢效率的建议。

**用户数据:**
${JSON.stringify(dataSummary, null, 2)}

**输出要求:**
请严格按照以下JSON格式返回，不要添加任何额外的解释或文本。

\`\`\`json
{
  "category": "代谢调节优化",
  "priority": "medium",
  "suggestions": [
    {
      "title": "代谢提升策略（10字内）",
      "description": "解释当前代谢状况，并提供具体的、科学的代谢调节建议（80-120字）。",
      "actionable": true,
      "icon": "🔥"
    }
  ],
  "summary": "当前代谢状态的核心总结（30字内）"
}
\`\`\`
`
  }),
  behavior: (dataSummary: any) => ({
    category: "行为习惯优化",
    icon: "🧠",
    prompt: `你是一位行为心理学专家。请分析用户的每日状态（情绪、精力等）和行为日志，找出可能影响其健康目标的行为模式，并提供2个积极的心理或行为干预建议。

**用户数据:**
${JSON.stringify(dataSummary, null, 2)}

**输出要求:**
请严格按照以下JSON格式返回，不要添加任何额外的解释或文本。

\`\`\`json
{
  "category": "行为习惯优化",
  "priority": "medium",
  "suggestions": [
    {
      "title": "习惯养成技巧（10字内）",
      "description": "提供建立健康习惯或改变不良习惯的具体心理学技巧（80-120字）。",
      "actionable": true,
      "icon": "🧠"
    }
  ],
  "summary": "当前核心行为模式的洞察（30字内）"
}
\`\`\`
`
  }),
  timing: (dataSummary: any) => ({
    category: "时机优化策略",
    icon: "⏰",
    prompt: `你是一位时间营养学专家。请根据用户的进餐和运动时间戳，分析其生物节律，并提供2个关于营养摄入或运动时机的优化建议。

**用户数据:**
${JSON.stringify(dataSummary, null, 2)}

**输出要求:**
请严格按照以下JSON格式返回，不要添加任何额外的解释或文本。

\`\`\`json
{
  "category": "时机优化策略",
  "priority": "low",
  "suggestions": [
    {
      "title": "时机优化建议（10字内）",
      "description": "结合昼夜节律和代谢窗口，提供关于"何时吃"或"何时动"的精准建议（80-120字）。",
      "actionable": true,
      "icon": "⏰"
    }
  ],
  "summary": "当前作息节律的简要评估（30字内）"
}
\`\`\`
`
  }),
  wellness: (dataSummary: any) => ({
    category: "整体健康优化",
    icon: "🧘‍♀️",
    prompt: `你是一位综合健康顾问。请全面审阅用户的健康数据（营养、运动、代谢、行为等），提供2个跨领域的、旨在提升整体健康水平的宏观建议。

**用户数据:**
${JSON.stringify(dataSummary, null, 2)}

**输出要求:**
请严格按照以下JSON格式返回，不要添加任何额外的解释或文本。

\`\`\`json
{
  "category": "整体健康优化",
  "priority": "low",
  "suggestions": [
    {
      "title": "综合健康策略（10字内）",
      "description": "从更高维度审视用户的生活方式，提供关于压力管理、睡眠、恢复等方面的综合建议（80-120字）。",
      "actionable": true,
      "icon": "🧘‍♀️"
    }
  ],
  "summary": "今日整体健康状况的综合评价（30字内）"
}
\`\`\`
`
  }),
};

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log(`[Smart Suggestions] Starting request at ${new Date().toISOString()}`);
  console.log(`[Smart Suggestions] Vercel environment: ${VERCEL_CONFIG.isVercel}`);
  console.log(`[Smart Suggestions] Timeout config: single=${VERCEL_CONFIG.smartSuggestions.getSingleRequestTimeout()}ms, overall=${VERCEL_CONFIG.smartSuggestions.getOverallTimeout()}ms`);

  try {
    const { dailyLog, userProfile, recentLogs, aiConfig, selectedExperts } = await req.json()

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

    console.log('🔍 AI Config mode detection:', {
      agentModel: isSharedMode ? 'shared' : 'private',
      chatModel: aiConfig?.chatModel?.source || 'unknown',
      visionModel: aiConfig?.visionModel?.source || 'unknown',
      isSharedMode
    });

    console.log('🔍 Using selected model:', selectedModel);
    console.log('🔍 Model source:', aiConfig?.agentModel?.source);
    console.log('🔍 Fallback config available:', !!fallbackConfig);

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

    // 根据用户选择或默认设置，决定要生成的建议类型
    const expertsToRun = (selectedExperts && selectedExperts.length > 0)
      ? selectedExperts
      : ['nutrition', 'exercise']; // 默认值

    console.log('[Smart Suggestions] Experts to run:', expertsToRun);

    const suggestionPrompts = expertsToRun.reduce((acc: any, expertKey: string) => {
      if (expertPrompts[expertKey as keyof typeof expertPrompts]) {
        const promptGenerator = expertPrompts[expertKey as keyof typeof expertPrompts];
        acc[expertKey] = promptGenerator(dataSummary).prompt;
      }
      return acc;
    }, {});

    // 创建流式响应 - 增强版本
    const stream = new ReadableStream({
      async start(controller) {
        // 设置心跳包定时器，每20秒发送一次
        const heartbeatInterval = setInterval(() => {
          sendHeartbeat(controller);
        }, 20000);

        try {
          // 发送初始状态
          controller.enqueue(encodeChunk({
            type: "init",
            status: "processing",
            message: "正在生成智能建议...",
            timestamp: Date.now()
          }));

          // 存储已完成的建议
          const completedSuggestions: any[] = [];

          // 获取当前的Key信息
          const currentKeyInfo = sharedClient.getCurrentKeyInfo();

          try {
            // 依次处理每个建议类型
            for (const [key, prompt] of Object.entries(suggestionPrompts)) {
              try {
                // 发送处理状态更新
                controller.enqueue(encodeChunk({
                  type: "progress",
                  status: "generating",
                  category: key,
                  message: `正在生成 ${expertPrompts[key as keyof typeof expertPrompts]?.(dataSummary).category || '建议'}...`,
                  timestamp: Date.now()
                }));

                // 使用 Vercel 优化的超时配置
                const singleTimeout = VERCEL_CONFIG.smartSuggestions.getSingleRequestTimeout();
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Request timeout')), singleTimeout);
                });

                const requestPromise = sharedClient.generateText({
                  model: selectedModel,
                  prompt: prompt as string,
                  response_format: { type: "json_object" },
                  max_tokens: VERCEL_CONFIG.optimizations.limitOutputTokens ? 800 : undefined, // 限制输出长度
                });

                const { text, keyInfo } = await Promise.race([requestPromise, timeoutPromise]) as any;

                try {
                  // 从Markdown代码块中提取JSON
                  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
                  const jsonString = jsonMatch ? jsonMatch[1] : text.trim();

                  const result = JSON.parse(jsonString);
                  const suggestion = {
                    key,
                    ...result,
                    keyInfo // 包含使用的Key信息
                  };

                  // 验证和清理结果
                  if (!suggestion.summary || suggestion.summary.trim() === "") {
                    if (suggestion.suggestions && suggestion.suggestions.length > 0) {
                      suggestion.summary = "要点: " + suggestion.suggestions.slice(0, 2).map((s: any) => s.title).join('; ');
                    } else {
                      suggestion.summary = "暂无具体建议";
                    }
                  }

                  // 逐条发送建议，实现真正的流式效果
                  if (suggestion.suggestions && suggestion.suggestions.length > 0) {
                    for (const singleSuggestion of suggestion.suggestions) {
                      // 使用 sendPartialSuggestion 函数发送单条建议
                      sendPartialSuggestion(
                        controller,
                        key,
                        singleSuggestion,
                        suggestion.priority || 'medium',
                        suggestion.summary
                      );

                      // 添加小延迟，使流式效果更明显，但不要太长
                      await new Promise(resolve => setTimeout(resolve, 100));
                    }
                  }

                  // 添加到已完成列表
                  completedSuggestions.push(suggestion);

                  // 发送完整类别更新
                  controller.enqueue(encodeChunk({
                    type: "partial",
                    status: "success",
                    category: key,
                    data: suggestion,
                    timestamp: Date.now()
                  }));
                } catch (parseError) {
                  console.warn(`Failed to parse ${key} suggestion:`, parseError);
                  controller.enqueue(encodeChunk({
                    type: "error",
                    status: "error",
                    category: key,
                    message: `${key}建议解析失败`,
                    timestamp: Date.now()
                  }));
                }
              } catch (error) {
                console.warn(`Smart suggestion failed for ${key}:`, error);

                // 发送错误状态
                controller.enqueue(encodeChunk({
                  type: "error",
                  status: "error",
                  category: key,
                  message: error instanceof Error ? error.message : String(error),
                  timestamp: Date.now()
                }));

                // 添加一个空的建议，以保持结构完整
                completedSuggestions.push({
                  key,
                  category: expertPrompts[key as keyof typeof expertPrompts]?.(dataSummary)?.category || (key === 'nutrition' ? '营养配比优化' : '运动处方优化'),
                  priority: "low",
                  suggestions: [],
                  summary: "分析暂时不可用，请稍后重试",
                  keyInfo: null
                });
              }
            }

            // 按优先级排序
            const priorityOrder: { [key: string]: number } = { high: 0, medium: 1, low: 2 };
            completedSuggestions.sort((a, b) => {
              return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            });

            // 记录成功完成的时间
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`[Smart Suggestions] Completed successfully in ${duration}ms`);

            // 发送完成状态和最终结果
            controller.enqueue(encodeChunk({
              type: "complete",
              status: "complete",
              suggestions: completedSuggestions,
              generatedAt: new Date().toISOString(),
              dataDate: dailyLog.date,
              keyInfo: currentKeyInfo,
              processingTime: duration,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error('Smart suggestions stream error:', error);

            // 发送错误状态
            controller.enqueue(encodeChunk({
              type: "fatal",
              status: "error",
              message: error instanceof Error ? error.message : String(error),
              timestamp: Date.now()
            }));
          } finally {
            // 清理心跳包定时器
            clearInterval(heartbeatInterval);
            controller.close();
          }
        } catch (outerError) {
          // 处理外层错误
          console.error('Stream initialization error:', outerError);
          clearInterval(heartbeatInterval);
          controller.close();
        }
      }
    });

    // 返回流式响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Smart suggestions API error:', error);

    // 检查是否是超时错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      return Response.json({
        error: "AI服务响应超时，请稍后重试",
        code: "REQUEST_TIMEOUT",
        suggestions: [],
        retryable: true
      }, { status: 408 }); // Request Timeout
    }

    // 检查是否是共享密钥限额问题
    if (errorMessage.includes('No available shared keys') || errorMessage.includes('达到每日调用限制')) {
      return Response.json({
        error: "共享AI服务暂时不可用，所有密钥已达到每日使用限制。请稍后重试或联系管理员。",
        code: "SHARED_KEYS_EXHAUSTED",
        suggestions: [],
        retryable: false
      }, { status: 503 }); // Service Unavailable
    }

    return Response.json({
      error: "AI服务暂时不可用，请稍后重试",
      code: "AI_SERVICE_ERROR",
      suggestions: [],
      retryable: true
    }, { status: 500 });
  }
}
