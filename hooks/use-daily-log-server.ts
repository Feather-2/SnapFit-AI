"use client"

import { useState, useEffect, useCallback } from "react"
import { useServerStorage } from "./use-server-storage"
import type { DailyLog } from "@/lib/types"

interface DailyLogServerHook {
  getDailyLog: (date: string) => Promise<DailyLog | null>
  saveDailyLog: (date: string, data: Partial<DailyLog>) => Promise<DailyLog>
  deleteDailyLog: (date: string) => Promise<void>
  getAllDailyLogs: () => Promise<DailyLog[]>
  isLoading: boolean
  error: Error | null
}

export function useDailyLogServer(): DailyLogServerHook {
  const { getData, saveData, deleteData, isLoading, error } = useServerStorage()

  // 获取特定日期的日志
  const getDailyLog = useCallback(
    async (date: string): Promise<DailyLog | null> => {
      try {
        const response = await getData('/api/db/daily-log', { date })
        if (response.dailyLog) {
          // 解析 JSON 字段
          const log = response.dailyLog
          return {
            ...log,
            tefAnalysis: log.tefAnalysis ? JSON.parse(log.tefAnalysis) : undefined,
            dailyStatus: log.dailyStatus ? JSON.parse(log.dailyStatus) : undefined,
            foodEntries: log.foodEntries?.map((entry: any) => ({
              ...entry,
              log_id: entry.id,
              food_name: entry.foodName,
              consumed_grams: entry.consumedGrams,
              meal_type: entry.mealType,
              time_period: entry.timePeriod,
              nutritional_info_per_100g: JSON.parse(entry.nutritionalInfoPer100g),
              total_nutritional_info_consumed: JSON.parse(entry.totalNutritionalInfoConsumed),
              is_estimated: entry.isEstimated,
            })) || [],
            exerciseEntries: log.exerciseEntries?.map((entry: any) => ({
              ...entry,
              log_id: entry.id,
              exercise_name: entry.exerciseName,
              exercise_type: entry.exerciseType,
              duration_minutes: entry.durationMinutes,
              distance_km: entry.distanceKm,
              weight_kg: entry.weightKg,
              estimated_mets: entry.estimatedMets,
              user_weight: entry.userWeight,
              calories_burned_estimated: entry.caloriesBurnedEstimated,
              muscle_groups: entry.muscleGroups ? JSON.parse(entry.muscleGroups) : undefined,
              is_estimated: entry.isEstimated,
            })) || [],
          }
        }
        return null
      } catch (err) {
        console.error('Get daily log error:', err)
        throw err
      }
    },
    [getData]
  )

  // 保存日志
  const saveDailyLog = useCallback(
    async (date: string, data: Partial<DailyLog>): Promise<DailyLog> => {
      try {
        const response = await saveData('/api/db/daily-log', {
          date,
          ...data,
        })
        return response.dailyLog
      } catch (err) {
        console.error('Save daily log error:', err)
        throw err
      }
    },
    [saveData]
  )

  // 删除日志
  const deleteDailyLog = useCallback(
    async (date: string): Promise<void> => {
      try {
        await deleteData('/api/db/daily-log', { date })
      } catch (err) {
        console.error('Delete daily log error:', err)
        throw err
      }
    },
    [deleteData]
  )

  // 获取所有日志
  const getAllDailyLogs = useCallback(
    async (): Promise<DailyLog[]> => {
      try {
        const response = await getData('/api/db/daily-log')
        return response.dailyLogs?.map((log: any) => ({
          ...log,
          tefAnalysis: log.tefAnalysis ? JSON.parse(log.tefAnalysis) : undefined,
          dailyStatus: log.dailyStatus ? JSON.parse(log.dailyStatus) : undefined,
          foodEntries: log.foodEntries?.map((entry: any) => ({
            ...entry,
            log_id: entry.id,
            food_name: entry.foodName,
            consumed_grams: entry.consumedGrams,
            meal_type: entry.mealType,
            time_period: entry.timePeriod,
            nutritional_info_per_100g: JSON.parse(entry.nutritionalInfoPer100g),
            total_nutritional_info_consumed: JSON.parse(entry.totalNutritionalInfoConsumed),
            is_estimated: entry.isEstimated,
          })) || [],
          exerciseEntries: log.exerciseEntries?.map((entry: any) => ({
            ...entry,
            log_id: entry.id,
            exercise_name: entry.exerciseName,
            exercise_type: entry.exerciseType,
            duration_minutes: entry.durationMinutes,
            distance_km: entry.distanceKm,
            weight_kg: entry.weightKg,
            estimated_mets: entry.estimatedMets,
            user_weight: entry.userWeight,
            calories_burned_estimated: entry.caloriesBurnedEstimated,
            muscle_groups: entry.muscleGroups ? JSON.parse(entry.muscleGroups) : undefined,
            is_estimated: entry.isEstimated,
          })) || [],
        })) || []
      } catch (err) {
        console.error('Get all daily logs error:', err)
        throw err
      }
    },
    [getData]
  )

  return {
    getDailyLog,
    saveDailyLog,
    deleteDailyLog,
    getAllDailyLogs,
    isLoading,
    error,
  }
}
