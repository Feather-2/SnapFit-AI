import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

// 导入用户数据
export const POST = withAuth(async (request) => {
  try {
    const userId = request.userId!;
    const importData = await request.json();

    // 验证导入数据格式
    if (!importData.exportInfo || !importData.exportInfo.version) {
      return NextResponse.json(
        { error: "无效的导入数据格式" },
        { status: 400 }
      );
    }

    const results = {
      userProfile: null,
      dailyLogs: 0,
      foodEntries: 0,
      exerciseEntries: 0,
      aiMemories: 0,
      aiConfig: null,
    };

    // 使用事务确保数据一致性
    await prisma.$transaction(async (tx) => {
      // 导入用户配置
      if (importData.userProfile) {
        const profile = importData.userProfile;
        results.userProfile = await tx.userProfile.upsert({
          where: { userId },
          update: {
            weight: profile.weight,
            height: profile.height,
            age: profile.age,
            gender: profile.gender,
            activityLevel: profile.activityLevel,
            goal: profile.goal,
            targetWeight: profile.targetWeight,
            targetCalories: profile.targetCalories,
            notes: profile.notes,
            bmrFormula: profile.bmrFormula,
            bmrCalculationBasis: profile.bmrCalculationBasis,
            bodyFatPercentage: profile.bodyFatPercentage,
            professionalMode: profile.professionalMode,
            medicalHistory: profile.medicalHistory,
            lifestyle: profile.lifestyle,
            healthAwareness: profile.healthAwareness,
          },
          create: {
            userId,
            weight: profile.weight,
            height: profile.height,
            age: profile.age,
            gender: profile.gender,
            activityLevel: profile.activityLevel,
            goal: profile.goal,
            targetWeight: profile.targetWeight,
            targetCalories: profile.targetCalories,
            notes: profile.notes,
            bmrFormula: profile.bmrFormula,
            bmrCalculationBasis: profile.bmrCalculationBasis,
            bodyFatPercentage: profile.bodyFatPercentage,
            professionalMode: profile.professionalMode,
            medicalHistory: profile.medicalHistory,
            lifestyle: profile.lifestyle,
            healthAwareness: profile.healthAwareness,
          },
        });
      }

      // 导入每日日志
      if (importData.dailyLogs && Array.isArray(importData.dailyLogs)) {
        for (const logData of importData.dailyLogs) {
          // 创建或更新每日日志
          const dailyLog = await tx.dailyLog.upsert({
            where: {
              userId_date: {
                userId,
                date: logData.date,
              },
            },
            update: {
              weight: logData.weight,
              activityLevel: logData.activityLevel,
              calculatedBMR: logData.calculatedBMR,
              calculatedTDEE: logData.calculatedTDEE,
              tefAnalysis: logData.tefAnalysis
                ? JSON.stringify(logData.tefAnalysis)
                : null,
              dailyStatus: logData.dailyStatus
                ? JSON.stringify(logData.dailyStatus)
                : null,
            },
            create: {
              userId,
              date: logData.date,
              weight: logData.weight,
              activityLevel: logData.activityLevel,
              calculatedBMR: logData.calculatedBMR,
              calculatedTDEE: logData.calculatedTDEE,
              tefAnalysis: logData.tefAnalysis
                ? JSON.stringify(logData.tefAnalysis)
                : null,
              dailyStatus: logData.dailyStatus
                ? JSON.stringify(logData.dailyStatus)
                : null,
            },
          });

          results.dailyLogs++;

          // 删除现有的食物记录
          await tx.foodEntry.deleteMany({
            where: { logId: dailyLog.id },
          });

          // 导入食物记录
          if (logData.foodEntries && Array.isArray(logData.foodEntries)) {
            for (const foodEntry of logData.foodEntries) {
              await tx.foodEntry.create({
                data: {
                  logId: dailyLog.id,
                  userId,
                  foodName: foodEntry.foodName,
                  consumedGrams: foodEntry.consumedGrams,
                  mealType: foodEntry.mealType,
                  timePeriod: foodEntry.timePeriod,
                  nutritionalInfoPer100g: JSON.stringify(
                    foodEntry.nutritionalInfoPer100g
                  ),
                  totalNutritionalInfoConsumed: JSON.stringify(
                    foodEntry.totalNutritionalInfoConsumed
                  ),
                  isEstimated: foodEntry.isEstimated,
                  timestamp: foodEntry.timestamp,
                },
              });
              results.foodEntries++;
            }
          }

          // 删除现有的运动记录
          await tx.exerciseEntry.deleteMany({
            where: { logId: dailyLog.id },
          });

          // 导入运动记录
          if (
            logData.exerciseEntries &&
            Array.isArray(logData.exerciseEntries)
          ) {
            for (const exerciseEntry of logData.exerciseEntries) {
              await tx.exerciseEntry.create({
                data: {
                  logId: dailyLog.id,
                  userId,
                  exerciseName: exerciseEntry.exerciseName,
                  exerciseType: exerciseEntry.exerciseType,
                  durationMinutes: exerciseEntry.durationMinutes,
                  distanceKm: exerciseEntry.distanceKm,
                  sets: exerciseEntry.sets,
                  reps: exerciseEntry.reps,
                  weightKg: exerciseEntry.weightKg,
                  estimatedMets: exerciseEntry.estimatedMets,
                  userWeight: exerciseEntry.userWeight,
                  caloriesBurnedEstimated:
                    exerciseEntry.caloriesBurnedEstimated,
                  muscleGroups: exerciseEntry.muscleGroups
                    ? JSON.stringify(exerciseEntry.muscleGroups)
                    : null,
                  isEstimated: exerciseEntry.isEstimated,
                  timestamp: exerciseEntry.timestamp,
                },
              });
              results.exerciseEntries++;
            }
          }
        }
      }

      // 导入 AI 记忆
      if (importData.aiMemories && Array.isArray(importData.aiMemories)) {
        for (const memoryData of importData.aiMemories) {
          await tx.aIMemory.upsert({
            where: {
              userId_expertId: {
                userId,
                expertId: memoryData.expertId,
              },
            },
            update: {
              conversationCount: memoryData.conversationCount,
              lastUpdated: new Date(memoryData.lastUpdated),
              keyInsights: memoryData.keyInsights
                ? JSON.stringify(memoryData.keyInsights)
                : null,
              userPreferences: memoryData.userPreferences
                ? JSON.stringify(memoryData.userPreferences)
                : null,
              healthPatterns: memoryData.healthPatterns
                ? JSON.stringify(memoryData.healthPatterns)
                : null,
              goals: memoryData.goals ? JSON.stringify(memoryData.goals) : null,
              concerns: memoryData.concerns
                ? JSON.stringify(memoryData.concerns)
                : null,
            },
            create: {
              userId,
              expertId: memoryData.expertId,
              conversationCount: memoryData.conversationCount,
              lastUpdated: new Date(memoryData.lastUpdated),
              keyInsights: memoryData.keyInsights
                ? JSON.stringify(memoryData.keyInsights)
                : null,
              userPreferences: memoryData.userPreferences
                ? JSON.stringify(memoryData.userPreferences)
                : null,
              healthPatterns: memoryData.healthPatterns
                ? JSON.stringify(memoryData.healthPatterns)
                : null,
              goals: memoryData.goals ? JSON.stringify(memoryData.goals) : null,
              concerns: memoryData.concerns
                ? JSON.stringify(memoryData.concerns)
                : null,
            },
          });
          results.aiMemories++;
        }
      }

      // 导入 AI 配置
      if (importData.aiConfig) {
        const configData = importData.aiConfig;
        results.aiConfig = await tx.aIConfig.upsert({
          where: { userId },
          update: {
            agentModel: configData.agentModel
              ? JSON.stringify(configData.agentModel)
              : null,
            chatModel: configData.chatModel
              ? JSON.stringify(configData.chatModel)
              : null,
            visionModel: configData.visionModel
              ? JSON.stringify(configData.visionModel)
              : null,
          },
          create: {
            userId,
            agentModel: configData.agentModel
              ? JSON.stringify(configData.agentModel)
              : null,
            chatModel: configData.chatModel
              ? JSON.stringify(configData.chatModel)
              : null,
            visionModel: configData.visionModel
              ? JSON.stringify(configData.visionModel)
              : null,
          },
        });
      }
    });

    return NextResponse.json({
      message: "数据导入成功",
      results,
    });
  } catch (error) {
    console.error("Import data error:", error);
    return NextResponse.json({ error: "导入数据失败" }, { status: 500 });
  }
});
