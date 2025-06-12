"use client"

import { useState, useEffect, useCallback } from "react"
import { DB_NAME, DB_VERSION } from '@/lib/db-config';

interface IndexedDBHook {
  getData: (key: string) => Promise<any>
  saveData: (key: string, data: any) => Promise<void>
  deleteData: (key: string) => Promise<void>
  clearAllData: () => Promise<void>
  isLoading: boolean
  isInitializing: boolean
  error: Error | null
  getAllData: () => Promise<any[]>
  batchSave: (items: any[]) => Promise<void>
  waitForInitialization: () => Promise<void>
}

// 创建一个全局变量来跟踪数据库初始化状态
const dbInitializationPromises: Record<string, Promise<IDBDatabase>> = {};

// 跟踪已经打开的数据库实例，用于页面关闭时统一释放
const openDatabases: Set<IDBDatabase> = new Set();

// 仅注册一次 beforeunload 事件
if (typeof window !== 'undefined' && !(window as any).__indexedDBCleanupRegistered) {
  window.addEventListener('beforeunload', () => {
    openDatabases.forEach(db => {
      try {
        db.close();
      } catch (e) {
        // 忽略关闭错误
      }
    });
  });
  (window as any).__indexedDBCleanupRegistered = true;
}

export function useIndexedDB(storeName: string): IndexedDBHook {
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [db, setDb] = useState<IDBDatabase | null>(null)

  // 初始化数据库
  useEffect(() => {
    // 如果该存储的初始化Promise已经存在，则复用它
    if (!dbInitializationPromises[storeName]) {
      dbInitializationPromises[storeName] = new Promise((resolve, reject) => {
        try {
          if (!window.indexedDB) {
            console.warn("IndexedDB not supported")
            reject(new Error("IndexedDB not supported"));
            return;
          }

          console.log(`Opening IndexedDB ${DB_NAME} version ${DB_VERSION} for store ${storeName}...`);
          const request = window.indexedDB.open(DB_NAME, DB_VERSION)

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result

            // 确保所有必需的对象存储都被创建
            const storeNames = ["healthLogs", "aiMemories"];

            storeNames.forEach(name => {
              if (!db.objectStoreNames.contains(name)) {
                console.log(`Creating object store: ${name}`);
                db.createObjectStore(name);
              }
            });
          }

          request.onsuccess = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // 验证所需的存储对象是否存在
            if (!database.objectStoreNames.contains(storeName)) {
              console.error(`Required object store '${storeName}' not found in database`);

              // 关闭当前数据库连接
              database.close();

              // 尝试删除并重新创建数据库
              console.log("Attempting to delete and recreate database...");
              const deleteRequest = window.indexedDB.deleteDatabase(DB_NAME);

              deleteRequest.onsuccess = () => {
                console.log("Database deleted successfully, reopening...");
                // 重新打开数据库，这将触发 onupgradeneeded
                const reopenRequest = window.indexedDB.open(DB_NAME, DB_VERSION);

                reopenRequest.onupgradeneeded = (event) => {
                  const newDb = (event.target as IDBOpenDBRequest).result;
                  // 创建所有必需的对象存储
                  ["healthLogs", "aiMemories"].forEach(name => {
                    if (!newDb.objectStoreNames.contains(name)) {
                      newDb.createObjectStore(name);
                    }
                  });
                };

                reopenRequest.onsuccess = (event) => {
                  const newDatabase = (event.target as IDBOpenDBRequest).result;
                  setDb(newDatabase);
                  openDatabases.add(newDatabase);
                  setIsInitializing(false);
                  console.log("Database successfully recreated with all required stores");
                  resolve(newDatabase);
                };

                reopenRequest.onerror = (event) => {
                  const errorMsg = "无法重新创建数据库";
                  setError(new Error(errorMsg));
                  setIsInitializing(false);
                  console.error("IndexedDB reopen error:", (event.target as IDBOpenDBRequest).error);
                  reject(new Error(errorMsg));
                };
              };

              deleteRequest.onerror = (event) => {
                const errorMsg = "无法删除损坏的数据库";
                setError(new Error(errorMsg));
                setIsInitializing(false);
                console.error("IndexedDB delete error:", (event.target as IDBOpenDBRequest).error);
                reject(new Error(errorMsg));
              };
            } else {
              // 正常情况，存储对象存在
              setDb(database);
              openDatabases.add(database);
              setIsInitializing(false);
              console.log(`Database opened successfully for store: ${storeName}`);
              resolve(database);
            }
          }

          request.onerror = (event) => {
            const errorMsg = "无法打开数据库";
            setError(new Error(errorMsg));
            setIsInitializing(false);
            console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
            reject(new Error(errorMsg));
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err : new Error("初始化数据库时发生未知错误");
          setError(errorMsg);
          setIsInitializing(false);
          reject(errorMsg);
        }
      });
    }

    // 使用已存在的Promise
    dbInitializationPromises[storeName]
      .then((database) => {
        setDb(database);
        openDatabases.add(database);
        setIsInitializing(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsInitializing(false);
      });

    return () => { /* keep db open */ }
  }, [storeName])

  // 等待初始化完成的函数
  const waitForInitialization = useCallback(async (): Promise<void> => {
    if (!isInitializing && db) return Promise.resolve();

    try {
      await dbInitializationPromises[storeName];
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }, [isInitializing, db, storeName]);

  // 获取数据
  const getData = useCallback(
    async (key: string): Promise<any> => {
      await waitForInitialization();
      let database = db;
      if (!database) {
        // 如果状态更新尚未生效，直接从初始化结果中获取
        try {
          database = await dbInitializationPromises[storeName];
          setDb(database);
        } catch {
          /* ignore */
        }
      }
      if (!database) return null;

      setIsLoading(true);
      setError(null);

      try {
        return new Promise((resolve, reject) => {
          const transaction = database!.transaction([storeName], "readonly");
          const store = transaction.objectStore(storeName);
          const request = store.get(key);

          request.onsuccess = () => {
            setIsLoading(false);
            resolve(request.result);
          };

          request.onerror = () => {
            setIsLoading(false);
            setError(new Error("获取数据失败"));
            reject(new Error("获取数据失败"));
          };
        });
      } catch (err) {
        setIsLoading(false);
        setError(err instanceof Error ? err : new Error("获取数据时发生未知错误"));
        throw err;
      }
    },
    [db, storeName, waitForInitialization]
  );

  // 保存数据
  const saveData = useCallback(
    async (key: string, data: any): Promise<void> => {
      await waitForInitialization();
      let database = db;
      if (!database) {
        try {
          database = await dbInitializationPromises[storeName];
          setDb(database);
        } catch {
          // 无法获取数据库实例
        }
      }
      if (!database) {
        console.warn(`[IndexedDB] Database not ready for store: ${storeName}, skipping save for key: ${key}`);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        return new Promise((resolve, reject) => {
          const transaction = database!.transaction([storeName], "readwrite");
          const store = transaction.objectStore(storeName);
          const request = store.put(data, key);

          request.onsuccess = () => {
            setIsLoading(false);
            resolve();
          };

          request.onerror = () => {
            setIsLoading(false);
            setError(new Error("保存数据失败"));
            reject(new Error("保存数据失败"));
          };
        });
      } catch (err) {
        setIsLoading(false);
        setError(err instanceof Error ? err : new Error("保存数据时发生未知错误"));
        throw err;
      }
    },
    [db, storeName, waitForInitialization]
  );

  // 删除数据
  const deleteData = useCallback(
    async (key: string): Promise<void> => {
      await waitForInitialization();
      if (!db) return;

      setIsLoading(true);
      setError(null);

      try {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([storeName], "readwrite");
          const store = transaction.objectStore(storeName);
          const request = store.delete(key);

          request.onsuccess = () => {
            setIsLoading(false);
            resolve();
          };

          request.onerror = () => {
            setIsLoading(false);
            setError(new Error("删除数据失败"));
            reject(new Error("删除数据失败"));
          };
        });
      } catch (err) {
        setIsLoading(false);
        setError(err instanceof Error ? err : new Error("删除数据时发生未知错误"));
        throw err;
      }
    },
    [db, storeName, waitForInitialization]
  );

  // 清空所有数据
  const clearAllData = useCallback(async (): Promise<void> => {
    await waitForInitialization();
    if (!db) return;

    setIsLoading(true);
    setError(null);

    try {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          setIsLoading(false);
          resolve();
        };

        request.onerror = () => {
          setIsLoading(false);
          setError(new Error("清空数据失败"));
          reject(new Error("清空数据失败"));
        };
      });
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err : new Error("清空数据时发生未知错误"));
      throw err;
    }
  }, [db, storeName, waitForInitialization]);

  const getAllData = useCallback(async (): Promise<any[]> => {
    await waitForInitialization();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        setIsLoading(false);
        resolve(request.result);
      };

      request.onerror = () => {
        setIsLoading(false);
        setError(new Error("获取所有数据失败"));
        reject(new Error("获取所有数据失败"));
      };
    });
  }, [db, storeName, waitForInitialization]);

  const batchSave = useCallback(async (items: any[]): Promise<void> => {
    await waitForInitialization();
    let database = db;
    if (!database) {
      // 与 getData/saveData 保持一致的兜底获取方式，防止 state 未及时更新导致 database 为空
      try {
        database = await dbInitializationPromises[storeName];
        setDb(database);
      } catch {
        /* 无法获取数据库实例 */
      }
    }
    if (!database) {
      console.error("[BatchSave] Database not initialized");
      return;
    }
    if (items.length === 0) {
      console.log("[BatchSave] No items to save");
      return Promise.resolve();
    }

    console.log(`[BatchSave] Starting batch save of ${items.length} items to store: ${storeName}`);
    console.log(`[BatchSave] Items to save:`, items.map(item => ({ date: item.date, foodCount: item.foodEntries?.length || 0, exerciseCount: item.exerciseEntries?.length || 0 }))); // 保持现有日志

    return new Promise((resolve, reject) => {
      const transaction = database!.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      let completed = 0;
      const total = items.length;

      items.forEach(item => {
        // 确保使用 date 作为 key
        if (!item.date) {
          console.error("Batch save error: item is missing 'date' property.", item);
          // 跳过这个没有date的坏数据
          completed++;
          if (completed === total) {
            transaction.commit ? transaction.commit() : resolve();
          }
          return;
        }
        const request = store.put(item, item.date);
        request.onsuccess = () => {
          completed++;
          console.log(`[BatchSave] Successfully saved item ${completed}/${total} for date: ${item.date}`);
          if (completed === total) {
            console.log(`[BatchSave] All ${total} items saved successfully`);
            // 所有操作都成功，但不在这里resolve，让transaction.oncomplete处理
          }
        };
        request.onerror = (event) => {
          // 一个请求失败并不需要让整个事务失败
          console.error("Batch save error on item:", item, (event.target as IDBRequest).error);
          completed++; // 🔧 修复：即使失败也要增加计数，避免死锁
          if (completed === total) {
            console.log(`[BatchSave] All ${total} items processed (some may have failed)`);
          }
        };
      });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = (event) => {
        setError(new Error("批量保存数据时发生事务错误"));
        reject(new Error(`批量保存事务失败: ${(event.target as IDBTransaction).error}`));
      };
    });
  }, [db, storeName, waitForInitialization]);

  return {
    getData,
    saveData,
    deleteData,
    clearAllData,
    isLoading,
    isInitializing,
    error,
    getAllData,
    batchSave,
    waitForInitialization
  };
}
