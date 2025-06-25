import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

// 在开发环境中重用连接，在生产环境中创建新连接
export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

// 类型定义
interface AIConfigData {
  agentModel?: {
    name?: string
    baseUrl?: string
    apiKey?: string
  }
  visionModel?: {
    name?: string
    baseUrl?: string
    apiKey?: string
  }
}

interface DailyLogData {
  weight?: number
  totalCaloriesConsumed?: number
  totalCaloriesBurned?: number
  netCalories?: number
  mood?: string
  stress?: string
  sleepQuality?: string
  sleepHours?: number
  notes?: string
}

interface FoodEntryData {
  name: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  amount?: string
  description?: string
}

interface ExerciseEntryData {
  name: string
  type?: string
  duration?: number
  calories: number
  intensity?: string
  description?: string
}

// 数据库操作工具函数
export class DatabaseService {
  // 用户相关操作
  static async createOrGetUser(email?: string, name?: string) {
    if (!email) {
      // 如果没有email，创建匿名用户
      return await prisma.user.create({
        data: {
          name: name || 'Anonymous User',
        },
        include: {
          profile: true,
          aiConfig: true,
        },
      })
    }

    return await prisma.user.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name: name || 'User',
      },
      include: {
        profile: true,
        aiConfig: true,
      },
    })
  }

  // 获取或创建用户档案
  static async getOrCreateUserProfile(userId: string) {
    return await prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })
  }

  // AI配置相关
  static async updateAIConfig(userId: string, config: AIConfigData) {
    return await prisma.aIConfig.upsert({
      where: { userId },
      update: {
        agentModelName: config.agentModel?.name,
        agentModelBaseUrl: config.agentModel?.baseUrl,
        agentModelApiKey: config.agentModel?.apiKey,
        visionModelName: config.visionModel?.name,
        visionModelBaseUrl: config.visionModel?.baseUrl,
        visionModelApiKey: config.visionModel?.apiKey,
      },
      create: {
        userId,
        agentModelName: config.agentModel?.name,
        agentModelBaseUrl: config.agentModel?.baseUrl,
        agentModelApiKey: config.agentModel?.apiKey,
        visionModelName: config.visionModel?.name,
        visionModelBaseUrl: config.visionModel?.baseUrl,
        visionModelApiKey: config.visionModel?.apiKey,
      },
    })
  }

  // 日志相关操作
  static async getDailyLog(userId: string, date: string) {
    return await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      include: {
        foodEntries: true,
        exerciseEntries: true,
      },
    })
  }

  static async createOrUpdateDailyLog(userId: string, date: string, data: DailyLogData) {
    return await prisma.dailyLog.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      update: {
        weight: data.weight,
        totalCaloriesConsumed: data.totalCaloriesConsumed,
        totalCaloriesBurned: data.totalCaloriesBurned,
        netCalories: data.netCalories,
        mood: data.mood,
        stress: data.stress,
        sleepQuality: data.sleepQuality,
        sleepHours: data.sleepHours,
        notes: data.notes,
      },
      create: {
        userId,
        date,
        weight: data.weight,
        totalCaloriesConsumed: data.totalCaloriesConsumed || 0,
        totalCaloriesBurned: data.totalCaloriesBurned || 0,
        netCalories: data.netCalories || 0,
        mood: data.mood,
        stress: data.stress,
        sleepQuality: data.sleepQuality,
        sleepHours: data.sleepHours,
        notes: data.notes,
      },
      include: {
        foodEntries: true,
        exerciseEntries: true,
      },
    })
  }

  // 食物记录
  static async addFoodEntry(logId: string, foodData: FoodEntryData) {
    return await prisma.foodEntry.create({
      data: {
        logId,
        name: foodData.name,
        calories: foodData.calories,
        protein: foodData.protein,
        carbs: foodData.carbs,
        fat: foodData.fat,
        fiber: foodData.fiber,
        sugar: foodData.sugar,
        sodium: foodData.sodium,
        amount: foodData.amount,
        description: foodData.description,
      },
    })
  }

  // 运动记录
  static async addExerciseEntry(logId: string, exerciseData: ExerciseEntryData) {
    return await prisma.exerciseEntry.create({
      data: {
        logId,
        name: exerciseData.name,
        type: exerciseData.type,
        duration: exerciseData.duration,
        calories: exerciseData.calories,
        intensity: exerciseData.intensity,
        description: exerciseData.description,
      },
    })
  }

  // 删除记录
  static async deleteFoodEntry(id: string) {
    return await prisma.foodEntry.delete({
      where: { id },
    })
  }

  static async deleteExerciseEntry(id: string) {
    return await prisma.exerciseEntry.delete({
      where: { id },
    })
  }

  // AI记忆功能
  static async saveAIMemory(userId: string, category: string, key: string, value: any, context?: string) {
    return await prisma.aIMemory.upsert({
      where: {
        userId_category_key: {
          userId,
          category,
          key,
        },
      },
      update: {
        value: JSON.stringify(value),
        context,
      },
      create: {
        userId,
        category,
        key,
        value: JSON.stringify(value),
        context,
      },
    })
  }

  static async getAIMemory(userId: string, category?: string) {
    const memories = await prisma.aIMemory.findMany({
      where: {
        userId,
        ...(category && { category }),
      },
    })

    return memories.map((memory: any) => ({
      ...memory,
      value: JSON.parse(memory.value),
    }))
  }

  // 获取用户的历史数据（用于分析和报告）
  static async getUserHistory(userId: string, startDate?: string, endDate?: string) {
    const whereClause: any = { userId }
    
    if (startDate || endDate) {
      whereClause.date = {}
      if (startDate) whereClause.date.gte = startDate
      if (endDate) whereClause.date.lte = endDate
    }

    return await prisma.dailyLog.findMany({
      where: whereClause,
      include: {
        foodEntries: true,
        exerciseEntries: true,
      },
      orderBy: {
        date: 'desc',
      },
    })
  }

  // 数据导出（用于备份或迁移）
  static async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        aiConfig: true,
        dailyLogs: {
          include: {
            foodEntries: true,
            exerciseEntries: true,
          },
        },
      },
    })

    const aiMemories = await this.getAIMemory(userId)

    return {
      user,
      aiMemories,
      exportDate: new Date().toISOString(),
      version: '1.0',
    }
  }
} 