"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Scale, Info } from "lucide-react"
import { useTranslation } from "@/hooks/use-i18n"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

interface BMIIndicatorProps {
  weight: number // 当前体重 (kg)
  height: number // 身高 (cm)
}

// BMI分类标准
const BMI_CATEGORIES = [
  { min: 0, max: 18.5, key: 'underweight', color: 'bg-blue-500', textColor: 'text-blue-600' },
  { min: 18.5, max: 25, key: 'normal', color: 'bg-green-500', textColor: 'text-green-600' },
  { min: 25, max: 30, key: 'overweight', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
  { min: 30, max: 35, key: 'obese1', color: 'bg-orange-500', textColor: 'text-orange-600' },
  { min: 35, max: 40, key: 'obese2', color: 'bg-red-500', textColor: 'text-red-600' },
  { min: 40, max: Infinity, key: 'obese3', color: 'bg-red-700', textColor: 'text-red-700' },
]

export function BMIIndicator({ weight, height }: BMIIndicatorProps) {
  const t = useTranslation('dashboard.summary.bmi')

  // 计算BMI
  const heightInMeters = height / 100
  const bmi = weight / (heightInMeters * heightInMeters)

  // 找到当前BMI所属的分类
  const currentCategory = BMI_CATEGORIES.find(cat => bmi >= cat.min && bmi < cat.max) || BMI_CATEGORIES[BMI_CATEGORIES.length - 1]

  // 计算在光谱中的位置 (0-100%)
  const getPositionPercentage = (bmiValue: number) => {
    // 将BMI值映射到0-100%的范围
    // 使用15-45的BMI范围作为显示区间
    const minBMI = 15
    const maxBMI = 45
    const clampedBMI = Math.max(minBMI, Math.min(maxBMI, bmiValue))
    return ((clampedBMI - minBMI) / (maxBMI - minBMI)) * 100
  }

  const position = getPositionPercentage(bmi)

  // 各BMI分类的健康宣教默认文案（如i18n缺失时备用）
  const fallbackGuideMessages: Record<string, string> = {
    underweight: "保持均衡饮食，适当增加能量摄入并加强力量训练。",
    normal: "继续保持健康饮食与规律运动，关注整体生活方式。",
    overweight: "建议控制热量摄入，增加有氧及力量训练，逐步减脂。",
    obese1: "建议在专业医生或营养师指导下制定减重计划并坚持运动。",
    obese2: "肥胖风险较高，请及时就医并在专业指导下进行体重管理。",
    obese3: "严重肥胖，需在医疗团队指导下综合干预并监测并发症。",
  }

  const currentGuide = t(`guides.${currentCategory.key}`) || fallbackGuideMessages[currentCategory.key]

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center">
        <Scale className="mr-2 h-4 w-4 text-primary" />
        {t('title')}
      </h4>

      <div className="rounded-xl border p-4 bg-muted/30 dark:bg-slate-800/40 space-y-4">
        {/* BMI值显示 */}
        <div className="flex justify-between items-center">
          <span className="text-sm">{t('value')}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${currentCategory.textColor}`}>
              {bmi.toFixed(1)}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${currentCategory.color} text-white`}>
              {t(`categories.${currentCategory.key}`)}
            </span>

            {/* 分类解释 Popover 问号按钮 */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-5 h-5 flex items-center justify-center rounded-full bg-muted hover:bg-muted/70 text-[10px] leading-none text-muted-foreground focus:outline-none">
                  ?
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="center" className="p-3 w-56 space-y-2">
                {/* Part 1: BMI分类 */}
                <div className="space-y-1">
                  {BMI_CATEGORIES.map((category) => (
                    <div key={category.key} className="flex items-center gap-2 text-xs">
                      <div className={`w-2.5 h-2.5 rounded-full ${category.color}`} />
                      <span className="whitespace-nowrap">
                        {t(`categories.${category.key}`)} ({category.min}-{category.max})
                      </span>
                      {category.key === currentCategory.key && (
                        <span className="ml-1 text-primary">← {t('here') || '您在这里'}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Part 2: 健康宣教 */}
                <div className="pt-2 mt-1 border-t border-muted">
                  <p className="text-xs font-medium mb-1">{t('guideTitle') || '健康建议'}</p>
                  <p className="text-xs leading-snug text-muted-foreground whitespace-pre-line">
                    {currentGuide}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* BMI 光谱指示器 */}
        <div className="relative overflow-visible">
          {/* 背景光谱条（渐变） */}
          <div className="h-3 rounded-full bg-gradient-to-r from-blue-400 via-green-400 via-yellow-400 via-orange-400 to-red-500" />

          {/* 当前位置箭头 */}
          <div
            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
            style={{ left: `${position}%` }}
          >
            {/* 朝下小三角指示针 */}
            <div className="w-0 h-0 border-l-[4px] border-r-[4px] sm:border-l-[6px] sm:border-r-[6px] border-b-[6px] sm:border-b-[8px] border-transparent border-b-slate-800 dark:border-b-white" />
          </div>

          {/* 当前 BMI 值标签 */}
          {/* 去除上方数字，移动端更简洁 */}
        </div>

        {/* 说明文字 */}
        <p className="text-xs text-muted-foreground flex items-start">
          <Info className="mr-1.5 h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{t('description')}</span>
        </p>
      </div>
    </div>
  )
}
