"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useChat } from "ai/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useIndexedDB } from "@/hooks/use-indexed-db"
import { useAIMemory } from "@/hooks/use-ai-memory"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { EnhancedMessageRenderer } from "@/components/enhanced-message-renderer"
import type { AIConfig, AIMemoryUpdateRequest } from "@/lib/types"
import { format } from "date-fns"
import { Trash2, User, Stethoscope, Dumbbell, Flame, Brain, Clock, Menu, X, ChevronDown } from "lucide-react"
import type { Message } from "ai"
import { useTranslation } from "@/hooks/use-i18n"
import styles from "./chat.module.css"

// 专家角色定义
interface ExpertRole {
  id: string
  name: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  systemPrompt: string
}

const expertRoles: ExpertRole[] = [
  {
    id: "general",
    name: "通用助手",
    title: "SnapFit AI 健康助手",
    description: "全方位健康管理助手，可以回答各种健康相关问题",
    icon: User,
    color: "bg-blue-500",
    systemPrompt: `你是SnapFit AI，一位经验丰富的健康管理顾问。我拥有营养学、运动科学、行为心理学的综合知识背景。

我的使命是帮助用户实现健康目标，无论是减重、增肌、改善体能还是养成健康习惯。我会：

🎯 **我的专长**：
- 综合分析用户的营养、运动、代谢数据
- 提供平衡且实用的健康建议
- 帮助制定可持续的健康计划
- 解答各类健康疑问

💬 **我的沟通风格**：
- 用温和、鼓励的语气与用户交流
- 将复杂的健康知识用简单易懂的方式解释
- 基于用户的实际数据给出个性化建议
- 始终以用户的健康和安全为第一优先

📝 **记忆更新协议**：
当发现用户的重要新信息时，我必须严格遵循系统协议，使用以下标准格式输出记忆更新请求：

[MEMORY_UPDATE_REQUEST]
新记忆内容：[极度精简的核心信息，不超过500字，无特殊符号]
更新原因：[简要说明更新必要性]
[/MEMORY_UPDATE_REQUEST]

记忆更新原则：只记录对长期健康管理有价值的信息，避免临时数据，重点记录偏好、限制、目标变化等。

请告诉我您的健康问题或目标，我会基于您的数据为您提供最适合的建议！`
  },
  {
    id: "nutrition",
    name: "营养师",
    title: "注册营养师 (RD)",
    description: "专精宏量营养素配比、膳食结构优化和营养密度分析",
    icon: Stethoscope,
    color: "bg-green-500",
    systemPrompt: `你好！我是Dr. Sarah Chen，一位拥有15年临床经验的注册营养师(RD)，专精于运动营养和体重管理。

👩‍⚕️ **我的专业背景**：
- 美国营养与饮食学会认证营养师
- 运动营养专科认证(CSSD)
- 曾为奥运选手和职业运动员制定营养方案
- 在顶级医院营养科工作多年

🥗 **我专门负责**：
- 精确分析宏量营养素配比（蛋白质15-25%，脂肪20-35%，碳水45-65%）
- 评估食物选择的营养密度和质量
- 识别维生素、矿物质等微量营养素缺口
- 设计个性化膳食计划和食物替换方案
- 优化进餐时机和营养素分配

💡 **我的分析方法**：
- 基于您的TDEE和目标制定精确的营养目标
- 分析您的食物记录，找出营养不平衡的地方
- 考虑您的生活方式、偏好和预算制定可执行的方案
- 提供具体的食物推荐和份量建议

📝 **记忆更新协议**：
作为营养师，当我发现用户的重要营养相关信息时，必须严格遵循系统协议输出标准化记忆更新请求：

[MEMORY_UPDATE_REQUEST]
新记忆内容：[营养相关的核心信息，极度精简，不超过500字，无特殊符号]
更新原因：[营养管理角度的更新必要性]
[/MEMORY_UPDATE_REQUEST]

重点记录：食物偏好禁忌、过敏信息、营养目标变化、代谢特征、饮食习惯等对长期营养管理有价值的信息。

作为您的专属营养师，我会用专业的营养学知识，结合您的实际数据，为您制定最适合的营养策略。请告诉我您的营养困惑或目标！`
  },
  {
    id: "exercise",
    name: "运动专家",
    title: "SF认证运动生理学家",
    description: "专精运动处方设计、能量代谢优化和训练计划制定",
    icon: Dumbbell,
    color: "bg-orange-500",
    systemPrompt: `嘿！我是Coach Mike Rodriguez，认证的运动生理学家，也是前职业健身教练！💪

🏃‍♂️ **我的专业资质**：
- 美国认证运动生理学家
- 国际力量与体能协会(NSCA)认证私人教练
- 10年职业运动员训练经验
- 专精运动表现优化和伤病预防

🎯 **我的专业领域**：
- 设计个性化运动处方和训练计划
- 优化有氧vs无氧运动配比（基于您的具体目标）
- 计算最佳运动强度区间（基于心率储备法）
- 制定运动时机与营养窗口配合策略
- 评估运动量与TDEE目标的匹配度

🔥 **我的训练哲学**：
- "没有最好的运动，只有最适合你的运动"
- 渐进式超负荷，安全第一
- 运动应该是可持续的生活方式，不是痛苦的惩罚
- 数据驱动的训练调整

💡 **我会为您提供**：
- 具体的运动类型、强度、时长建议
- 基于您当前体能水平的渐进式计划
- 运动与营养的最佳配合时机
- 避免过度训练和运动伤害的策略

📝 **记忆更新协议**：
作为运动专家，当我发现用户的重要运动相关信息时，必须严格遵循系统协议输出标准化记忆更新请求：

[MEMORY_UPDATE_REQUEST]
新记忆内容：[运动相关的核心信息，极度精简，不超过500字，无特殊符号]
更新原因：[运动训练角度的更新必要性]
[/MEMORY_UPDATE_REQUEST]

重点记录：运动偏好、体能水平、伤病史、训练目标变化、运动限制等对长期运动管理有价值的信息。

准备好开始您的健身之旅了吗？告诉我您的运动目标和当前状况，我来为您制定专属的训练方案！`
  },
  {
    id: "metabolism",
    name: "代谢专家",
    title: "内分泌代谢专家",
    description: "专精能量代谢调节、TEF优化和体重管理的生理机制",
    icon: Flame,
    color: "bg-red-500",
    systemPrompt: `您好！我是Dr. Emily Watson，内分泌代谢领域的专家医师，专注于人体能量代谢的精密调节。🔬

🧬 **我的学术背景**：
- 哈佛医学院内分泌学博士
- 在《Nature Metabolism》等顶级期刊发表论文50+篇
- 专精代谢综合征、胰岛素抵抗、甲状腺功能调节
- 15年临床代谢疾病诊疗经验

🔥 **我的专业专长**：
- 精确分析BMR、TDEE与实际代谢的匹配度
- 优化食物热效应(TEF)，最大化代谢效率
- 评估代谢适应性和代谢灵活性
- 分析胰岛素敏感性和血糖调节
- 设计符合昼夜节律的代谢优化方案

🧪 **我的分析方法**：
- 基于您的代谢数据识别代谢瓶颈
- 分析体重变化趋势中的代谢适应信号
- 评估TEF增强策略的实际效果
- 制定个性化的代谢调节方案

💡 **我关注的核心指标**：
- 基础代谢率的稳定性和效率
- 食物热效应的优化潜力
- 代谢灵活性（脂肪vs糖类燃烧切换能力）
- 胰岛素敏感性和血糖稳定性

📝 **记忆更新协议**：
作为代谢专家，当我发现用户的重要代谢相关信息时，必须严格遵循系统协议输出标准化记忆更新请求：

[MEMORY_UPDATE_REQUEST]
新记忆内容：[代谢相关的核心信息，极度精简，不超过500字，无特殊符号]
更新原因：[代谢调节角度的更新必要性]
[/MEMORY_UPDATE_REQUEST]

重点记录：代谢特征、内分泌状况、代谢目标变化、代谢障碍、药物影响等对长期代谢管理有价值的信息。

作为您的代谢顾问，我会从分子生物学角度分析您的代谢状况，提供科学精准的代谢优化策略。让我们一起解锁您身体的代谢潜能！`
  },
  {
    id: "behavior",
    name: "行为专家",
    title: "行为心理学专家",
    description: "专精健康行为改变、习惯养成和动机维持的科学方法",
    icon: Brain,
    color: "bg-purple-500",
    systemPrompt: `Hi there! 我是Dr. Alex Thompson，行为心理学专家，专门帮助人们建立可持续的健康习惯！🧠✨

🎓 **我的专业背景**：
- 斯坦福大学行为心理学博士
- 《习惯的力量》畅销书作者
- Google、Apple等公司行为设计顾问
- 专精习惯科学和行为改变技术

🎯 **我专门解决的问题**：
- 为什么明知道要运动/健康饮食，却总是做不到？
- 如何让好习惯变得自动化、不费意志力？
- 怎样设计环境让健康选择变得更容易？
- 如何克服拖延、完美主义等心理障碍？

🔍 **我的分析方法**：
- 识别您的行为模式和触发点
- 分析行为一致性和变化趋势
- 找出阻碍改变的心理和环境因素
- 设计个性化的行为改变策略

💡 **我的核心理念**：
- "改变环境比改变意志力更有效"
- "小习惯 × 一致性 = 大改变"
- "关注系统，而不是目标"
- "让好行为变得显而易见、有吸引力、简单易行、令人满足"

🛠️ **我会为您提供**：
- 基于行为科学的习惯设计方案
- 环境优化和提示系统设计
- 克服心理阻力的具体策略
- 渐进式行为改变计划

📝 **记忆更新协议**：
作为行为专家，当我发现用户的重要行为相关信息时，必须严格遵循系统协议输出标准化记忆更新请求：

[MEMORY_UPDATE_REQUEST]
新记忆内容：[行为相关的核心信息，极度精简，不超过500字，无特殊符号]
更新原因：[行为改变角度的更新必要性]
[/MEMORY_UPDATE_REQUEST]

重点记录：行为模式、心理障碍、习惯偏好、动机因素、环境限制等对长期行为改变有价值的信息。

准备好建立真正持久的健康习惯了吗？告诉我您在行为改变上遇到的挑战，我来帮您设计科学的解决方案！`
  },
  {
    id: "timing",
    name: "时机专家",
    title: "时间营养学专家",
    description: "专精生物节律、营养时机和睡眠-代谢协调优化",
    icon: Clock,
    color: "bg-indigo-500",
    systemPrompt: `Good day! 我是Dr. Maria Gonzalez，时间营养学(Chrono-nutrition)领域的先驱专家！⏰🌅

🕐 **我的专业领域**：
- 哈佛医学院时间生物学研究所博士后
- 《时间营养学》教科书主编
- 专精昼夜节律与代谢调节的关系
- 奥运代表队时间营养顾问

⏰ **我专门研究的时机科学**：
- 进餐时机与昼夜节律的精确同步
- 运动时机与代谢窗口的最佳匹配
- 营养素时序分配的生理学原理
- 睡眠-代谢-营养的三角协调关系

🌅 **我的核心理念**：
- "什么时候吃，和吃什么一样重要"
- "身体有自己的时钟，我们要学会配合它"
- "最佳时机 = 最大效果 × 最小副作用"
- "个性化的生物节律才是最好的时间表"

🔬 **我会分析的时间因素**：
- 您的进餐时间与生物钟的同步度
- 运动时机对脂肪燃烧和肌肉合成的影响
- 不同营养素的最佳摄入时间窗口
- 睡眠质量对代谢节律的影响

💡 **我提供的时机优化策略**：
- 个性化的进餐时间安排
- 运动与营养的时序配合方案
- 改善睡眠质量的时间管理
- 跨时区或轮班工作的节律调节

📝 **记忆更新协议**：
作为时机专家，当我发现用户的重要时间相关信息时，必须严格遵循系统协议输出标准化记忆更新请求：

[MEMORY_UPDATE_REQUEST]
新记忆内容：[时间节律相关的核心信息，极度精简，不超过500字，无特殊符号]
更新原因：[时间营养学角度的更新必要性]
[/MEMORY_UPDATE_REQUEST]

重点记录：作息习惯、生物节律特征、时间偏好、工作时间安排、睡眠模式等对长期时机优化有价值的信息。

🎯 **我的目标**：
帮您找到属于自己的最佳生物节律，让时间成为您健康路上的最佳伙伴！

准备好优化您的生物时钟了吗？告诉我您的作息习惯和时间安排，我来为您设计最符合生理节律的时机策略！`
  }
]

export default function ChatPage() {
  const { toast } = useToast()
  const t = useTranslation('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isLoadingMessagesRef = useRef(false) // 用于防止循环更新
  const [includeHealthData, setIncludeHealthData] = useState(true)
  const [selectedExpert, setSelectedExpert] = useState<string>("general")
  const [isClient, setIsClient] = useState(false)
  const [recentHealthData, setRecentHealthData] = useState<any[]>([])

  // 移动端状态管理
  const [isMobile, setIsMobile] = useState(false)
  const [showExpertPanel, setShowExpertPanel] = useState(false)
  const [showExpertDropdown, setShowExpertDropdown] = useState(false)

  const [userProfile] = useLocalStorage("userProfile", {})
  const [aiConfig] = useLocalStorage<AIConfig>("aiConfig", {
    agentModel: {
      name: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "",
    },
    chatModel: {
      name: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "",
    },
    visionModel: {
      name: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "",
    },
  })
  const { getData } = useIndexedDB("healthLogs")
  const [todayLog, setTodayLog] = useState(null)

  // AI记忆管理
  const { memories, getMemory, updateMemory } = useAIMemory()
  const [pendingMemoryUpdate, setPendingMemoryUpdate] = useState<AIMemoryUpdateRequest | null>(null)

  // 为每个专家使用独立的聊天记录
  const [allExpertMessages, setAllExpertMessages] = useLocalStorage<Record<string, Message[]>>("expertChatMessages", {})

  // 检查AI配置是否完整
  const checkAIConfig = () => {
    const modelConfig = aiConfig.chatModel
    //console.log("Checking AI config:", {
    //  hasName: !!modelConfig?.name,
    //  hasBaseUrl: !!modelConfig?.baseUrl,
    //  hasApiKey: !!modelConfig?.apiKey,
    //})

    if (!modelConfig?.name || !modelConfig?.baseUrl || !modelConfig?.apiKey) {
      return false
    }
    return true
  }

  // 处理AI记忆更新请求
  const handleMemoryUpdateRequest = async (newContent: string, reason?: string) => {
    try {
      await updateMemory({
        expertId: selectedExpert,
        newContent,
        reason
      })

      toast({
        title: "记忆已更新",
        description: `${currentExpert.name}的记忆已成功更新`,
      })

      setPendingMemoryUpdate(null)
    } catch (error) {
      console.error("更新记忆失败:", error)
      toast({
        title: "记忆更新失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    }
  }

  // 设置客户端状态和移动端检测
  useEffect(() => {
    setIsClient(true)

    // 检测移动设备
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    // 点击外部关闭下拉菜单
    const handleClickOutside = (event: MouseEvent) => {
      if (showExpertDropdown && !(event.target as Element).closest('.expert-dropdown')) {
        // 延迟关闭，避免与流式回复冲突
        setTimeout(() => {
          setShowExpertDropdown(false)
        }, 0)
      }
    }

    document.addEventListener('mousedown', handleClickOutside, { passive: true })

    return () => {
      window.removeEventListener('resize', checkMobile)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExpertDropdown])



  // 获取今日日志
  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd")
    getData(today).then((data) => {
      console.log("Today's health data loaded:", {
        hasData: !!data,
        date: data?.date,
        foodEntries: data?.foodEntries?.length || 0,
        exerciseEntries: data?.exerciseEntries?.length || 0,
        summary: data?.summary,
      })
      setTodayLog(data)
    })
  }, [getData])

  // 获取近3天的详细数据
  useEffect(() => {
    const loadRecentData = async () => {
      const logs = []
      const today = new Date()
      for (let i = 0; i < 3; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateKey = format(date, "yyyy-MM-dd")
        try {
          const log = await getData(dateKey)
          if (log && (log.foodEntries?.length > 0 || log.exerciseEntries?.length > 0)) {
            logs.push(log)
          }
        } catch (error) {
          console.log(`No data for ${dateKey}`)
        }
      }
      console.log("Recent health data loaded:", logs.length, "days")
      setRecentHealthData(logs)
    }

    loadRecentData()
  }, [getData])

  // 获取当前选择的专家
  const currentExpert = expertRoles.find(expert => expert.id === selectedExpert) || expertRoles[0]

  // 获取翻译后的专家信息
  const tChatExperts = useTranslation('chat.experts')
  const getExpertDisplayInfo = (expert: ExpertRole) => ({
    ...expert,
    name: tChatExperts(`${expert.id}.name`) || expert.name,
    title: tChatExperts(`${expert.id}.title`) || expert.title,
    description: tChatExperts(`${expert.id}.description`) || expert.description
  })

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: "/api/openai/chat",
    initialMessages: [],
    headers: {
      "x-ai-config": JSON.stringify(aiConfig),
      "x-expert-role": selectedExpert,
    },
    onResponse: (response) => {
      console.log("Chat response received:", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      })

      if (!response.ok) {
        console.error("Chat response not ok:", response.status, response.statusText)
        toast({
          title: "聊天失败",
          description: `服务器响应错误: ${response.status} ${response.statusText}`,
          variant: "destructive",
        })
      }
    },
    onError: (error) => {
      console.error("Chat error:", error)
      toast({
        title: "聊天失败",
        description: checkAIConfig() ? `错误: ${error.message}` : "请先在设置页面配置聊天模型",
        variant: "destructive",
      })
    },
    onFinish: (message) => {
      console.log("Chat finished:", {
        messageLength: message.content.length,
        role: message.role,
      })
    },
    body: {
      userProfile: includeHealthData ? userProfile : undefined,
      healthData: includeHealthData ? todayLog : undefined,
      recentHealthData: includeHealthData ? recentHealthData : undefined,
      systemPrompt: currentExpert.systemPrompt,
      expertRole: currentExpert,
      aiMemory: memories, // 包含所有专家的记忆（只读其他专家，可写当前专家）
    },
  })

  // 当切换专家时，加载对应的消息记录
  useEffect(() => {
    isLoadingMessagesRef.current = true
    const expertMessages = allExpertMessages[selectedExpert] || []
    setMessages(expertMessages)
    // 使用 setTimeout 确保 setMessages 完成后再重置标志
    setTimeout(() => {
      isLoadingMessagesRef.current = false
    }, 0)
  }, [selectedExpert, allExpertMessages, setMessages])

  // 保存当前专家的消息到 localStorage (但避免在加载消息时触发)
  useEffect(() => {
    if (messages.length > 0 && !isLoadingMessagesRef.current) {
      const newMessages = { ...allExpertMessages }
      newMessages[selectedExpert] = messages as Message[]
      setAllExpertMessages(newMessages)
    }
  }, [messages, selectedExpert, setAllExpertMessages])

  // 处理专家选择
  const handleExpertSelect = (expertId: string) => {
    setSelectedExpert(expertId)
    setShowExpertDropdown(false)
    if (isMobile) {
      setShowExpertPanel(false)
    }
  }

  // 清除当前专家的聊天记录
  const clearChatHistory = () => {
    isLoadingMessagesRef.current = true
    setMessages([])
    const newMessages = { ...allExpertMessages }
    newMessages[selectedExpert] = []
    setAllExpertMessages(newMessages)
    setTimeout(() => {
      isLoadingMessagesRef.current = false
    }, 0)
    toast({
      title: t('historyCleared'),
      description: t('expertHistoryCleared', { expert: getExpertDisplayInfo(currentExpert).name }),
    })
  }

  // 滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log("Submitting chat message:", {
      inputLength: input.length,
      hasAIConfig: isClient ? checkAIConfig() : false,
      includeHealthData,
      hasUserProfile: !!userProfile,
      hasTodayLog: !!todayLog,
    })

    if (isClient && !checkAIConfig()) {
      toast({
        title: "AI 配置不完整",
        description: "请先在设置页面配置聊天模型",
        variant: "destructive",
      })
      return
    }
    handleSubmit(e)
  }

  // 显示错误信息
  useEffect(() => {
    if (error) {
      console.error("useChat error:", error)
    }
  }, [error])

  return (
    <div className="container mx-auto py-3 md:py-6 max-w-7xl min-w-0 px-4 md:px-6">
      <div className={`${isMobile ? 'flex flex-col h-[calc(100vh-2rem)]' : 'flex gap-6 h-[80vh]'}`}>
        {/* 移动端专家选择下拉菜单 */}
        {isMobile && (
          <div className="mb-4">
            <div className="relative expert-dropdown">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowExpertDropdown(!showExpertDropdown)
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${currentExpert.color} text-white`}>
                    <currentExpert.icon className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-sm">{getExpertDisplayInfo(currentExpert).name}</p>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        SnapFit AI
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{getExpertDisplayInfo(currentExpert).title}</p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showExpertDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showExpertDropdown && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-[100] max-h-80 overflow-y-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    zIndex: 100
                  }}
                >
                  {expertRoles.map((expert) => {
                    const IconComponent = expert.icon
                    const isSelected = selectedExpert === expert.id
                    const expertInfo = getExpertDisplayInfo(expert)
                    return (
                      <button
                        key={expert.id}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleExpertSelect(expert.id)
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`w-full text-left p-3 border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors ${
                          isSelected
                            ? 'bg-primary/5 text-primary'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`p-1.5 rounded-lg ${expert.color} text-white flex-shrink-0`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm">{expertInfo.name}</h3>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5">
                              {expertInfo.title}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 桌面端左侧专家选择栏 */}
        {!isMobile && (
          <Card className="w-80 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">{t('title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <div className="space-y-3">
                {expertRoles.map((expert) => {
                  const IconComponent = expert.icon
                  const isSelected = selectedExpert === expert.id
                  const expertInfo = getExpertDisplayInfo(expert)
                  return (
                    <button
                      key={expert.id}
                      onClick={() => handleExpertSelect(expert.id)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${expert.color} text-white flex-shrink-0`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm">{expertInfo.name}</h3>
                          <p className="text-xs text-muted-foreground font-medium mt-1">
                            {expertInfo.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            {expertInfo.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 聊天区域 */}
        <Card className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <CardHeader className={`${isMobile ? 'p-2' : 'p-3'} border-b border-border`}>
            <div className={`${isMobile ? 'flex flex-col space-y-2' : 'flex justify-between items-center'}`}>
              {/* 桌面端专家信息 */}
              {!isMobile && (
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-md ${currentExpert.color} text-white`}>
                    <currentExpert.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-base">{getExpertDisplayInfo(currentExpert).name}</CardTitle>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        SnapFit AI
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{getExpertDisplayInfo(currentExpert).title}</p>
                  </div>
                </div>
              )}

              {/* 控制按钮区域 */}
              <div className={`${isMobile ? 'flex items-center justify-between' : 'flex items-center space-x-3'}`}>
                <div className="flex items-center space-x-2">
                  <Switch id="include-data" checked={includeHealthData} onCheckedChange={setIncludeHealthData} />
                  <Label htmlFor="include-data" className="text-xs">{t('includeHealthData')}</Label>
                </div>
                {isClient && messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearChatHistory}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {t('clearHistory')}
                  </Button>
                )}
              </div>
            </div>
            {isClient && !checkAIConfig() && (
              <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 p-2 rounded mt-2">
                {t('configureAI')}
              </div>
            )}
            {isClient && error && (
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 p-2 rounded mt-2">
                错误: {error.message}
              </div>
            )}
          </CardHeader>
          <CardContent className={`flex-1 flex flex-col min-w-0 overflow-hidden ${isMobile ? 'p-2' : 'p-4'}`}>
          <ScrollArea className={`flex-1 w-full ${isMobile ? 'pr-2' : 'pr-4'}`}>
            <div className={`space-y-3 pb-4 w-full max-w-full overflow-hidden ${isMobile ? 'space-y-2' : 'space-y-4'}`}>
              {!isClient ? (
                // 服务端渲染时显示简单的加载状态
                <div className={`text-center ${isMobile ? 'py-4' : 'py-8'}`}>
                  <p className={`font-medium ${isMobile ? 'text-base' : 'text-lg'}`}>{t('loading')}</p>
                </div>
              ) : messages.length === 0 ? (
                <div className={`${isMobile ? 'py-4 px-2' : 'py-8 px-4'} max-w-2xl mx-auto`}>
                  {/* 专家头像和标题 */}
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${currentExpert.color} text-white mb-4`}>
                      <currentExpert.icon className="h-8 w-8" />
                    </div>
                    <h1 className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'} text-slate-900 dark:text-slate-100 mb-2`}>
                      {tChatExperts(`${selectedExpert}.welcomeMessage.title`) || t('welcomeMessage')}
                    </h1>
                    <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-base'} leading-relaxed`}>
                      {tChatExperts(`${selectedExpert}.welcomeMessage.subtitle`) || t('welcomeDescription')}
                    </p>
                  </div>

                  {/* 专家特色功能 */}
                  {tChatExperts(`${selectedExpert}.welcomeMessage.features.0`) && (
                    <div className="mb-6">
                      <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-3'}`}>
                        {[0, 1, 2, 3].map((index) => {
                          const feature = tChatExperts(`${selectedExpert}.welcomeMessage.features.${index}`)
                          if (!feature) return null
                          return (
                            <div
                              key={index}
                              className={`flex items-center ${isMobile ? 'text-sm' : 'text-base'} text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-3`}
                            >
                              <span className="flex-shrink-0 mr-3">{feature.split(' ')[0]}</span>
                              <span className="flex-1">{feature.split(' ').slice(1).join(' ')}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 开始对话提示 */}
                  <div className="text-center">
                    <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'} mb-3`}>
                      {t('startConversation', { expert: tChatExperts(`${selectedExpert}.name`) || getExpertDisplayInfo(currentExpert).name })}
                    </p>
                    {!checkAIConfig() && (
                      <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 p-3 rounded-lg">
                        {t('configureAIPrompt')}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} w-full max-w-full`}>
                    <div
                      className={`${isMobile ? 'max-w-[90%]' : 'max-w-[95%]'} w-auto min-w-0 rounded-xl ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} shadow-sm overflow-hidden ${styles.messageContainer} ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {message.role === "user" ? (
                        // 用户消息保持简单格式，确保文本换行
                        <div className={`${styles.userMessage} ${isMobile ? 'text-sm' : ''}`}>{message.content}</div>
                      ) : (
                        // AI消息使用增强渲染器，支持思考过程显示
                        <div className={`${styles.aiMessage} ${isMobile ? 'text-sm' : ''}`}>
                          <EnhancedMessageRenderer
                            content={message.content}
                            className="text-inherit"
                            isMobile={isMobile}
                            isStreaming={isLoading && messages[messages.length - 1]?.id === message.id}
                            onMemoryUpdateRequest={(request) => {
                              handleMemoryUpdateRequest(request.newContent, request.reason)
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className={`bg-muted rounded-lg ${isMobile ? 'px-3 py-2' : 'px-4 py-2'}`}>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                      <span className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('aiThinking')}</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <form onSubmit={onSubmit} className={`${isMobile ? 'mt-2' : 'mt-4'} flex space-x-2`}>
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder={isClient && checkAIConfig() ? t('inputPlaceholder') : t('configureAI')}
              disabled={isLoading || (isClient && !checkAIConfig())}
              className={`flex-1 ${isMobile ? 'text-base' : ''}`}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim() || (isClient && !checkAIConfig())}
              size={isMobile ? "default" : "default"}
              className={isMobile ? 'px-4' : ''}
            >
              {isLoading ? t('sending') : t('send')}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
