import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useIndexedDB } from './use-indexed-db';
import { useToast } from './use-toast';
import { useTranslation } from './use-i18n';
import type { AIMemory } from '@/lib/types';

export const useAIMemorySync = () => {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { getAllData: getAllMemories, saveData: saveMemory } = useIndexedDB("aiMemories");
  const { toast } = useToast();
  const t = useTranslation('sync');

  // 从云端拉取AI记忆
  const pullMemories = useCallback(async () => {
    if (!userId) {
      console.log("[AIMemorySync] User not logged in, skipping memories pull.");
      return;
    }

    console.log("[AIMemorySync] Starting AI memories pull from cloud...");
    
    try {
      const response = await fetch('/api/sync/memories');
      
      if (response.status === 401) {
        toast({ title: t('error.unauthorized.title'), description: t('error.unauthorized.description'), variant: 'destructive' });
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch AI memories');
      }

      const serverMemories: Record<string, AIMemory> = await response.json();
      const memoryCount = Object.keys(serverMemories).length;
      
      if (memoryCount === 0) {
        console.log('[AIMemorySync] No AI memories found in the cloud.');
        return;
      }

      console.log(`[AIMemorySync] Fetched ${memoryCount} AI memories from the cloud.`);

      // 逐个保存到本地IndexedDB
      for (const [expertId, memory] of Object.entries(serverMemories)) {
        await saveMemory(expertId, memory);
      }

      console.log(`[AIMemorySync] Successfully synced ${memoryCount} AI memories to local storage.`);

    } catch (error) {
      console.error('[AIMemorySync] AI memories pull error:', error);
      throw error; // 让调用者处理错误
    }
  }, [userId, saveMemory, toast, t]);

  // 推送AI记忆到云端
  const pushMemories = useCallback(async () => {
    if (!userId) {
      console.log("[AIMemorySync] User not logged in, skipping memories push.");
      return;
    }

    console.log("[AIMemorySync] Starting AI memories push to cloud...");
    
    try {
      // 获取所有本地AI记忆
      const localMemories = await getAllMemories();
      
      if (localMemories.length === 0) {
        console.log('[AIMemorySync] No local AI memories to sync.');
        return;
      }

      // 转换为API期望的格式
      const memoriesToSync: Record<string, any> = {};
      localMemories.forEach((memory: AIMemory) => {
        memoriesToSync[memory.expertId] = {
          content: memory.content,
          version: memory.version,
          lastUpdated: memory.lastUpdated
        };
      });

      const response = await fetch('/api/sync/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoriesToSync),
      });

      if (response.status === 401) {
        toast({ title: t('error.unauthorized.title'), description: t('error.unauthorized.description'), variant: 'destructive' });
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync AI memories');
      }

      const result = await response.json();
      console.log(`[AIMemorySync] Successfully pushed ${result.count || localMemories.length} AI memories`);

    } catch (error) {
      console.error('[AIMemorySync] AI memories push error:', error);
      throw error; // 让调用者处理错误
    }
  }, [userId, getAllMemories, toast, t]);

  // 同步单个AI记忆
  const syncSingleMemory = useCallback(async (expertId: string, memory: AIMemory) => {
    if (!userId) {
      console.log("[AIMemorySync] User not logged in, skipping single memory sync.");
      return;
    }

    console.log(`[AIMemorySync] Syncing single memory for expert: ${expertId}`);
    
    try {
      // 先保存到本地
      await saveMemory(expertId, memory);

      // 然后推送到云端
      const memoryToSync = {
        [expertId]: {
          content: memory.content,
          version: memory.version,
          lastUpdated: memory.lastUpdated
        }
      };

      const response = await fetch('/api/sync/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoryToSync),
      });

      if (response.status === 401) {
        toast({ title: t('error.unauthorized.title'), description: t('error.unauthorized.description'), variant: 'destructive' });
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync AI memory');
      }

      console.log(`[AIMemorySync] Successfully synced memory for expert: ${expertId}`);

    } catch (error) {
      console.error(`[AIMemorySync] Single memory sync error for ${expertId}:`, error);
      throw error; // 让调用者处理错误
    }
  }, [userId, saveMemory, toast, t]);

  return {
    pullMemories,
    pushMemories,
    syncSingleMemory
  };
};
