import { useState, useCallback, useEffect } from 'react';
import { useIndexedDB } from './use-indexed-db';
import { useToast } from './use-toast';
import { useTranslation } from './use-i18n';
import type { DailyLog } from '@/lib/types';
import { useSession } from 'next-auth/react';

// 定义从API返回的日志结构
interface SyncedLog {
  id: string;
  user_id: string;
  date: string;
  log_data: DailyLog;
  last_modified: string;
}

export const useSync = () => {
  const { data: session } = useSession();
  const { getAllData, saveData, batchSave } = useIndexedDB("healthLogs");
  const { toast } = useToast();
  const t = useTranslation('sync');

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const pullData = useCallback(async () => {
    if (!session) {
      console.log("[Sync] User not logged in, skipping pull.");
      return;
    }
    if (isSyncing) return;

    console.log("[Sync] Starting data pull from cloud...");
    setIsSyncing(true);

    try {
      const response = await fetch('/api/sync/logs');

      if (response.status === 401) {
        toast({ title: t('error.unauthorized.title'), description: t('error.unauthorized.description'), variant: 'destructive' });
        return;
      }
      if (!response.ok) {
        throw new Error(t('error.pullFailed'));
      }

      const serverLogs: SyncedLog[] = await response.json();
      if (serverLogs.length === 0) {
        console.log('[Sync] No logs found in the cloud.');
        return;
      }

      console.log(`[Sync] Fetched ${serverLogs.length} logs from the cloud. Comparing with local data...`);

      const localLogs = await getAllData();
      const localLogsMap = new Map(localLogs.map((log: DailyLog) => [log.date, log]));
      const logsToUpdate: DailyLog[] = [];

      for (const serverLog of serverLogs) {
        const localLog = localLogsMap.get(serverLog.date);
        // 如果本地不存在，或者服务器的版本更新，则采纳服务器的版本
        if (!localLog || new Date(serverLog.last_modified) > new Date(localLog.last_modified || 0)) {
          // API返回的log_data就是完整的DailyLog对象
          logsToUpdate.push(serverLog.log_data);
        }
      }

      if (logsToUpdate.length > 0) {
        console.log(`[Sync] Updating ${logsToUpdate.length} local logs with newer data from the cloud.`);
        await batchSave(logsToUpdate);
        toast({ title: t('success.pullTitle'), description: t('success.pullDescription', { count: logsToUpdate.length }) });
      } else {
        console.log('[Sync] Local data is up to date.');
      }

      setLastSynced(new Date());
    } catch (error) {
      console.error('[Sync] Pull error:', error);
      toast({ title: t('error.pullTitle'), description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  }, [session, isSyncing, getAllData, batchSave, toast, t]);

  const pushData = useCallback(async (logToPush: DailyLog) => {
    if (!session) {
        console.log("[Sync] User not logged in, skipping push.");
        return;
    }
    if (isSyncing) return;

    console.log(`[Sync] Starting data push to cloud for date: ${logToPush.date}`);
    setIsSyncing(true);

    try {
      // 在推送到云端前，先更新本地版本的时间戳
      const logWithTimestamp: DailyLog = {
        ...logToPush,
        last_modified: new Date().toISOString(),
      };
      await saveData(logWithTimestamp.date, logWithTimestamp);

      // 准备用于API的数据结构
      const apiPayload = {
        date: logWithTimestamp.date,
        log_data: logWithTimestamp,
        last_modified: logWithTimestamp.last_modified,
      };

      const response = await fetch('/api/sync/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([apiPayload]), // API需要一个数组
      });

      if (response.status === 401) {
        toast({ title: t('error.unauthorized.title'), description: t('error.unauthorized.description'), variant: 'destructive' });
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('error.pushFailed'));
      }

      console.log(`[Sync] Successfully pushed data for date: ${logToPush.date}`);
      setLastSynced(new Date());

    } catch (error) {
      console.error('[Sync] Push error:', error);
      toast({ title: t('error.pushTitle'), description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  }, [session, isSyncing, saveData, toast, t]);


  // 在用户登录后，自动执行一次数据拉取
  useEffect(() => {
    if (session) {
      pullData();
    }
  }, [session, pullData]);

  return { isSyncing, lastSynced, pushData, pullData };
};