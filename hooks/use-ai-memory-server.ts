"use client";

import { useState, useEffect, useCallback } from "react";
import { useServerStorage } from "./use-server-storage";
import { useAuth } from "./use-auth";
import type { AIMemory, AIMemoryUpdateRequest } from "@/lib/types";

interface AIMemoryServerHook {
  memories: Record<string, AIMemory>;
  getMemory: (expertId: string) => AIMemory | null;
  updateMemory: (request: AIMemoryUpdateRequest) => Promise<void>;
  clearMemory: (expertId: string) => Promise<void>;
  clearAllMemories: () => Promise<void>;
  loadMemories: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useAIMemoryServer(): AIMemoryServerHook {
  const [memories, setMemories] = useState<Record<string, AIMemory>>({});
  const { getData, saveData, updateData, deleteData, isLoading, error } =
    useServerStorage();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // 加载所有记忆
  const loadMemories = useCallback(async () => {
    try {
      const response = await getData("/api/db/ai-memory");
      const memoriesData: Record<string, AIMemory> = {};

      if (response.aiMemories) {
        response.aiMemories.forEach((memory: any) => {
          memoriesData[memory.expertId] = {
            expertId: memory.expertId,
            conversationCount: memory.conversationCount,
            lastUpdated: memory.lastUpdated,
            keyInsights: memory.keyInsights
              ? JSON.parse(memory.keyInsights)
              : [],
            userPreferences: memory.userPreferences
              ? JSON.parse(memory.userPreferences)
              : {},
            healthPatterns: memory.healthPatterns
              ? JSON.parse(memory.healthPatterns)
              : [],
            goals: memory.goals ? JSON.parse(memory.goals) : [],
            concerns: memory.concerns ? JSON.parse(memory.concerns) : [],
          };
        });
      }

      setMemories(memoriesData);
    } catch (err) {
      console.error("Load memories error:", err);
      throw err;
    }
  }, [getData]);

  // 获取特定专家的记忆
  const getMemory = useCallback(
    (expertId: string): AIMemory | null => {
      return memories[expertId] || null;
    },
    [memories]
  );

  // 更新记忆
  const updateMemory = useCallback(
    async (request: AIMemoryUpdateRequest): Promise<void> => {
      try {
        const currentMemory = memories[request.expertId] || {
          expertId: request.expertId,
          conversationCount: 0,
          lastUpdated: new Date().toISOString(),
          keyInsights: [],
          userPreferences: {},
          healthPatterns: [],
          goals: [],
          concerns: [],
        };

        const updatedMemory = {
          ...currentMemory,
          conversationCount: currentMemory.conversationCount + 1,
          lastUpdated: new Date().toISOString(),
        };

        // 应用更新
        if (request.keyInsights) {
          updatedMemory.keyInsights = [
            ...(updatedMemory.keyInsights || []),
            ...request.keyInsights,
          ];
        }
        if (request.userPreferences) {
          updatedMemory.userPreferences = {
            ...updatedMemory.userPreferences,
            ...request.userPreferences,
          };
        }
        if (request.healthPatterns) {
          updatedMemory.healthPatterns = [
            ...(updatedMemory.healthPatterns || []),
            ...request.healthPatterns,
          ];
        }
        if (request.goals) {
          updatedMemory.goals = [
            ...(updatedMemory.goals || []),
            ...request.goals,
          ];
        }
        if (request.concerns) {
          updatedMemory.concerns = [
            ...(updatedMemory.concerns || []),
            ...request.concerns,
          ];
        }

        // 保存到服务器
        await saveData("/api/db/ai-memory", updatedMemory);

        // 更新本地状态
        setMemories((prev) => ({
          ...prev,
          [request.expertId]: updatedMemory,
        }));
      } catch (err) {
        console.error("Update memory error:", err);
        throw err;
      }
    },
    [memories, saveData]
  );

  // 清除特定专家的记忆
  const clearMemory = useCallback(
    async (expertId: string): Promise<void> => {
      try {
        await deleteData("/api/db/ai-memory", { expertId });

        // 更新本地状态
        setMemories((prev) => {
          const newMemories = { ...prev };
          delete newMemories[expertId];
          return newMemories;
        });
      } catch (err) {
        console.error("Clear memory error:", err);
        throw err;
      }
    },
    [deleteData]
  );

  // 清除所有记忆
  const clearAllMemories = useCallback(async (): Promise<void> => {
    try {
      await updateData("/api/db/ai-memory", {});
      setMemories({});
    } catch (err) {
      console.error("Clear all memories error:", err);
      throw err;
    }
  }, [updateData]);

  // 初始加载 - 等待认证完成后再加载
  useEffect(() => {
    // 只有在认证完成且用户已登录时才加载记忆
    if (!authLoading && isAuthenticated) {
      loadMemories().catch(console.error);
    }
  }, [loadMemories, authLoading, isAuthenticated]);

  return {
    memories,
    getMemory,
    updateMemory,
    clearMemory,
    clearAllMemories,
    loadMemories,
    isLoading,
    error,
  };
}
