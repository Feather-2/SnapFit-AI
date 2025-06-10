// 食物记录类型
export interface FoodEntry {
  log_id: string
  food_name: string
  consumed_grams: number
  meal_type: string // breakfast, lunch, dinner, snack
  time_period?: string // 时间段：morning, noon, afternoon, evening
  nutritional_info_per_100g: {
    calories: number
    carbohydrates: number
    protein: number
    fat: number
    fiber?: number
    sugar?: number
    sodium?: number
    [key: string]: number | undefined
  }
  total_nutritional_info_consumed: {
    calories: number
    carbohydrates: number
    protein: number
    fat: number
    fiber?: number
    sugar?: number
    sodium?: number
    [key: string]: number | undefined
  }
  is_estimated: boolean
  timestamp?: string
}

// 运动记录类型
export interface ExerciseEntry {
  log_id: string
  exercise_name: string
  exercise_type: "cardio" | "strength" | "flexibility" | "other"
  duration_minutes: number
  time_period?: string // 时间段：morning, noon, afternoon, evening
  distance_km?: number // 适用于有氧运动
  sets?: number // 适用于力量训练
  reps?: number // 适用于力量训练
  weight_kg?: number // 适用于力量训练
  estimated_mets: number // 代谢当量
  user_weight: number // 用户体重，用于计算卡路里消耗
  calories_burned_estimated: number
  muscle_groups?: string[] // 锻炼的肌肉群
  is_estimated: boolean
  timestamp?: string
}

// 日常摘要类型
export interface DailySummaryType {
  totalCaloriesConsumed: number
  totalCaloriesBurned: number
  macros: {
    carbs: number
    protein: number
    fat: number
  }
  micronutrients: Record<string, number>
}

// TEF 分析结果类型
export interface TEFAnalysis {
  baseTEF: number // 基础TEF (kcal)
  baseTEFPercentage: number // 基础TEF百分比
  enhancementMultiplier: number // AI分析的增强乘数
  enhancedTEF: number // 增强后的TEF (kcal)
  enhancementFactors: string[] // 影响因素列表
  analysisTimestamp: string // 分析时间戳
}

// 智能建议类型
export interface SmartSuggestion {
  title: string
  description: string
  actionable: boolean
  icon: string
}

export interface SmartSuggestionCategory {
  key: string
  category: string
  priority: 'high' | 'medium' | 'low'
  suggestions: SmartSuggestion[]
  summary: string
}

export interface SmartSuggestionsResponse {
  suggestions: SmartSuggestionCategory[]
  generatedAt: string
  dataDate: string
}

// 每日状态记录类型
export interface DailyStatus {
  stress: number // 压力水平 1-6
  mood: number // 心情状态 1-6
  health: number // 健康状况 1-6
  stressNotes?: string // 压力补充说明
  moodNotes?: string // 心情补充说明
  healthNotes?: string // 健康状况补充说明
  bedTime?: string // 睡眠时间 (HH:MM格式)
  wakeTime?: string // 起床时间 (HH:MM格式)
  sleepQuality?: number // 睡眠质量 1-6
  sleepNotes?: string // 睡眠补充说明
}

// 日志类型
export interface DailyLog {
  date: string
  foodEntries: FoodEntry[]
  exerciseEntries: ExerciseEntry[]
  summary: DailySummaryType
  weight?: number // 新增：记录当日体重
  activityLevel?: string // 新增：记录当日的活动水平，用于TDEE计算
  calculatedBMR?: number // 新增：当日计算的BMR
  calculatedTDEE?: number // 新增：当日计算的TDEE
  tefAnalysis?: TEFAnalysis // 新增：TEF分析结果
  dailyStatus?: DailyStatus // 新增：每日状态记录
  last_modified?: string // ISO 8601 格式的日期时间字符串，用于同步
  deletedFoodIds?: string[] // 新增：已删除的食物条目ID列表（逻辑删除）
  deletedExerciseIds?: string[] // 新增：已删除的运动条目ID列表（逻辑删除）
}

// 用户配置类型
export interface UserProfile {
  weight: number
  height: number
  age: number
  gender: string
  activityLevel: string
  goal: string
  targetWeight?: number
  targetCalories?: number
  notes?: string
  bmrFormula?: 'mifflin-st-jeor' | 'harris-benedict' // 新增：BMR计算公式选择
  bmrCalculationBasis?: 'totalWeight' | 'leanBodyMass' // 新增：BMR计算依据
  bodyFatPercentage?: number // 新增：体脂率，用于去脂体重计算
  // 专业模式字段
  professionalMode?: boolean // 是否启用专业模式
  medicalHistory?: string // 现有疾病、过敏、药物/补充剂、家族病史
  lifestyle?: string // 食物偏好/禁忌、睡眠质量、压力水平、烟酒习惯
  healthAwareness?: string // 健康认知与目标期望
}

// 模型配置类型
export interface ModelConfig {
  name: string
  baseUrl: string
  apiKey: string
  source: 'private' | 'shared'; // 新增：数据源选择
  sharedKeyConfig?: {
    mode: 'auto' | 'manual';
    selectedModel?: string;
    selectedKeyIds?: string[];
  }
}

// AI 配置类型
export interface AIConfig {
  agentModel: ModelConfig
  chatModel: ModelConfig
  visionModel: ModelConfig
  sharedKey: {
    selectedKeyIds: string[];
  }
}

// AI助手记忆类型
export interface AIMemory {
  expertId: string // 对应专家角色ID
  content: string // 记忆内容，限制500字
  lastUpdated: string // 最后更新时间
  version: number // 版本号，用于跟踪更新
}

// AI记忆更新请求类型
export interface AIMemoryUpdateRequest {
  expertId: string
  newContent: string
  reason?: string // 更新原因
}

// 扩展的消息类型，支持思考过程和图片
export interface ExtendedMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  reasoning_content?: string // 思考过程内容
  images?: string[] // 图片数据URI数组
  timestamp?: string
}

// 共享Key配置类型
export interface SharedKeyConfig {
  id?: string
  userId: string
  name: string
  baseUrl: string
  apiKey: string
  availableModels: string[]
  dailyLimit: number
  description?: string
  tags: string[]
  isActive: boolean
  usageCountToday: number
  totalUsageCount: number
  lastUsedAt?: string
  createdAt?: string
  updatedAt?: string
}

// Key使用日志类型
export interface KeyUsageLog {
  id?: string
  sharedKeyId: string
  userId: string
  apiEndpoint: string
  modelUsed: string
  tokensUsed?: number
  costEstimate?: number
  success: boolean
  errorMessage?: string
  createdAt?: string
}

// 感谢榜贡献者类型
export interface Contributor {
  userId: string
  username: string
  avatarUrl?: string
  totalContributions: number
  dailyLimit: number
  isActive: boolean
}

// 当前使用Key信息类型
export interface CurrentKeyInfo {
  contributorName: string
  contributorAvatar?: string
  modelName: string
  keyName: string
  source: 'shared' | 'fallback'
}

// AI Coach快照类型
export interface CoachSnapshot {
  id?: string
  userId: string
  title: string
  description: string
  conversationData: any // 对话记录
  modelConfig: any // 模型配置
  healthDataSnapshot: any // 健康数据快照
  userRating: number // 用户自评分 1-5
  isPublic: boolean
  averageRating?: number // 平均评分
  ratingCount?: number // 评分人数
  createdAt?: string
  updatedAt?: string
}

// 快照评分类型
export interface SnapshotRating {
  id?: string
  snapshotId: string
  userId: string
  rating: number // 1-5星
  comment?: string
  createdAt?: string
}

// 用户认证信息类型
export interface UserAuth {
  id: string
  linuxDoId: string
  username: string
  avatarUrl?: string
  email?: string
  createdAt: string
  updatedAt: string
}

export interface AppState {
  // ... existing code ...
}
