"use client";

import { useState, useCallback } from "react";
import { useAuth } from "./use-auth";

interface ServerStorageHook {
  getData: (endpoint: string, params?: Record<string, string>) => Promise<any>;
  saveData: (endpoint: string, data: any) => Promise<any>;
  updateData: (endpoint: string, data: any) => Promise<any>;
  deleteData: (
    endpoint: string,
    params?: Record<string, string>
  ) => Promise<any>;
  isLoading: boolean;
  error: Error | null;
}

export function useServerStorage(): ServerStorageHook {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { token, isLoading: authLoading } = useAuth();

  const makeRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      if (!token) {
        throw new Error("未登录");
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(endpoint, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `请求失败: ${response.status}`);
        }

        return await response.json();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("请求失败");
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  // 获取数据
  const getData = useCallback(
    async (endpoint: string, params?: Record<string, string>) => {
      const url = new URL(endpoint, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      return makeRequest(url.toString(), {
        method: "GET",
      });
    },
    [makeRequest]
  );

  // 保存数据 (POST)
  const saveData = useCallback(
    async (endpoint: string, data: any) => {
      return makeRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    [makeRequest]
  );

  // 更新数据 (PUT)
  const updateData = useCallback(
    async (endpoint: string, data: any) => {
      return makeRequest(endpoint, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    [makeRequest]
  );

  // 删除数据
  const deleteData = useCallback(
    async (endpoint: string, params?: Record<string, string>) => {
      const url = new URL(endpoint, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      return makeRequest(url.toString(), {
        method: "DELETE",
      });
    },
    [makeRequest]
  );

  return {
    getData,
    saveData,
    updateData,
    deleteData,
    isLoading,
    error,
  };
}
