"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { DailySummaryType, TEFAnalysis, UserProfile } from "@/lib/types"
import { Utensils, Flame, Sigma, Calculator, BedDouble, Target, TrendingUp, TrendingDown, Minus, PieChart, Info, Sparkles, Brain, Zap, ExternalLink } from "lucide-react"
import { useTranslation } from "@/hooks/use-i18n"
import Link from "next/link"
import ClientOnly from "@/components/client-only"
import { BMIIndicator } from "@/components/bmi-indicator"
import { WeightChangePredictor } from "@/components/weight-change-predictor"

interface DailySummaryProps {
  summary: DailySummaryType
  calculatedBMR?: number
  calculatedTDEE?: number
  tefAnalysis?: TEFAnalysis
  tefAnalysisCountdown?: number
  selectedDate?: Date
  onGenerateTEF?: () => void
  isGeneratingTEF?: boolean
  userProfile?: UserProfile
  currentWeight?: number
}

const defaultSummary: DailySummaryType = {
  totalCaloriesConsumed: 0,
  totalCaloriesBurned: 0,
  macros: { carbs: 0, protein: 0, fat: 0 },
  micronutrients: {},
};

// ▶️ 宏量营养素推荐区间 (占总能量百分比)
const MACRO_RANGES = {
  carbs: { min: 45, max: 65 },    // 碳水化合物 45-65 %
  protein: { min: 10, max: 35 },  // 蛋白质 10-35 %
  fat: { min: 20, max: 35 },      // 脂肪 20-35 %
}

export function DailySummary({ summary = defaultSummary, calculatedBMR, calculatedTDEE, tefAnalysis, tefAnalysisCountdown, selectedDate, onGenerateTEF, isGeneratingTEF, userProfile, currentWeight }: DailySummaryProps) {
  const t = useTranslation('dashboard.summary')
  const tSummary = useTranslation('summary')
  const { totalCaloriesConsumed, totalCaloriesBurned, macros } = summary

  // 计算宏量营养素百分比
  const totalMacros = macros.carbs + macros.protein + macros.fat
  const carbsPercent = totalMacros > 0 ? (macros.carbs / totalMacros) * 100 : 0
  const proteinPercent = totalMacros > 0 ? (macros.protein / totalMacros) * 100 : 0
  const fatPercent = totalMacros > 0 ? (macros.fat / totalMacros) * 100 : 0

  // 新增：计算每个宏量营养素是否低于下限或高于上限
  const carbsStatus = carbsPercent < MACRO_RANGES.carbs.min ? 'low' : carbsPercent > MACRO_RANGES.carbs.max ? 'high' : 'ok'
  const proteinStatus = proteinPercent < MACRO_RANGES.protein.min ? 'low' : proteinPercent > MACRO_RANGES.protein.max ? 'high' : 'ok'
  const fatStatus = fatPercent < MACRO_RANGES.fat.min ? 'low' : fatPercent > MACRO_RANGES.fat.max ? 'high' : 'ok'

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
        <div className="p-4 md:p-8">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary text-white">
                <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">{t('title')}</h3>
                <p className="text-muted-foreground text-sm md:text-lg">{t('description')}</p>
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

          {/* TEF 分析（始终显示，支持手动触发） */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center">
                <Zap className="mr-2 h-4 w-4 text-primary" />
                {t('tef.title')}
              </h4>
              <div className="flex items-center gap-2">
                {(tefAnalysisCountdown ?? 0) > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                    {t('tef.analyzingLabel', { seconds: tefAnalysisCountdown }) || `分析中 ${tefAnalysisCountdown}s`}
                  </span>
                )}
                {onGenerateTEF && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onGenerateTEF}
                    disabled={isGeneratingTEF || (tefAnalysisCountdown ?? 0) > 0}
                    className="h-7 px-3 text-xs"
                  >
                    {isGeneratingTEF ? t('tef.generating') || '生成中…' : (tefAnalysis ? t('tef.regenerate') || '重新分析' : t('tef.generate') || '生成分析')}
                  </Button>
                )}
              </div>
            </div>

            {/* 若无分析结果且未在生成中，显示提示 */}
            {!tefAnalysis && (tefAnalysisCountdown ?? 0) === 0 && !isGeneratingTEF && (
              <p className="text-xs text-muted-foreground">
                {t('tef.noAnalysis') || '尚未生成 TEF 分析'}
              </p>
            )}

            {/* 以下内容仅在已有分析结果时显示 */}
            {tefAnalysis && (
              <>
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

                {tefAnalysis.enhancementFactors.length > 0 && (
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
              </>
            )}

            <p className="text-xs text-muted-foreground pt-2 flex items-start">
              <Info className="mr-1.5 h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{t('tef.description', { analyzed: tefAnalysis ? 'true' : 'other' })}</span>
            </p>
          </div>

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
                    {carbsStatus === 'low' && (
                      <span className="text-red-500 ml-1">↓低于{MACRO_RANGES.carbs.min}%</span>
                    )}
                    {carbsStatus === 'high' && (
                      <span className="text-orange-500 ml-1">↑高于{MACRO_RANGES.carbs.max}%</span>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                  {/* 推荐区间浅色背景 */}
                  <div
                    className="absolute top-0 h-full bg-sky-500/20 dark:bg-sky-600/20"
                    style={{ left: `${MACRO_RANGES.carbs.min}%`, width: `${MACRO_RANGES.carbs.max - MACRO_RANGES.carbs.min}%` }}
                  />
                  {/* 实际摄入 */}
                  <div className="h-full bg-sky-500 rounded-full relative" style={{ width: `${carbsPercent}%` }} />
                </div>
              </div>

              {/* 蛋白质 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs">{t('protein')}</span>
                  <span className="text-xs">
                    {macros.protein.toFixed(1)}g ({proteinPercent.toFixed(0)}%)
                    {proteinStatus === 'low' && (
                      <span className="text-red-500 ml-1">↓低于{MACRO_RANGES.protein.min}%</span>
                    )}
                    {proteinStatus === 'high' && (
                      <span className="text-orange-500 ml-1">↑高于{MACRO_RANGES.protein.max}%</span>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                  <div
                    className="absolute top-0 h-full bg-emerald-500/20 dark:bg-emerald-600/20"
                    style={{ left: `${MACRO_RANGES.protein.min}%`, width: `${MACRO_RANGES.protein.max - MACRO_RANGES.protein.min}%` }}
                  />
                  <div className="h-full bg-emerald-500 rounded-full relative" style={{ width: `${proteinPercent}%` }} />
                </div>
              </div>

              {/* 脂肪 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs">{t('fat')}</span>
                  <span className="text-xs">
                    {macros.fat.toFixed(1)}g ({fatPercent.toFixed(0)}%)
                    {fatStatus === 'low' && (
                      <span className="text-red-500 ml-1">↓低于{MACRO_RANGES.fat.min}%</span>
                    )}
                    {fatStatus === 'high' && (
                      <span className="text-orange-500 ml-1">↑高于{MACRO_RANGES.fat.max}%</span>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                  <div
                    className="absolute top-0 h-full bg-amber-500/20 dark:bg-amber-600/20"
                    style={{ left: `${MACRO_RANGES.fat.min}%`, width: `${MACRO_RANGES.fat.max - MACRO_RANGES.fat.min}%` }}
                  />
                  <div className="h-full bg-amber-500 rounded-full relative" style={{ width: `${fatPercent}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* BMI指示器 */}
          {userProfile && currentWeight && userProfile.height && (
            <div className="space-y-3 pt-4 border-t">
              <BMIIndicator
                weight={currentWeight}
                height={userProfile.height}
              />
            </div>
          )}

          {/* 体重变化预测 */}
          {calorieDifference !== null && Math.abs(calorieDifference) > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <WeightChangePredictor
                calorieDifference={calorieDifference}
                currentWeight={currentWeight}
                targetWeight={userProfile?.targetWeight}
              />
            </div>
          )}


          </div>
        </div>
      </div>
    </ClientOnly>
  )
}
