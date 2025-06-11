"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { DailySummaryType, TEFAnalysis } from "@/lib/types"
import { Utensils, Flame, Sigma, Calculator, BedDouble, Target, TrendingUp, TrendingDown, Minus, PieChart, Info, Sparkles, Brain, Zap, ExternalLink } from "lucide-react"
import { useTranslation } from "@/hooks/use-i18n"
import Link from "next/link"
import ClientOnly from "@/components/client-only"

interface DailySummaryProps {
  summary: DailySummaryType
  calculatedBMR?: number
  calculatedTDEE?: number
  tefAnalysis?: TEFAnalysis
  tefAnalysisCountdown?: number
  selectedDate?: Date
}

const defaultSummary: DailySummaryType = {
  totalCaloriesConsumed: 0,
  totalCaloriesBurned: 0,
  macros: { carbs: 0, protein: 0, fat: 0 },
  micronutrients: {},
};

export function DailySummary({ summary = defaultSummary, calculatedBMR, calculatedTDEE, tefAnalysis, tefAnalysisCountdown, selectedDate }: DailySummaryProps) {
  const t = useTranslation('dashboard.summary')
  const tSummary = useTranslation('summary')
  const { totalCaloriesConsumed, totalCaloriesBurned, macros } = summary

  // 计算宏量营养素百分比
  const totalMacros = macros.carbs + macros.protein + macros.fat
  const carbsPercent = totalMacros > 0 ? (macros.carbs / totalMacros) * 100 : 0
  const proteinPercent = totalMacros > 0 ? (macros.protein / totalMacros) * 100 : 0
  const fatPercent = totalMacros > 0 ? (macros.fat / totalMacros) * 100 : 0

  // 计算净卡路里
  const netCalories = totalCaloriesConsumed - totalCaloriesBurned

  // 计算与TDEE的差额（净卡路里与目标消耗的差值）
  const calorieDifference = calculatedTDEE ? netCalories - calculatedTDEE : null
  let calorieStatusText = ""
  let calorieStatusColor = "text-muted-foreground" // Default color

  if (calorieDifference !== null) {
    if (calorieDifference > 0) {
      calorieStatusText = t('surplus', { amount: calorieDifference.toFixed(0) })
      calorieStatusColor = "text-orange-500 dark:text-orange-400" // 盈余用橙色表示
    } else if (calorieDifference < 0) {
      calorieStatusText = t('deficit', { amount: Math.abs(calorieDifference).toFixed(0) })
      calorieStatusColor = "text-green-600 dark:text-green-500" // 缺口用绿色表示（通常有利于减重）
    } else {
      calorieStatusText = t('calorieBalance')
      calorieStatusColor = "text-blue-500 dark:text-blue-400"
    }
  }

  return (
    <ClientOnly>
      <div className="health-card h-full flex flex-col">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold">{t('title')}</h3>
                <p className="text-muted-foreground text-lg">{t('description')}</p>
              </div>
            </div>
            <Link href={selectedDate ? `/summary?date=${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` : "/summary"}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="space-y-8 flex-grow">
          {/* 卡路里摘要 */}
          <div className="space-y-3">
             <h4 className="text-sm font-medium flex items-center"><Sigma className="mr-2 h-4 w-4 text-primary" />{t('calorieBalance')}</h4>
            <div className="flex justify-between items-center">
              <div className="flex items-center text-sm">
                <Utensils className="mr-2 h-4 w-4 text-green-500" />
                <span>{t('caloriesIn')}</span>
              </div>
              <span className="text-sm font-semibold">{totalCaloriesConsumed.toFixed(0)} kcal</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center text-sm">
                <Flame className="mr-2 h-4 w-4 text-red-500" />
                <span>{t('exerciseBurn')}</span>
              </div>
              <span className="text-sm font-semibold">{totalCaloriesBurned.toFixed(0)} kcal</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center text-sm font-medium">
                {netCalories > 0 ? <TrendingUp className="mr-2 h-4 w-4 text-orange-500" /> : <TrendingDown className="mr-2 h-4 w-4 text-blue-500" />}
                <span>{t('netCalories')}</span>
              </div>
              <span className={`text-sm font-bold ${netCalories > 0 ? "text-orange-500" : "text-blue-500"}`}>
                {netCalories.toFixed(0)} kcal
              </span>
            </div>
          </div>

          {/* 估算代谢率 */}
          {(calculatedBMR || calculatedTDEE) && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-medium flex items-center"><Calculator className="mr-2 h-4 w-4 text-primary" />{t('estimatedDailyNeeds')}</h4>
              {calculatedBMR && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-sm">
                    <BedDouble className="mr-2 h-4 w-4 text-purple-500" />
                    <span>{t('bmr')}</span>
                  </div>
                  <span className="text-sm">{calculatedBMR.toFixed(0)} kcal</span>
                </div>
              )}
              {calculatedTDEE && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-sm">
                    <Target className="mr-2 h-4 w-4 text-indigo-500" />
                    <span>{t('tdee')}</span>
                  </div>
                  <span className="text-sm">{calculatedTDEE.toFixed(0)} kcal</span>
                </div>
              )}
              {calorieDifference !== null && calculatedTDEE && (
                <div className="flex justify-between items-center pt-1">
                  <div className="flex items-center text-sm font-medium">
                    {calorieDifference === 0 ? <Minus className="mr-2 h-4 w-4 text-blue-500" /> : calorieDifference > 0 ? <TrendingUp className="mr-2 h-4 w-4 text-orange-500" /> : <TrendingDown className="mr-2 h-4 w-4 text-green-600" />}
                    <span>{t('calorieDeficitSurplus')}</span>
                  </div>
                  <span className={`text-sm font-bold ${calorieStatusColor}`}>
                    {calorieStatusText}
                  </span>
                </div>
              )}
               <p className="text-xs text-muted-foreground pt-2 flex items-start">
                <Info className="mr-1.5 h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>{tSummary('estimationNote')}</span>
              </p>
            </div>
          )}

          {/* TEF 分析 */}
          {(tefAnalysis || (tefAnalysisCountdown && tefAnalysisCountdown > 0)) && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center">
                  <Zap className="mr-2 h-4 w-4 text-primary" />
                  {t('tef.title')}
                </h4>
                {tefAnalysisCountdown && tefAnalysisCountdown > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                    分析中 {tefAnalysisCountdown}s
                  </span>
                )}
              </div>
              {tefAnalysis && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                    <div className="flex items-center justify-center mb-1">
                      <Flame className="h-3 w-3 text-orange-500" />
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">{t('tef.baseTEF')}</div>
                    <div className="text-sm font-medium">
                      {tefAnalysis.baseTEF.toFixed(1)} kcal
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({tefAnalysis.baseTEFPercentage.toFixed(1)}%)
                    </div>
                  </div>

                  {tefAnalysis.enhancementMultiplier > 1 ? (
                    <>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                        <div className="flex items-center justify-center mb-1">
                          <Brain className="h-3 w-3 text-purple-500" />
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">增强乘数</div>
                        <div className="text-sm font-medium text-purple-600">
                          ×{tefAnalysis.enhancementMultiplier.toFixed(2)}
                        </div>
                      </div>

                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                        <div className="flex items-center justify-center mb-1">
                          <Sparkles className="h-3 w-3 text-emerald-500" />
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">{t('tef.enhancedTEF')}</div>
                        <div className="text-sm font-bold text-emerald-600">
                          {tefAnalysis.enhancedTEF.toFixed(1)} kcal
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">{t('tef.noEnhancement')}</span>
                    </div>
                  )}
                </div>
              )}

              {tefAnalysis && tefAnalysis.enhancementFactors.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-1">{t('tef.enhancementFactorsLabel')}</p>
                  <div className="flex flex-wrap gap-1">
                    {tefAnalysis.enhancementFactors.map((factor, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!tefAnalysis && tefAnalysisCountdown && tefAnalysisCountdown > 0 && (
                <div className="flex items-center justify-center py-4">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">
                      {t('tef.analyzingDescription')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('tef.remainingTime', { seconds: tefAnalysisCountdown })}
                    </p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-2 flex items-start">
                <Info className="mr-1.5 h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>{t('tef.description', { analyzed: tefAnalysis ? 'true' : 'other' })}</span>
              </p>
            </div>
          )}

          {/* 宏量营养素分布 */}
          {totalMacros > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium flex items-center"><PieChart className="mr-2 h-4 w-4 text-primary" />{t('macronutrients')}</h4>

              {/* 碳水化合物 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs">{t('carbohydrates')}</span>
                  <span className="text-xs">
                    {macros.carbs.toFixed(1)}g ({carbsPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${carbsPercent}%` }} />
                </div>
              </div>

              {/* 蛋白质 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs">{t('protein')}</span>
                  <span className="text-xs">
                    {macros.protein.toFixed(1)}g ({proteinPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${proteinPercent}%` }} />
                </div>
              </div>

              {/* 脂肪 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs">{t('fat')}</span>
                  <span className="text-xs">
                    {macros.fat.toFixed(1)}g ({fatPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${fatPercent}%` }} />
                </div>
              </div>
            </div>
          )}


          </div>
        </div>
      </div>
    </ClientOnly>
  )
}
