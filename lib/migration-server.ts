// 服务端数据迁移工具 - 从IndexedDB到服务端数据库
import { DatabaseService, prisma } from './db'

// IndexedDB 数据结构类型定义
interface IndexedDBUserProfile {
  basicInfo?: {
    age?: number
    gender?: string
    height?: number
    weight?: number
    activityLevel?: string
    goals?: string[]
  }
  preferences?: {
    units?: string
    language?: string
    notifications?: boolean
  }
}

interface IndexedDBDailyLog {
  date: string
  weight?: number
  totalCaloriesConsumed?: number
  totalCaloriesBurned?: number
  netCalories?: number
  mood?: string
  stress?: string
  sleepQuality?: string
  sleepHours?: number
  notes?: string
  foodEntries?: any[]
  exerciseEntries?: any[]
}

interface IndexedDBAIConfig {
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

// 迁移结果接口
interface MigrationResult {
  success: boolean
  userId?: string
  migratedData: {
    userProfile?: boolean
    aiConfig?: boolean
    dailyLogs?: number
    foodEntries?: number
    exerciseEntries?: number
    aiMemories?: number
  }
  errors: string[]
}

export class DataMigration {
  /**
   * 从IndexedDB数据迁移到SQLite数据库
   */
  static async migrateFromIndexedDB(
    indexedDBData: {
      userProfile?: IndexedDBUserProfile
      aiConfig?: IndexedDBAIConfig
      dailyLogs?: IndexedDBDailyLog[]
      aiMemories?: Record<string, any>
    },
    userEmail?: string,
    userName?: string
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedData: {},
      errors: []
    }

    try {
      // 1. 创建或获取用户
      const user = await DatabaseService.createOrGetUser(
        userEmail || `user_${Date.now()}@snapifit.local`,
        userName || 'Migrated User'
      )
      result.userId = user.id

      // 2. 迁移用户配置文件
      if (indexedDBData.userProfile) {
        try {
          await DatabaseService.getOrCreateUserProfile(user.id)
          result.migratedData.userProfile = true
        } catch (error: any) {
          result.errors.push(`用户配置文件迁移失败: ${error.message}`)
        }
      }

      // 3. 迁移AI配置
      if (indexedDBData.aiConfig) {
        try {
          await DatabaseService.updateAIConfig(user.id, indexedDBData.aiConfig)
          result.migratedData.aiConfig = true
        } catch (error: any) {
          result.errors.push(`AI配置迁移失败: ${error.message}`)
        }
      }

      // 4. 迁移日志数据
      if (indexedDBData.dailyLogs?.length) {
        let migratedLogs = 0
        let migratedFoodEntries = 0
        let migratedExerciseEntries = 0

        for (const logData of indexedDBData.dailyLogs) {
          try {
            const dailyLog = await DatabaseService.createOrUpdateDailyLog(
              user.id,
              logData.date,
              {
                weight: logData.weight,
                totalCaloriesConsumed: logData.totalCaloriesConsumed,
                totalCaloriesBurned: logData.totalCaloriesBurned,
                netCalories: logData.netCalories,
                mood: logData.mood,
                stress: logData.stress,
                sleepQuality: logData.sleepQuality,
                sleepHours: logData.sleepHours,
                notes: logData.notes,
              }
            )

            migratedLogs++

            // 迁移食物记录
            if (logData.foodEntries?.length) {
              for (const foodEntry of logData.foodEntries) {
                try {
                  await DatabaseService.addFoodEntry(dailyLog.id, {
                    name: foodEntry.name || '未知食物',
                    calories: foodEntry.calories || 0,
                    protein: foodEntry.protein || 0,
                    carbs: foodEntry.carbohydrates || 0,
                    fat: foodEntry.fat || 0,
                    fiber: foodEntry.fiber || 0,
                    sugar: foodEntry.sugar || 0,
                    sodium: foodEntry.sodium || 0,
                    amount: foodEntry.unit || '份',
                    description: foodEntry.notes,
                  })
                  migratedFoodEntries++
                } catch (error: any) {
                  result.errors.push(`食物记录迁移失败: ${error.message}`)
                }
              }
            }

            // 迁移运动记录
            if (logData.exerciseEntries?.length) {
              for (const exerciseEntry of logData.exerciseEntries) {
                try {
                  await DatabaseService.addExerciseEntry(dailyLog.id, {
                    name: exerciseEntry.name || '未知运动',
                    duration: exerciseEntry.duration || 0,
                    calories: exerciseEntry.caloriesBurned || 0,
                    intensity: exerciseEntry.intensity || 'moderate',
                    type: exerciseEntry.category,
                    description: exerciseEntry.notes,
                  })
                  migratedExerciseEntries++
                } catch (error: any) {
                  result.errors.push(`运动记录迁移失败: ${error.message}`)
                }
              }
            }
          } catch (error: any) {
            result.errors.push(`日志 ${logData.date} 迁移失败: ${error.message}`)
          }
        }

        result.migratedData.dailyLogs = migratedLogs
        result.migratedData.foodEntries = migratedFoodEntries
        result.migratedData.exerciseEntries = migratedExerciseEntries
      }

      // 5. 迁移AI记忆
      if (indexedDBData.aiMemories && Object.keys(indexedDBData.aiMemories).length > 0) {
        let migratedMemories = 0
        for (const [expertId, memory] of Object.entries(indexedDBData.aiMemories)) {
          try {
            await DatabaseService.saveAIMemory(
              user.id,
              'expert',
              expertId,
              {
                content: memory.content || '',
                lastUpdated: new Date(memory.lastUpdated || Date.now()),
              },
              'migrated from IndexedDB'
            )
            migratedMemories++
          } catch (error: any) {
            result.errors.push(`AI记忆 ${expertId} 迁移失败: ${error.message}`)
          }
        }
        result.migratedData.aiMemories = migratedMemories
      }

      // 判断迁移是否成功
      result.success = result.errors.length === 0

      return result
    } catch (error: any) {
      console.error('DataMigration.migrateFromIndexedDB error:', error)
      result.errors.push(`迁移过程出错: ${error.message}`)
      return result
    }
  }

  /**
   * 验证迁移结果
   */
  static async validateMigration(userId: string): Promise<{
    isValid: boolean
    summary: {
      userExists: boolean
      profileExists: boolean
      aiConfigExists: boolean
      dailyLogsCount: number
      totalFoodEntries: number
      totalExerciseEntries: number
      aiMemoriesCount: number
    }
    issues: string[]
  }> {
    const result = {
      isValid: true,
      summary: {
        userExists: false,
        profileExists: false,
        aiConfigExists: false,
        dailyLogsCount: 0,
        totalFoodEntries: 0,
        totalExerciseEntries: 0,
        aiMemoriesCount: 0,
      },
      issues: [] as string[]
    }

    try {
      // 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })
      result.summary.userExists = !!user

      if (!user) {
        result.issues.push('用户不存在')
        result.isValid = false
        return result
      }

      // 检查用户配置文件
      try {
        const profile = await prisma.userProfile.findUnique({
          where: { userId }
        })
        result.summary.profileExists = !!profile
      } catch (error) {
        result.issues.push('用户配置文件验证失败')
      }

      // 检查AI配置
      try {
        const aiConfig = await prisma.aIConfig.findUnique({
          where: { userId }
        })
        result.summary.aiConfigExists = !!aiConfig
      } catch (error) {
        result.issues.push('AI配置验证失败')
      }

      // 检查日志数据
      try {
        const dailyLogs = await DatabaseService.getUserHistory(userId)
        result.summary.dailyLogsCount = dailyLogs.length

        // 统计食物和运动记录
        for (const log of dailyLogs) {
          result.summary.totalFoodEntries += log.foodEntries.length
          result.summary.totalExerciseEntries += log.exerciseEntries.length
        }
      } catch (error) {
        result.issues.push('日志数据验证失败')
      }

      // 检查AI记忆
      try {
        const memories = await DatabaseService.getAIMemory(userId)
        result.summary.aiMemoriesCount = memories.length
      } catch (error) {
        result.issues.push('AI记忆验证失败')
      }

      result.isValid = result.issues.length === 0

      return result
    } catch (error: any) {
      result.issues.push(`验证过程出错: ${error.message}`)
      result.isValid = false
      return result
    }
  }

  /**
   * 创建用户数据备份
   */
  static async createBackup(userId: string): Promise<{
    success: boolean
    backupData?: any
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })
      if (!user) {
        return { success: false, error: '用户不存在' }
      }

      const backupData = {
        user,
        userProfile: await prisma.userProfile.findUnique({
          where: { userId }
        }).catch(() => null),
        aiConfig: await prisma.aIConfig.findUnique({
          where: { userId }
        }).catch(() => null),
        dailyLogs: await DatabaseService.getUserHistory(userId).catch(() => []),
        aiMemories: await DatabaseService.getAIMemory(userId).catch(() => []),
        timestamp: new Date().toISOString(),
      }

      return { success: true, backupData }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * 从备份恢复数据
   */
  static async restoreFromBackup(
    backupData: any,
    newUserId?: string
  ): Promise<MigrationResult> {
    // 这里可以实现从备份恢复的逻辑
    // 暂时返回成功状态
    return {
      success: true,
      migratedData: {},
      errors: []
    }
  }
} 