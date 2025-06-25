'use client'

import { useHealthData } from './use-health-data'
import { useIndexedDB } from './use-indexed-db'

// 获取存储模式配置
const getStorageMode = (): 'server' | 'browser' => {
  const mode = process.env.NEXT_PUBLIC_STORAGE_MODE as 'server' | 'browser'
  return mode === 'server' ? 'server' : 'browser' // 默认使用browser模式
}

/**
 * 自适应存储Hook
 * 根据环境变量 NEXT_PUBLIC_STORAGE_MODE 决定使用服务端存储还是浏览器端存储
 */
export function useAdaptiveHealthData() {
  const storageMode = getStorageMode()
  
  // 服务端存储
  const serverStorage = useHealthData()
  
  // 浏览器端存储  
  const browserStorage = useIndexedDB("healthLogs")
  
  if (storageMode === 'server') {
    // 返回服务端存储接口，适配为统一接口
    return {
      // 数据获取
      getData: async (dateKey: string) => {
        await serverStorage.loadHealthData(dateKey)
        return serverStorage.healthData
      },
      
      // 数据保存
      saveData: async (dateKey: string, data: any) => {
        await serverStorage.saveHealthData(dateKey, data)
        return serverStorage.healthData
      },
      
      // 添加食物记录
      addFoodEntry: async (dateKey: string, food: any) => {
        await serverStorage.addFoodEntry(dateKey, food)
      },
      
      // 添加运动记录
      addExerciseEntry: async (dateKey: string, exercise: any) => {
        await serverStorage.addExerciseEntry(dateKey, exercise)
      },
      
      // 删除记录
      removeFoodEntry: async (foodId: string) => {
        await serverStorage.removeFoodEntry(foodId)
      },
      
      removeExerciseEntry: async (exerciseId: string) => {
        await serverStorage.removeExerciseEntry(exerciseId)
      },
      
      // 获取历史数据
      getUserHistory: async (startDate?: string, endDate?: string) => {
        return await serverStorage.getUserHistory(startDate, endDate)
      },
      
      // 清空所有数据
      clearAllData: async () => {
        // 服务端可能需要特殊处理，暂时返回
        console.warn('Server storage clearAllData not implemented')
      },
      
      // 状态
      isLoading: serverStorage.isLoading,
      isInitializing: false,
      error: serverStorage.error,
      
      // 存储模式标识
      storageMode: 'server' as const
    }
  } else {
    // 返回浏览器端存储接口
    return {
      ...browserStorage,
      storageMode: 'browser' as const
    }
  }
} 