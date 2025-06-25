'use client'

import { useServerAIMemory } from './use-server-ai-memory'
import { useAIMemory } from './use-ai-memory'

// 获取存储模式配置
const getStorageMode = (): 'server' | 'browser' => {
  const mode = process.env.NEXT_PUBLIC_STORAGE_MODE as 'server' | 'browser'
  return mode === 'server' ? 'server' : 'browser' // 默认使用browser模式
}

/**
 * 自适应AI记忆Hook
 * 根据环境变量 NEXT_PUBLIC_STORAGE_MODE 决定使用服务端存储还是浏览器端存储
 */
export function useAdaptiveAIMemory() {
  const storageMode = getStorageMode()
  
  // 服务端存储
  const serverMemory = useServerAIMemory()
  
  // 浏览器端存储
  const browserMemory = useAIMemory()
  
  if (storageMode === 'server') {
    // 返回服务端存储接口
    return {
      ...serverMemory,
      storageMode: 'server' as const
    }
  } else {
    // 返回浏览器端存储接口
    return {
      ...browserMemory,
      storageMode: 'browser' as const
    }
  }
} 