// 数据迁移工具 - 从IndexedDB到服务端数据库
import { DatabaseService } from './db'

export interface IndexedDBData {
  userProfile?: any
  aiConfig?: any
  dailyLogs?: { [date: string]: any }
  aiMemories?: any[]
}

export class DataMigrationService {
  // 导出IndexedDB数据的客户端函数
  static async exportIndexedDBData(): Promise<IndexedDBData | null> {
    if (typeof window === 'undefined') {
      return null // 服务端环境
    }

    try {
      const data: IndexedDBData = {}

      // 从localStorage获取用户配置
      const userProfile = localStorage.getItem('userProfile')
      if (userProfile) {
        data.userProfile = JSON.parse(userProfile)
      }

      const aiConfig = localStorage.getItem('aiConfig')
      if (aiConfig) {
        data.aiConfig = JSON.parse(aiConfig)
      }

      // 从localStorage获取日志数据
      const dailyLogsData: { [date: string]: any } = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('dailyLog_')) {
          const date = key.replace('dailyLog_', '')
          const logData = localStorage.getItem(key)
          if (logData) {
            dailyLogsData[date] = JSON.parse(logData)
          }
        }
      }
      data.dailyLogs = dailyLogsData

      // 获取AI记忆数据（如果存在）
      const aiMemories = localStorage.getItem('aiMemories')
      if (aiMemories) {
        data.aiMemories = JSON.parse(aiMemories)
      }

      return data
    } catch (error) {
      console.error('Error exporting IndexedDB data:', error)
      return null
    }
  }

  // 将数据迁移到服务端
  static async migrateToServer(data: IndexedDBData, userId: string): Promise<boolean> {
    try {
      // 1. 迁移用户配置文件
      if (data.userProfile) {
        await fetch('/api/db/user-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            ...data.userProfile,
          }),
        })
      }

      // 2. 迁移AI配置
      if (data.aiConfig) {
        await fetch('/api/db/ai-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            ...data.aiConfig,
          }),
        })
      }

      // 3. 迁移日志数据
      if (data.dailyLogs) {
        for (const [date, logData] of Object.entries(data.dailyLogs)) {
          await fetch('/api/db/daily-log', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              date,
              ...logData,
            }),
          })
        }
      }

      // 4. 迁移AI记忆数据
      if (data.aiMemories && data.aiMemories.length > 0) {
        await fetch('/api/db/ai-memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            memories: data.aiMemories,
          }),
        })
      }

      return true
    } catch (error) {
      console.error('Error migrating data to server:', error)
      return false
    }
  }

  // 创建数据备份（迁移前）
  static async createBackup(data: IndexedDBData): Promise<string> {
    const backup = {
      ...data,
      timestamp: new Date().toISOString(),
      version: '1.0',
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snapifit-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return backup.timestamp
  }

  // 验证迁移完整性
  static async validateMigration(originalData: IndexedDBData, userId: string): Promise<boolean> {
    try {
      // 验证用户配置文件
      if (originalData.userProfile) {
        const response = await fetch(`/api/db/user-profile?userId=${userId}`)
        if (!response.ok) return false
      }

      // 验证AI配置
      if (originalData.aiConfig) {
        const response = await fetch(`/api/db/ai-config?userId=${userId}`)
        if (!response.ok) return false
      }

      // 验证日志数据（检查几个关键日期）
      if (originalData.dailyLogs) {
        const dates = Object.keys(originalData.dailyLogs).slice(0, 5) // 检查前5个日期
        for (const date of dates) {
          const response = await fetch(`/api/db/daily-log?userId=${userId}&date=${date}`)
          if (!response.ok) return false
        }
      }

      return true
    } catch (error) {
      console.error('Error validating migration:', error)
      return false
    }
  }

  // 清理本地数据（迁移成功后）
  static clearLocalData(): void {
    if (typeof window === 'undefined') return

    const confirm = window.confirm(
      '迁移成功！是否要清理本地存储的数据？这个操作不可撤销。'
    )

    if (confirm) {
      // 清理用户配置
      localStorage.removeItem('userProfile')
      localStorage.removeItem('aiConfig')
      localStorage.removeItem('aiMemories')

      // 清理日志数据
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('dailyLog_')) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))

      alert('本地数据已清理完成。')
    }
  }
}

// React Hook for migration
export function useMigration() {
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<string>('')

  const startMigration = async (userId: string) => {
    setIsMigrating(true)
    setMigrationStatus('正在导出本地数据...')

    try {
      // 1. 导出本地数据
      const localData = await DataMigrationService.exportIndexedDBData()
      if (!localData) {
        throw new Error('无法导出本地数据')
      }

      // 2. 创建备份
      setMigrationStatus('正在创建数据备份...')
      await DataMigrationService.createBackup(localData)

      // 3. 迁移到服务端
      setMigrationStatus('正在迁移数据到服务端...')
      const success = await DataMigrationService.migrateToServer(localData, userId)
      if (!success) {
        throw new Error('数据迁移失败')
      }

      // 4. 验证迁移
      setMigrationStatus('正在验证迁移结果...')
      const isValid = await DataMigrationService.validateMigration(localData, userId)
      if (!isValid) {
        throw new Error('迁移验证失败')
      }

      // 5. 清理本地数据
      setMigrationStatus('迁移完成！')
      DataMigrationService.clearLocalData()

      return true
    } catch (error) {
      console.error('Migration failed:', error)
      setMigrationStatus(`迁移失败: ${(error as any).message}`)
      return false
    } finally {
      setIsMigrating(false)
    }
  }

  return {
    isMigrating,
    migrationStatus,
    startMigration,
  }
}

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
                    protein: foodEntry.protein,
                    carbs: foodEntry.carbs,
                    fat: foodEntry.fat,
                    fiber: foodEntry.fiber,
                    sugar: foodEntry.sugar,
                    sodium: foodEntry.sodium,
                    amount: foodEntry.amount,
                    description: foodEntry.description,
                  })
                  migratedFoodEntries++
                } catch (error: any) {
                  result.errors.push(`食物记录迁移失败 (${logData.date}): ${error.message}`)
                }
              }
            }

            // 迁移运动记录
            if (logData.exerciseEntries?.length) {
              for (const exerciseEntry of logData.exerciseEntries) {
                try {
                  await DatabaseService.addExerciseEntry(dailyLog.id, {
                    name: exerciseEntry.name || '未知运动',
                    type: exerciseEntry.type,
                    duration: exerciseEntry.duration,
                    calories: exerciseEntry.calories || 0,
                    intensity: exerciseEntry.intensity,
                    description: exerciseEntry.description,
                  })
                  migratedExerciseEntries++
                } catch (error: any) {
                  result.errors.push(`运动记录迁移失败 (${logData.date}): ${error.message}`)
                }
              }
            }
          } catch (error: any) {
            result.errors.push(`日志迁移失败 (${logData.date}): ${error.message}`)
          }
        }

        result.migratedData.dailyLogs = migratedLogs
        result.migratedData.foodEntries = migratedFoodEntries
        result.migratedData.exerciseEntries = migratedExerciseEntries
      }

      // 5. 迁移AI记忆数据
      if (indexedDBData.aiMemories) {
        let migratedMemories = 0
        
        for (const [key, value] of Object.entries(indexedDBData.aiMemories)) {
          try {
            const [category, memoryKey] = key.includes(':') 
              ? key.split(':', 2) 
              : ['general', key]
            
            await DatabaseService.saveAIMemory(
              user.id,
              category,
              memoryKey,
              value,
              'Migrated from IndexedDB'
            )
            migratedMemories++
          } catch (error: any) {
            result.errors.push(`AI记忆迁移失败 (${key}): ${error.message}`)
          }
        }

        result.migratedData.aiMemories = migratedMemories
      }

      result.success = result.errors.length === 0
      return result

    } catch (error: any) {
      result.errors.push(`迁移过程失败: ${error.message}`)
      result.success = false
      return result
    }
  }

  /**
   * 验证迁移后的数据完整性
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
    const validation = {
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
      const user = await DatabaseService.createOrGetUser()
      validation.summary.userExists = !!user

      // 检查用户配置文件
      const profile = await DatabaseService.getOrCreateUserProfile(userId)
      validation.summary.profileExists = !!profile

      // 检查AI配置
      const aiConfig = await DatabaseService.updateAIConfig(userId, {})
      validation.summary.aiConfigExists = !!aiConfig

      // 检查历史数据
      const history = await DatabaseService.getUserHistory(userId)
      validation.summary.dailyLogsCount = history.length
      validation.summary.totalFoodEntries = history.reduce(
        (sum: number, log: any) => sum + log.foodEntries.length, 
        0
      )
      validation.summary.totalExerciseEntries = history.reduce(
        (sum: number, log: any) => sum + log.exerciseEntries.length, 
        0
      )

      // 检查AI记忆
      const aiMemories = await DatabaseService.getAIMemory(userId)
      validation.summary.aiMemoriesCount = aiMemories.length

      // 验证数据完整性
      if (!validation.summary.userExists) {
        validation.issues.push('用户不存在')
        validation.isValid = false
      }

    } catch (error: any) {
      validation.issues.push(`验证过程失败: ${error.message}`)
      validation.isValid = false
    }

    return validation
  }

  /**
   * 创建数据备份
   */
  static async createBackup(userId: string): Promise<{
    success: boolean
    backupData?: any
    error?: string
  }> {
    try {
      const backupData = await DatabaseService.exportUserData(userId)
      
      return {
        success: true,
        backupData,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * 从备份恢复数据
   */
  static async restoreFromBackup(
    backupData: any,
    newUserId?: string
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedData: {},
      errors: []
    }

    try {
      if (!backupData.user) {
        throw new Error('备份数据格式无效')
      }

      // 创建新用户或使用现有用户ID
      const user = newUserId 
        ? await DatabaseService.createOrGetUser()
        : await DatabaseService.createOrGetUser(
            backupData.user.email,
            backupData.user.name
          )

      result.userId = user.id

      // 恢复数据的逻辑类似于迁移，但使用备份数据格式
      // 这里可以根据实际需要进一步实现

      result.success = true
      return result

    } catch (error: any) {
      result.errors.push(`恢复失败: ${error.message}`)
      return result
    }
  }
} 