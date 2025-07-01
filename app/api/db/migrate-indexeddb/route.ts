import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// 从 IndexedDB 数据迁移到服务端
export const POST = withAuth(async (request) => {
  try {
    const userId = request.userId!
    const { indexedDBData } = await request.json()

    if (!indexedDBData) {
      return NextResponse.json(
        { error: '没有提供 IndexedDB 数据' },
        { status: 400 }
      )
    }

    const results = {
      userProfile: null,
      dailyLogs: 0,
      foodEntries: 0,
      exerciseEntries: 0,
      aiMemories: 0,
      aiConfig: null
    }

    // 使用事务确保数据一致性
    await prisma.$transaction(async (tx) => {
      // 迁移用户配置
      if (indexedDBData.userProfile) {
        const profile = indexedDBData.userProfile
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
          }
        })
      }

      // 迁移健康日志
      if (indexedDBData.healthLogs) {
        for (const [dateKey, logData] of Object.entries(indexedDBData.healthLogs)) {
          const log = logData as any

          // 创建或更新每日日志
          const dailyLog = await tx.dailyLog.upsert({
            where: {
              userId_date: {
                userId,
                date: dateKey
              }
            },
            update: {
              weight: log.weight,
              activityLevel: log.activityLevel,
              calculatedBMR: log.calculatedBMR,
              calculatedTDEE: log.calculatedTDEE,
              tefAnalysis: log.tefAnalysis ? JSON.stringify(log.tefAnalysis) : null,
              dailyStatus: log.dailyStatus ? JSON.stringify(log.dailyStatus) : null,
            },
            create: {
              userId,
              date: dateKey,
              weight: log.weight,
              activityLevel: log.activityLevel,
              calculatedBMR: log.calculatedBMR,
              calculatedTDEE: log.calculatedTDEE,
              tefAnalysis: log.tefAnalysis ? JSON.stringify(log.tefAnalysis) : null,
              dailyStatus: log.dailyStatus ? JSON.stringify(log.dailyStatus) : null,
            }
          })

          results.dailyLogs++

          // 删除现有的食物记录
          await tx.foodEntry.deleteMany({
            where: { logId: dailyLog.id }
          })

          // 迁移食物记录
          if (log.foodEntries && Array.isArray(log.foodEntries)) {
            for (const foodEntry of log.foodEntries) {
              await tx.foodEntry.create({
                data: {
                  logId: dailyLog.id,
                  userId,
                  foodName: foodEntry.food_name,
                  consumedGrams: foodEntry.consumed_grams,
                  mealType: foodEntry.meal_type,
                  timePeriod: foodEntry.time_period,
                  nutritionalInfoPer100g: JSON.stringify(foodEntry.nutritional_info_per_100g),
                  totalNutritionalInfoConsumed: JSON.stringify(foodEntry.total_nutritional_info_consumed),
                  isEstimated: foodEntry.is_estimated,
                  timestamp: foodEntry.timestamp,
                }
              })
              results.foodEntries++
            }
          }

          // 删除现有的运动记录
          await tx.exerciseEntry.deleteMany({
            where: { logId: dailyLog.id }
          })

          // 迁移运动记录
          if (log.exerciseEntries && Array.isArray(log.exerciseEntries)) {
            for (const exerciseEntry of log.exerciseEntries) {
              await tx.exerciseEntry.create({
                data: {
                  logId: dailyLog.id,
                  userId,
                  exerciseName: exerciseEntry.exercise_name,
                  exerciseType: exerciseEntry.exercise_type,
                  durationMinutes: exerciseEntry.duration_minutes,
                  distanceKm: exerciseEntry.distance_km,
                  sets: exerciseEntry.sets,
                  reps: exerciseEntry.reps,
                  weightKg: exerciseEntry.weight_kg,
                  estimatedMets: exerciseEntry.estimated_mets,
                  userWeight: exerciseEntry.user_weight,
                  caloriesBurnedEstimated: exerciseEntry.calories_burned_estimated,
                  muscleGroups: exerciseEntry.muscle_groups ? JSON.stringify(exerciseEntry.muscle_groups) : null,
                  isEstimated: exerciseEntry.is_estimated,
                  timestamp: exerciseEntry.timestamp,
                }
              })
              results.exerciseEntries++
            }
          }
        }
      }

      // 迁移 AI 记忆
      if (indexedDBData.aiMemories) {
        for (const [expertId, memoryData] of Object.entries(indexedDBData.aiMemories)) {
          const memory = memoryData as any
          await tx.aIMemory.upsert({
            where: {
              userId_expertId: {
                userId,
                expertId
              }
            },
            update: {
              conversationCount: memory.conversationCount || 0,
              lastUpdated: memory.lastUpdated ? new Date(memory.lastUpdated) : new Date(),
              keyInsights: memory.keyInsights ? JSON.stringify(memory.keyInsights) : null,
              userPreferences: memory.userPreferences ? JSON.stringify(memory.userPreferences) : null,
              healthPatterns: memory.healthPatterns ? JSON.stringify(memory.healthPatterns) : null,
              goals: memory.goals ? JSON.stringify(memory.goals) : null,
              concerns: memory.concerns ? JSON.stringify(memory.concerns) : null,
            },
            create: {
              userId,
              expertId,
              conversationCount: memory.conversationCount || 0,
              lastUpdated: memory.lastUpdated ? new Date(memory.lastUpdated) : new Date(),
              keyInsights: memory.keyInsights ? JSON.stringify(memory.keyInsights) : null,
              userPreferences: memory.userPreferences ? JSON.stringify(memory.userPreferences) : null,
              healthPatterns: memory.healthPatterns ? JSON.stringify(memory.healthPatterns) : null,
              goals: memory.goals ? JSON.stringify(memory.goals) : null,
              concerns: memory.concerns ? JSON.stringify(memory.concerns) : null,
            }
          })
          results.aiMemories++
        }
      }

      // 迁移 AI 配置
      if (indexedDBData.aiConfig) {
        const configData = indexedDBData.aiConfig
        results.aiConfig = await tx.aIConfig.upsert({
          where: { userId },
          update: {
            chatModel: configData.chatModel ? JSON.stringify(configData.chatModel) : null,
            parseModel: configData.parseModel ? JSON.stringify(configData.parseModel) : null,
            adviceModel: configData.adviceModel ? JSON.stringify(configData.adviceModel) : null,
            tefModel: configData.tefModel ? JSON.stringify(configData.tefModel) : null,
          },
          create: {
            userId,
            chatModel: configData.chatModel ? JSON.stringify(configData.chatModel) : null,
            parseModel: configData.parseModel ? JSON.stringify(configData.parseModel) : null,
            adviceModel: configData.adviceModel ? JSON.stringify(configData.adviceModel) : null,
            tefModel: configData.tefModel ? JSON.stringify(configData.tefModel) : null,
          }
        })
      }
    })

    return NextResponse.json({
      message: 'IndexedDB 数据迁移成功',
      results
    })
  } catch (error) {
    console.error('Migrate IndexedDB data error:', error)
    return NextResponse.json(
      { error: 'IndexedDB 数据迁移失败' },
      { status: 500 }
    )
  }
})
