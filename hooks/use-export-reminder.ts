import { useState, useEffect } from "react";
import { useIndexedDB } from "./use-indexed-db";
import { useAuth } from "./use-auth";

interface ExportReminderState {
  shouldRemind: boolean;
  daysSinceLastExport: number;
  lastExportDate: Date | null;
  hasEnoughData: boolean;
  dataSpanDays: number;
}

export function useExportReminder(): ExportReminderState {
  const [reminderState, setReminderState] = useState<ExportReminderState>({
    shouldRemind: false,
    daysSinceLastExport: 0,
    lastExportDate: null,
    hasEnoughData: false,
    dataSpanDays: 0,
  });
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    // 只有在认证完成且已登录时才检查导出提醒
    if (authLoading || !isAuthenticated) {
      return;
    }

    const checkExportReminder = async () => {
      try {
        // 首先检查IndexedDB中的数据
        const hasEnoughData = await checkIndexedDBData();

        if (!hasEnoughData.hasData) {
          // 如果没有足够的数据，不提醒导出
          setReminderState({
            shouldRemind: false,
            daysSinceLastExport: 0,
            lastExportDate: null,
            hasEnoughData: false,
            dataSpanDays: hasEnoughData.spanDays,
          });
          return;
        }

        const lastExportTimeStr = localStorage.getItem("lastExportTime");

        if (!lastExportTimeStr) {
          // 从未导出过，且有足够数据，提醒导出
          setReminderState({
            shouldRemind: true,
            daysSinceLastExport: Infinity,
            lastExportDate: null,
            hasEnoughData: true,
            dataSpanDays: hasEnoughData.spanDays,
          });
          return;
        }

        const lastExportTime = new Date(lastExportTimeStr);
        const now = new Date();
        const timeDiff = now.getTime() - lastExportTime.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

        setReminderState({
          shouldRemind: daysDiff >= 2,
          daysSinceLastExport: daysDiff,
          lastExportDate: lastExportTime,
          hasEnoughData: true,
          dataSpanDays: hasEnoughData.spanDays,
        });
      } catch (error) {
        console.error("Error checking export reminder:", error);
        setReminderState({
          shouldRemind: false,
          daysSinceLastExport: 0,
          lastExportDate: null,
          hasEnoughData: false,
          dataSpanDays: 0,
        });
      }
    };

    // 检查IndexedDB中的healthLogs数据
    const checkIndexedDBData = async (): Promise<{
      hasData: boolean;
      spanDays: number;
    }> => {
      try {
        // 直接访问IndexedDB检查healthLogs数据
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = window.indexedDB.open("healthApp", 2);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        if (!db.objectStoreNames.contains("healthLogs")) {
          db.close();
          return { hasData: false, spanDays: 0 };
        }

        const transaction = db.transaction(["healthLogs"], "readonly");
        const store = transaction.objectStore("healthLogs");

        const allData = await new Promise<any[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        });

        db.close();

        if (!allData || allData.length === 0) {
          return { hasData: false, spanDays: 0 };
        }

        // 获取所有有数据的日期
        const dates = allData
          .filter((log: any) => {
            return (
              log &&
              ((log.foodEntries && log.foodEntries.length > 0) ||
                (log.exerciseEntries && log.exerciseEntries.length > 0) ||
                log.weight !== undefined)
            );
          })
          .map((log: any) => new Date(log.date))
          .sort((a: Date, b: Date) => a.getTime() - b.getTime());

        if (dates.length === 0) {
          return { hasData: false, spanDays: 0 };
        }

        // 计算最早和最晚日期的差值
        const earliestDate = dates[0];
        const latestDate = dates[dates.length - 1];
        const timeDiff = latestDate.getTime() - earliestDate.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

        // 需要至少2天的数据跨度
        return {
          hasData: daysDiff >= 1, // 至少跨越2天（差值>=1）
          spanDays: daysDiff + 1, // 实际天数
        };
      } catch (error) {
        console.error("检查IndexedDB数据失败:", error);
        return { hasData: false, spanDays: 0 };
      }
    };

    checkExportReminder();

    // 每小时检查一次
    const interval = setInterval(checkExportReminder, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [authLoading, isAuthenticated]);

  return reminderState;
}
