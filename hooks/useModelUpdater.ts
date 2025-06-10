import { useEffect, useCallback, useState } from 'react';

interface UpdateStatus {
  keysNeedingUpdate: number;
  canUpdate: boolean;
  cooldownMinutes: number;
}

interface UpdateResult {
  updatedCount: number;
  totalKeysNeedingUpdate: number;
  remainingKeys: number;
  message: string;
}

export function useModelUpdater() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 检查更新状态
  const checkUpdateStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/models/update');
      if (response.ok) {
        const status: UpdateStatus = await response.json();
        setUpdateStatus(status);
        return status;
      }
    } catch (error) {
      console.error('Failed to check model update status:', error);
    }
    return null;
  }, []);

  // 执行更新
  const triggerUpdate = useCallback(async (): Promise<UpdateResult | null> => {
    if (isUpdating) return null;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/models/update', {
        method: 'POST',
      });
      
      if (response.ok || response.status === 207) { // 207 = Multi-Status (partial success)
        const result: UpdateResult = await response.json();
        setLastUpdate(new Date());
        
        // 更新状态
        await checkUpdateStatus();
        
        return result;
      } else {
        console.error('Model update failed:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to trigger model update:', error);
    } finally {
      setIsUpdating(false);
    }
    return null;
  }, [isUpdating, checkUpdateStatus]);

  // 自动检查和更新（在组件挂载时）
  useEffect(() => {
    let mounted = true;

    const autoUpdate = async () => {
      if (!mounted) return;

      const status = await checkUpdateStatus();
      if (!status || !mounted) return;

      // 如果有很多密钥需要更新，自动触发一次更新
      if (status.canUpdate && status.keysNeedingUpdate > 0) {
        // 添加随机延迟，避免所有用户同时触发更新
        const delay = Math.random() * 30000; // 0-30秒随机延迟
        
        setTimeout(async () => {
          if (mounted && status.keysNeedingUpdate > 5) {
            console.log(`Auto-triggering model update for ${status.keysNeedingUpdate} keys`);
            await triggerUpdate();
          }
        }, delay);
      }
    };

    autoUpdate();

    return () => {
      mounted = false;
    };
  }, [checkUpdateStatus, triggerUpdate]);

  // 定期检查状态（每5分钟）
  useEffect(() => {
    const interval = setInterval(checkUpdateStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkUpdateStatus]);

  return {
    updateStatus,
    isUpdating,
    lastUpdate,
    checkUpdateStatus,
    triggerUpdate,
  };
}
