"use client";

import { useState, useEffect, useCallback } from "react";
import { useServerStorage } from "./use-server-storage";
import { useAuth } from "./use-auth";
import type { AIConfig } from "@/lib/types";

interface AIConfigServerHook {
  aiConfig: AIConfig | null;
  saveAIConfig: (config: AIConfig) => Promise<void>;
  deleteAIConfig: () => Promise<void>;
  loadAIConfig: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useAIConfigServer(): AIConfigServerHook {
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const { getData, saveData, deleteData, isLoading, error } =
    useServerStorage();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // 加载 AI 配置
  const loadAIConfig = useCallback(async () => {
    try {
      const response = await getData("/api/db/ai-config");
      if (response.aiConfig) {
        const config = response.aiConfig;

        // 提供默认的 ModelConfig 结构，确保所有字段都存在
        const defaultModelConfig = {
          name: "gpt-4.1-mini",
          baseUrl: "https://api.openai.com",
          apiKey: "",
        };

        setAIConfig({
          agentModel: config.agentModel
            ? { ...defaultModelConfig, ...JSON.parse(config.agentModel) }
            : defaultModelConfig,
          chatModel: config.chatModel
            ? { ...defaultModelConfig, ...JSON.parse(config.chatModel) }
            : defaultModelConfig,
          visionModel: config.visionModel
            ? { ...defaultModelConfig, ...JSON.parse(config.visionModel) }
            : defaultModelConfig,
        });
      } else {
        setAIConfig(null);
      }
    } catch (err) {
      console.error("Load AI config error:", err);
      // 如果是404错误，说明用户还没有配置，这是正常的
      if (err instanceof Error && err.message.includes("404")) {
        setAIConfig(null);
      } else {
        throw err;
      }
    }
  }, [getData]);

  // 保存 AI 配置
  const saveAIConfig = useCallback(
    async (config: AIConfig): Promise<void> => {
      try {
        const response = await saveData("/api/db/ai-config", config);
        const savedConfig = response.aiConfig;

        // 提供默认的 ModelConfig 结构，确保所有字段都存在
        const defaultModelConfig = {
          name: "gpt-4.1-mini",
          baseUrl: "https://api.openai.com",
          apiKey: "",
        };

        setAIConfig({
          agentModel: savedConfig.agentModel
            ? { ...defaultModelConfig, ...JSON.parse(savedConfig.agentModel) }
            : defaultModelConfig,
          chatModel: savedConfig.chatModel
            ? { ...defaultModelConfig, ...JSON.parse(savedConfig.chatModel) }
            : defaultModelConfig,
          visionModel: savedConfig.visionModel
            ? { ...defaultModelConfig, ...JSON.parse(savedConfig.visionModel) }
            : defaultModelConfig,
        });
      } catch (err) {
        console.error("Save AI config error:", err);
        throw err;
      }
    },
    [saveData]
  );

  // 删除 AI 配置
  const deleteAIConfig = useCallback(async (): Promise<void> => {
    try {
      await deleteData("/api/db/ai-config");
      setAIConfig(null);
    } catch (err) {
      console.error("Delete AI config error:", err);
      throw err;
    }
  }, [deleteData]);

  // 初始加载 - 等待认证完成后再加载
  useEffect(() => {
    // 只有在认证完成且用户已登录时才加载配置
    if (!authLoading && isAuthenticated) {
      loadAIConfig().catch(console.error);
    }
  }, [loadAIConfig, authLoading, isAuthenticated]);

  return {
    aiConfig,
    saveAIConfig,
    deleteAIConfig,
    loadAIConfig,
    isLoading,
    error,
  };
}
