import type { DailyLog, DailySummaryType, FoodEntry, ExerciseEntry } from "./types";

/**
 * 动态计算每日汇总数据
 * @param foodEntries 食物条目数组
 * @param exerciseEntries 运动条目数组
 * @returns 计算后的汇总数据
 */
export function calculateDailySummary(
  foodEntries: FoodEntry[],
  exerciseEntries: ExerciseEntry[]
): DailySummaryType {
  let totalCaloriesConsumed = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCaloriesBurned = 0;
  const micronutrients: Record<string, number> = {};

  // 计算食物摄入的营养数据
  foodEntries.forEach((entry) => {
    if (entry.total_nutritional_info_consumed) {
      totalCaloriesConsumed +=
        entry.total_nutritional_info_consumed.calories || 0;
      totalCarbs += entry.total_nutritional_info_consumed.carbohydrates || 0;
      totalProtein += entry.total_nutritional_info_consumed.protein || 0;
      totalFat += entry.total_nutritional_info_consumed.fat || 0;
      
      // 计算微量营养素
      Object.entries(entry.total_nutritional_info_consumed).forEach(
        ([key, value]) => {
          if (
            !["calories", "carbohydrates", "protein", "fat"].includes(key) &&
            typeof value === "number"
          ) {
            micronutrients[key] = (micronutrients[key] || 0) + value;
          }
        }
      );
    }
  });

  // 计算运动消耗的热量
  exerciseEntries.forEach((entry) => {
    totalCaloriesBurned += entry.calories_burned_estimated || 0;
  });

  return {
    totalCaloriesConsumed,
    totalCaloriesBurned,
    macros: { carbs: totalCarbs, protein: totalProtein, fat: totalFat },
    micronutrients,
  };
}

/**
 * 为DailyLog对象添加动态计算的summary
 * @param log 日志对象（不包含summary或包含过期的summary）
 * @returns 包含最新计算summary的日志对象
 */
export function withCalculatedSummary(log: Omit<DailyLog, 'summary'> & { summary?: DailySummaryType }): DailyLog {
  const summary = calculateDailySummary(log.foodEntries || [], log.exerciseEntries || []);
  
  return {
    ...log,
    summary,
  };
}

/**
 * 批量为多个DailyLog对象添加动态计算的summary
 * @param logs 日志对象数组
 * @returns 包含最新计算summary的日志对象数组
 */
export function withCalculatedSummaries(logs: (Omit<DailyLog, 'summary'> & { summary?: DailySummaryType })[]): DailyLog[] {
  return logs.map(log => withCalculatedSummary(log));
}
