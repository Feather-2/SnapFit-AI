"use client";

import { useCallback } from "react";
import { useServerStorage } from "./use-server-storage";
import type { FoodEntry } from "@/lib/types";

interface FoodEntriesHook {
  saveFoodEntries: (logId: string, entries: FoodEntry[]) => Promise<void>;
  getFoodEntries: (logId: string) => Promise<FoodEntry[]>;
  updateFoodEntry: (id: string, entry: Partial<FoodEntry>) => Promise<void>;
  deleteFoodEntry: (id: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useFoodEntries(): FoodEntriesHook {
  const { saveData, getData, updateData, deleteData, isLoading, error } =
    useServerStorage();

  // 批量保存食物条目
  const saveFoodEntries = useCallback(
    async (logId: string, entries: FoodEntry[]) => {
      try {
        // 转换数据格式以匹配 API 期望的格式
        const apiEntries = entries.map((entry) => ({
          logId,
          foodName: entry.food_name,
          consumedGrams: Number(entry.consumed_grams),
          mealType: entry.meal_type,
          timePeriod: entry.time_period || null,
          nutritionalInfoPer100g: entry.nutritional_info_per_100g,
          totalNutritionalInfoConsumed: entry.total_nutritional_info_consumed,
          isEstimated: Boolean(entry.is_estimated),
          timestamp: entry.timestamp || null,
        }));

        await updateData("/api/db/food-entry", { entries: apiEntries });
      } catch (err) {
        console.error("Save food entries error:", err);
        throw err;
      }
    },
    [updateData]
  );

  // 获取食物条目
  const getFoodEntries = useCallback(
    async (logId: string): Promise<FoodEntry[]> => {
      try {
        const response = await getData("/api/db/food-entry", { logId });
        return (
          response.foodEntries?.map((entry: any) => ({
            log_id: entry.id,
            food_name: entry.foodName,
            consumed_grams: entry.consumedGrams,
            meal_type: entry.mealType,
            time_period: entry.timePeriod,
            nutritional_info_per_100g: JSON.parse(entry.nutritionalInfoPer100g),
            total_nutritional_info_consumed: JSON.parse(
              entry.totalNutritionalInfoConsumed
            ),
            is_estimated: entry.isEstimated,
            timestamp: entry.timestamp,
          })) || []
        );
      } catch (err) {
        console.error("Get food entries error:", err);
        throw err;
      }
    },
    [getData]
  );

  // 更新单个食物条目
  const updateFoodEntry = useCallback(
    async (id: string, entry: Partial<FoodEntry>) => {
      try {
        const apiData = {
          foodName: entry.food_name,
          consumedGrams: entry.consumed_grams,
          mealType: entry.meal_type,
          timePeriod: entry.time_period,
          nutritionalInfoPer100g: entry.nutritional_info_per_100g,
          totalNutritionalInfoConsumed: entry.total_nutritional_info_consumed,
          isEstimated: entry.is_estimated,
          timestamp: entry.timestamp,
        };

        await updateData(`/api/db/food-entry/${id}`, apiData);
      } catch (err) {
        console.error("Update food entry error:", err);
        throw err;
      }
    },
    [updateData]
  );

  // 删除食物条目
  const deleteFoodEntry = useCallback(
    async (id: string) => {
      try {
        await deleteData(`/api/db/food-entry/${id}`);
      } catch (err) {
        console.error("Delete food entry error:", err);
        throw err;
      }
    },
    [deleteData]
  );

  return {
    saveFoodEntries,
    getFoodEntries,
    updateFoodEntry,
    deleteFoodEntry,
    isLoading,
    error,
  };
}
