"use client";

import { useCallback } from "react";
import { useServerStorage } from "./use-server-storage";
import type { ExerciseEntry } from "@/lib/types";

interface ExerciseEntriesHook {
  saveExerciseEntries: (
    logId: string,
    entries: ExerciseEntry[]
  ) => Promise<void>;
  getExerciseEntries: (logId: string) => Promise<ExerciseEntry[]>;
  updateExerciseEntry: (
    id: string,
    entry: Partial<ExerciseEntry>
  ) => Promise<void>;
  deleteExerciseEntry: (id: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useExerciseEntries(): ExerciseEntriesHook {
  const { saveData, getData, updateData, deleteData, isLoading, error } =
    useServerStorage();

  // 批量保存运动条目（逐个调用POST接口）
  const saveExerciseEntries = useCallback(
    async (logId: string, entries: ExerciseEntry[]) => {
      try {
        // 为每个条目单独调用POST接口
        const promises = entries.map(async (entry) => {
          const apiEntry = {
            logId,
            exerciseName: entry.exercise_name,
            exerciseType: entry.exercise_type,
            durationMinutes: Number(entry.duration_minutes),
            distanceKm: entry.distance_km || null,
            sets: entry.sets || null,
            reps: entry.reps || null,
            weightKg: entry.weight_kg || null,
            estimatedMets: Number(entry.estimated_mets),
            userWeight: Number(entry.user_weight),
            caloriesBurnedEstimated: Number(entry.calories_burned_estimated),
            muscleGroups: entry.muscle_groups || null,
            isEstimated: Boolean(entry.is_estimated),
            timestamp: entry.timestamp || null,
          };

          return await saveData("/api/db/exercise-entry", apiEntry);
        });

        await Promise.all(promises);
      } catch (err) {
        console.error("Save exercise entries error:", err);
        throw err;
      }
    },
    [saveData]
  );

  // 获取运动条目
  const getExerciseEntries = useCallback(
    async (logId: string): Promise<ExerciseEntry[]> => {
      try {
        const response = await getData("/api/db/exercise-entry", { logId });
        return (
          response.exerciseEntries?.map((entry: any) => ({
            log_id: entry.id,
            exercise_name: entry.exerciseName,
            exercise_type: entry.exerciseType,
            duration_minutes: entry.durationMinutes,
            distance_km: entry.distanceKm,
            sets: entry.sets,
            reps: entry.reps,
            weight_kg: entry.weightKg,
            estimated_mets: entry.estimatedMets,
            user_weight: entry.userWeight,
            calories_burned_estimated: entry.caloriesBurnedEstimated,
            muscle_groups: entry.muscleGroups
              ? JSON.parse(entry.muscleGroups)
              : null,
            is_estimated: entry.isEstimated,
            timestamp: entry.timestamp,
          })) || []
        );
      } catch (err) {
        console.error("Get exercise entries error:", err);
        throw err;
      }
    },
    [getData]
  );

  // 更新运动条目
  const updateExerciseEntry = useCallback(
    async (id: string, entry: Partial<ExerciseEntry>) => {
      try {
        // 转换数据格式
        const apiEntry = {
          exerciseName: entry.exercise_name,
          exerciseType: entry.exercise_type,
          durationMinutes: entry.duration_minutes
            ? Number(entry.duration_minutes)
            : undefined,
          distanceKm: entry.distance_km || null,
          sets: entry.sets || null,
          reps: entry.reps || null,
          weightKg: entry.weight_kg || null,
          estimatedMets: entry.estimated_mets
            ? Number(entry.estimated_mets)
            : undefined,
          userWeight: entry.user_weight ? Number(entry.user_weight) : undefined,
          caloriesBurnedEstimated: entry.calories_burned_estimated
            ? Number(entry.calories_burned_estimated)
            : undefined,
          muscleGroups: entry.muscle_groups || null,
          isEstimated:
            entry.is_estimated !== undefined
              ? Boolean(entry.is_estimated)
              : undefined,
          timestamp: entry.timestamp || null,
        };

        await updateData(`/api/db/exercise-entry/${id}`, apiEntry);
      } catch (err) {
        console.error("Update exercise entry error:", err);
        throw err;
      }
    },
    [updateData]
  );

  // 删除运动条目
  const deleteExerciseEntry = useCallback(
    async (id: string) => {
      try {
        await deleteData(`/api/db/exercise-entry/${id}`);
      } catch (err) {
        console.error("Delete exercise entry error:", err);
        throw err;
      }
    },
    [deleteData]
  );

  return {
    saveExerciseEntries,
    getExerciseEntries,
    updateExerciseEntry,
    deleteExerciseEntry,
    isLoading,
    error,
  };
}
