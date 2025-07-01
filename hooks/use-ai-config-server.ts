"use client"

import { useState, useEffect, useCallback } from "react"
import { useServerStorage } from "./use-server-storage"
import type { AIConfig } from "@/lib/types"

interface AIConfigServerHook {
  aiConfig: AIConfig | null
  saveAIConfig: (config: AIConfig) => Promise<void>
  deleteAIConfig: () => Promise<void>
  loadAIConfig: () => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function useAIConfigServer(): AIConfigServerHook {
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null)
  const { getData, saveData, deleteData, isLoading, error } = useServerStorage()

  // 加载 AI 配置
  const loadAIConfig = useCallback(async () => {
    try {
      const response = await getData('/api/db/ai-config')
      if (response.aiConfig) {
        const config = response.aiConfig
        setAIConfig({
          chatModel: config.chatModel ? JSON.parse(config.chatModel) : null,
          parseModel: config.parseModel ? JSON.parse(config.parseModel) : null,
          adviceModel: config.adviceModel ? JSON.parse(config.adviceModel) : null,
          tefModel: config.tefModel ? JSON.parse(config.tefModel) : null,
        })
      } else {
        setAIConfig(null)
      }
    } catch (err) {
      console.error('Load AI config error:', err)
      // 如果是404错误，说明用户还没有配置，这是正常的
      if (err instanceof Error && err.message.includes('404')) {
        setAIConfig(null)
      } else {
        throw err
      }
    }
  }, [getData])

  // 保存 AI 配置
  const saveAIConfig = useCallback(
    async (config: AIConfig): Promise<void> => {
      try {
        const response = await saveData('/api/db/ai-config', config)
        const savedConfig = response.aiConfig
        setAIConfig({
          chatModel: savedConfig.chatModel ? JSON.parse(savedConfig.chatModel) : null,
          parseModel: savedConfig.parseModel ? JSON.parse(savedConfig.parseModel) : null,
          adviceModel: savedConfig.adviceModel ? JSON.parse(savedConfig.adviceModel) : null,
          tefModel: savedConfig.tefModel ? JSON.parse(savedConfig.tefModel) : null,
        })
      } catch (err) {
        console.error('Save AI config error:', err)
        throw err
      }
    },
    [saveData]
  )

  // 删除 AI 配置
  const deleteAIConfig = useCallback(
    async (): Promise<void> => {
      try {
        await deleteData('/api/db/ai-config')
        setAIConfig(null)
      } catch (err) {
        console.error('Delete AI config error:', err)
        throw err
      }
    },
    [deleteData]
  )

  // 初始加载
  useEffect(() => {
    loadAIConfig().catch(console.error)
  }, [loadAIConfig])

  return {
    aiConfig,
    saveAIConfig,
    deleteAIConfig,
    loadAIConfig,
    isLoading,
    error,
  }
}
