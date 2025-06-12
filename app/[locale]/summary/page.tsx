"use client"

import { useState, useEffect, use, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useTranslation } from "@/hooks/use-i18n"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useIndexedDB } from "@/hooks/use-indexed-db"
import { useToast } from "@/hooks/use-toast"
import type { DailyLog, UserProfile, SmartSuggestionsResponse } from "@/lib/types"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import {
  ArrowLeft,
  Utensils,
  Flame,
  Calculator,
  BedDouble,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Info,
  Brain,
  Camera,
  Download,
  PieChart,
  Zap,
  Sparkles
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { FoodEntryCard } from "@/components/food-entry-card"
import { ExerciseEntryCard } from "@/components/exercise-entry-card"
import { BMIIndicator } from "@/components/bmi-indicator"
import { WeightChangePredictor } from "@/components/weight-change-predictor"

const defaultUserProfile: UserProfile = {
  weight: 70,
  height: 170,
  age: 25,
  gender: "male",
  activityLevel: "sedentary",
  goal: "maintain",
  bmrFormula: "mifflin-st-jeor",
  bmrCalculationBasis: "totalWeight"
}

// 内部组件，处理 useSearchParams
function SummaryPageContent({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslation('summary')
  const tDashboard = useTranslation('dashboard')
  const { toast } = useToast()
  const { theme } = useTheme()
  const [userProfile] = useLocalStorage("userProfile", defaultUserProfile)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestionsResponse | null>(null)
  const [isSmartSuggestionsOpen, setIsSmartSuggestionsOpen] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)
  const summaryContentRef = useRef<HTMLDivElement>(null)

  const { getData } = useIndexedDB("healthLogs")
  const searchParams = useSearchParams()

  // 解包params Promise
  const resolvedParams = use(params)

  // 获取当前语言环境
  const currentLocale = resolvedParams.locale === 'en' ? enUS : zhCN

  // 处理URL中的日期参数
  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      // 使用本地时间解析日期，避免时区问题
      const [year, month, day] = dateParam.split('-').map(Number)
      if (year && month && day) {
        const parsedDate = new Date(year, month - 1, day) // month是0-based
        if (!isNaN(parsedDate.getTime())) {
          setSelectedDate(parsedDate)
        }
      }
    }
  }, [searchParams])

  useEffect(() => {
    const loadDailyLog = async () => {
      const dateKey = format(selectedDate, "yyyy-MM-dd")
      const log = await getData(dateKey)
      setDailyLog(log)
    }
    loadDailyLog()
  }, [selectedDate, getData])

  useEffect(() => {
    // 加载智能建议 - 使用与主页面相同的存储格式
    const dateKey = format(selectedDate, "yyyy-MM-dd")
    const allSuggestions = localStorage.getItem('smartSuggestions')
    if (allSuggestions) {
      try {
        const suggestionsData = JSON.parse(allSuggestions)
        const dateSuggestions = suggestionsData[dateKey]
        setSmartSuggestions(dateSuggestions || null)
      } catch (error) {
        console.warn('Failed to parse smart suggestions:', error)
        setSmartSuggestions(null)
      }
    } else {
      setSmartSuggestions(null)
    }
  }, [selectedDate])

  // Badge修复函数
  const fixBadgeElements = async (container: HTMLElement) => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    // 查找所有可能的Badge元素
    const badgeSelectors = [
      '.inline-flex',
      '.badge',
      '[class*="badge"]',
      'span[class*="bg-"]',
      'span[class*="px-"]',
      'span[class*="py-"]',
      'span[class*="text-xs"]',
      'span[class*="rounded-full"]',
      'span[class*="items-center"]'
    ]

    badgeSelectors.forEach(selector => {
      try {
        const elements = container.querySelectorAll(selector)
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement
          const className = htmlEl.className || ''

          // 检查是否是Badge类型的元素
          if (htmlEl.tagName === 'SPAN' && (
            className.includes('inline-flex') ||
            className.includes('bg-') ||
            className.includes('px-') ||
            className.includes('py-') ||
            className.includes('rounded-full') ||
            className.includes('items-center')
          )) {
            // 回到最简单的方法 - 只修复关键样式
            console.log('修复Badge元素:', htmlEl, '原始文本:', htmlEl.textContent)

            // 只设置最关键的样式，不要过度修改
            htmlEl.style.display = 'inline-flex'
            htmlEl.style.alignItems = 'center'
            htmlEl.style.justifyContent = 'center'
            htmlEl.style.borderRadius = '9999px'
            htmlEl.style.padding = '1px 8px'
            htmlEl.style.fontSize = '0.75rem'
            htmlEl.style.fontWeight = '500'
            htmlEl.style.lineHeight = '1'
            htmlEl.style.whiteSpace = 'nowrap'
            htmlEl.style.verticalAlign = 'middle'
            htmlEl.style.boxSizing = 'border-box'
            htmlEl.style.height = '18px'
            htmlEl.style.minHeight = '18px'
            // 增加偏移量，确保能看到变化
            htmlEl.style.transform = 'translateY(-2px)'

            // 强制应用样式
            htmlEl.style.setProperty('transform', 'translateY(-2px)', 'important')
            htmlEl.style.setProperty('padding-top', '0px', 'important')
            htmlEl.style.setProperty('padding-bottom', '2px', 'important')

            // 已经重新创建了Badge结构，不需要额外处理

            // 设置背景色
            if (className.includes('bg-primary')) {
              htmlEl.style.backgroundColor = isDark ? 'rgba(5, 150, 105, 0.2)' : 'rgba(5, 150, 105, 0.1)'
              htmlEl.style.color = '#059669'
            } else if (className.includes('bg-green')) {
              htmlEl.style.backgroundColor = isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7'
              htmlEl.style.color = isDark ? '#4ade80' : '#166534'
            } else if (className.includes('bg-red')) {
              htmlEl.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2'
              htmlEl.style.color = isDark ? '#f87171' : '#991b1b'
            } else if (className.includes('bg-yellow')) {
              htmlEl.style.backgroundColor = isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'
              htmlEl.style.color = isDark ? '#fbbf24' : '#92400e'
            } else if (className.includes('bg-gray')) {
              htmlEl.style.backgroundColor = isDark ? 'rgba(156, 163, 175, 0.2)' : '#f3f4f6'
              htmlEl.style.color = isDark ? '#d1d5db' : '#374151'
            }

            console.log('Fixed badge element:', htmlEl, 'className:', className)
          }
        })
      } catch (error) {
        console.warn('Error fixing badges with selector:', selector, error)
      }
    })

    // 等待样式应用
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // 展开所有可折叠内容的函数 - 但排除Smart Suggestions
  const expandAllCollapsibleContent = async (container: HTMLElement) => {
    try {
      // Smart Suggestions不需要展开，保持原始状态
      console.log('Smart Suggestions保持原始状态，不包含在截图中')

      // 查找所有Radix UI Collapsible相关元素
      const collapsibleTriggers = container.querySelectorAll('[data-radix-collection-item]')
      const collapsibleRoots = container.querySelectorAll('[data-state]')
      const collapsibleContents = container.querySelectorAll('[data-radix-collapsible-content]')

      console.log('找到可折叠元素:', {
        triggers: collapsibleTriggers.length,
        roots: collapsibleRoots.length,
        contents: collapsibleContents.length
      })

      // 强制展开所有Radix UI Collapsible
      collapsibleRoots.forEach((el) => {
        const htmlEl = el as HTMLElement
        console.log('处理可折叠根元素:', htmlEl, '当前状态:', htmlEl.getAttribute('data-state'))

        if (htmlEl.hasAttribute('data-state')) {
          htmlEl.setAttribute('data-state', 'open')
        }
        if (htmlEl.hasAttribute('aria-expanded')) {
          htmlEl.setAttribute('aria-expanded', 'true')
        }
      })

      // 强制显示所有CollapsibleContent
      collapsibleContents.forEach((el) => {
        const htmlEl = el as HTMLElement
        console.log('处理可折叠内容:', htmlEl)

        htmlEl.style.display = 'block'
        htmlEl.style.visibility = 'visible'
        htmlEl.style.opacity = '1'
        htmlEl.style.height = 'auto'
        htmlEl.style.maxHeight = 'none'
        htmlEl.style.overflow = 'visible'
        htmlEl.setAttribute('data-state', 'open')
      })

      // 查找所有可能的可折叠元素
      const allCollapsibleElements = container.querySelectorAll('[data-state="closed"], .collapsed, [aria-expanded="false"], [style*="display: none"], [style*="height: 0"]')

      allCollapsibleElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        console.log('处理其他可折叠元素:', htmlEl)

        // 展开所有状态
        if (htmlEl.hasAttribute('data-state')) {
          htmlEl.setAttribute('data-state', 'open')
        }
        if (htmlEl.hasAttribute('aria-expanded')) {
          htmlEl.setAttribute('aria-expanded', 'true')
        }

        // 强制显示
        htmlEl.style.display = 'block'
        htmlEl.style.visibility = 'visible'
        htmlEl.style.opacity = '1'
        htmlEl.style.height = 'auto'
        htmlEl.style.maxHeight = 'none'
        htmlEl.style.overflow = 'visible'
      })

      console.log('展开了', allCollapsibleElements.length, '个可折叠元素')

      // 等待内容完全展开
      await new Promise(resolve => setTimeout(resolve, 800))

    } catch (error) {
      console.warn('展开可折叠内容时出错:', error)
    }
  }

  // 优化容器尺寸的函数 - 返回恢复函数
  const optimizeContainerWidth = async (container: HTMLElement) => {
    try {
      // 保存容器的原始样式
      const originalContainerStyles = {
        width: container.style.width,
        maxWidth: container.style.maxWidth,
        minWidth: container.style.minWidth,
        height: container.style.height,
        maxHeight: container.style.maxHeight,
        minHeight: container.style.minHeight,
      }

      // 保存所有卡片的原始样式
      const cards = container.querySelectorAll('.card, .health-card')
      const originalCardStyles = Array.from(cards).map((card) => {
        const cardEl = card as HTMLElement
        return {
          element: cardEl,
          width: cardEl.style.width,
          maxWidth: cardEl.style.maxWidth,
          height: cardEl.style.height,
          maxHeight: cardEl.style.maxHeight,
          overflow: cardEl.style.overflow,
        }
      })

      // 临时设置容器为适合内容的宽度和高度
      container.style.width = 'fit-content'
      container.style.maxWidth = '800px'
      container.style.minWidth = '600px'
      container.style.height = 'auto'
      container.style.maxHeight = 'none'
      container.style.minHeight = 'auto'

      // 确保所有子元素也适应内容尺寸
      cards.forEach((card) => {
        const cardEl = card as HTMLElement
        cardEl.style.width = '100%'
        cardEl.style.maxWidth = 'none'
        cardEl.style.height = 'auto'
        cardEl.style.maxHeight = 'none'
        cardEl.style.overflow = 'visible'
      })

      // 强制重新计算布局
      container.offsetWidth
      container.offsetHeight

      console.log('优化后的容器尺寸:', {
        width: container.offsetWidth,
        height: container.offsetHeight,
        scrollHeight: container.scrollHeight
      })

      // 等待布局稳定
      await new Promise(resolve => setTimeout(resolve, 100))

      // 返回恢复函数
      return () => {
        try {
          // 恢复容器样式
          Object.assign(container.style, originalContainerStyles)

          // 恢复所有卡片样式
          originalCardStyles.forEach(({ element, ...styles }) => {
            Object.assign(element.style, styles)
          })

          console.log('已恢复容器和卡片的原始样式')
        } catch (error) {
          console.warn('恢复容器样式时出错:', error)
        }
      }

    } catch (error) {
      console.warn('优化容器尺寸时出错:', error)
      // 返回空的恢复函数
      return () => {}
    }
  }

  // 确保所有内容都可见的函数
  const ensureAllContentVisible = async (container: HTMLElement) => {
    try {
      // 查找所有可能被隐藏或截断的元素
      const allElements = container.querySelectorAll('*')

      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        if (htmlEl.style) {
          // 移除可能导致内容隐藏的样式
          htmlEl.style.overflow = 'visible'
          htmlEl.style.maxHeight = 'none'
          htmlEl.style.height = 'auto'

          // 确保元素可见
          if (htmlEl.style.display === 'none') {
            htmlEl.style.display = 'block'
          }
          if (htmlEl.style.visibility === 'hidden') {
            htmlEl.style.visibility = 'visible'
          }
        }
      })

      // 特别处理可能的底部元素
      const bottomElements = container.querySelectorAll('.mt-8, .mb-8, .space-y-8 > *:last-child, [class*="margin"], [class*="padding"]')
      bottomElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.marginBottom = '0'
        htmlEl.style.paddingBottom = '20px' // 确保底部有足够空间
      })

      // 强制展开所有可能的懒加载内容
      const lazyElements = container.querySelectorAll('[data-lazy], [loading="lazy"], .lazy')
      lazyElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.display = 'block'
        htmlEl.style.visibility = 'visible'
        htmlEl.style.opacity = '1'
      })

      // 滚动到底部确保所有内容都被渲染
      const maxScroll = Math.max(
        container.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      )

      window.scrollTo(0, maxScroll)
      await new Promise(resolve => setTimeout(resolve, 500))

      // 再次滚动到顶部
      window.scrollTo(0, 0)
      await new Promise(resolve => setTimeout(resolve, 300))

      console.log('确保所有内容可见完成，最大滚动高度:', maxScroll)

    } catch (error) {
      console.warn('确保内容可见时出错:', error)
    }
  }

  // 截图功能 - 使用html-to-image
  const handleCapture = async () => {
    if (!summaryContentRef.current) return

    setIsCapturing(true)
    try {
      await captureWithHtmlToImage()
    } catch (error) {
      console.error('截图失败:', error)
      toast({
        title: t('screenshot.failed'),
        description: t('screenshot.failedRetry'),
        variant: "destructive",
      })
    } finally {
      setIsCapturing(false)
    }
  }

  // 使用html-to-image的截图方案 - 更好的定位精度
  const captureWithHtmlToImage = async () => {
    try {
      const { toPng } = await import('html-to-image')
      const element = summaryContentRef.current!

      // 根据当前主题确定背景颜色
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      const backgroundColor = isDark ? '#0f172a' : '#ffffff' // slate-900 : white

      // 保存当前滚动位置
      const originalScrollTop = window.scrollY || document.documentElement.scrollTop
      const originalScrollLeft = window.scrollX || document.documentElement.scrollLeft

      // 显示准备提示
      toast({
        title: t('screenshot.preparing'),
        description: t('screenshot.preparingDescription'),
        duration: 2000,
      })

      // 滚动到页面顶部
      window.scrollTo(0, 0)
      await new Promise(resolve => setTimeout(resolve, 200))

      // 修复导航栏和其他定位问题
      const navigationElements = document.querySelectorAll('nav, [class*="nav"], .sticky, [class*="sticky"]') as NodeListOf<HTMLElement>
      const originalNavStyles = new Map<HTMLElement, {
        position: string;
        top: string;
        zIndex: string;
        transform: string;
      }>()

      // 临时修复导航栏
      navigationElements.forEach((nav) => {
        if (nav.style) {
          originalNavStyles.set(nav, {
            position: nav.style.position,
            top: nav.style.top,
            zIndex: nav.style.zIndex,
            transform: nav.style.transform,
          })

          const computedStyle = window.getComputedStyle(nav)
          if (computedStyle.position === 'sticky' || computedStyle.position === 'fixed') {
            nav.style.position = 'relative'
            nav.style.top = ''
            nav.style.transform = ''
            nav.style.zIndex = ''
          }
        }
      })

      // 临时调整容器样式以确保正确截图
      const originalStyles = {
        width: element.style.width,
        maxWidth: element.style.maxWidth,
        margin: element.style.margin,
        padding: element.style.padding,
        position: element.style.position,
        transform: element.style.transform,
      }

      // 设置固定宽度和样式，避免响应式布局影响
      element.style.width = '800px'
      element.style.maxWidth = '800px'
      element.style.margin = '0'
      element.style.padding = '2rem'
      element.style.position = 'static'
      element.style.transform = 'none'

      // 等待样式应用
      await new Promise(resolve => setTimeout(resolve, 100))

      // 配置html-to-image选项
      const options = {
        backgroundColor,
        pixelRatio: 2, // 高分辨率
        cacheBust: true,
        width: 800, // 固定宽度
        height: element.scrollHeight, // 使用实际内容高度
        style: {
          transform: 'none',
          animation: 'none',
          transition: 'none',
          width: '800px',
          maxWidth: '800px',
          margin: '0',
          padding: '2rem',
          position: 'static',
        },
        filter: (node: HTMLElement) => {
          // 排除不需要截图的元素，但保留STYLE标签以确保样式正确渲染
          return !node.classList?.contains('no-screenshot') &&
                 node.tagName !== 'SCRIPT' &&
                 node.tagName !== 'BUTTON'
        },
      }

      // 生成PNG图片
      const dataUrl = await toPng(element, options)

      // 恢复容器原始样式
      Object.assign(element.style, originalStyles)

      // 恢复导航栏样式
      navigationElements.forEach((nav) => {
        const original = originalNavStyles.get(nav)
        if (original && nav.style) {
          Object.assign(nav.style, original)
        }
      })

      // 恢复滚动位置
      window.scrollTo(originalScrollLeft, originalScrollTop)

      console.log('html-to-image截图生成成功')

      // 下载图片
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
      const filename = `health-summary_${timestamp}.png`

      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // 显示成功提示
      toast({
        title: t('screenshot.success'),
        description: `${t('screenshot.savedAs')} ${filename}`,
        duration: 3000,
      })

    } catch (error) {
      console.error('html-to-image截图失败:', error)
      throw error
    }
  }

  if (!dailyLog) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('backToHome')}
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('noDataForDate')}</p>
        </div>
      </div>
    )
  }

  const { summary, calculatedBMR, calculatedTDEE, foodEntries, exerciseEntries } = dailyLog
  const { totalCaloriesConsumed, totalCaloriesBurned } = summary
  const netCalories = totalCaloriesConsumed - totalCaloriesBurned

  // 计算与TDEE的差额
  const calorieDifference = calculatedTDEE ? calculatedTDEE - netCalories : null
  let calorieStatusText = ""
  let calorieStatusColor = "text-muted-foreground"

  if (calorieDifference !== null) {
    if (calorieDifference > 0) {
      calorieStatusText = t('deficit', { amount: calorieDifference.toFixed(0) })
      calorieStatusColor = "text-green-600 dark:text-green-500"
    } else if (calorieDifference < 0) {
      calorieStatusText = t('surplus', { amount: Math.abs(calorieDifference).toFixed(0) })
      calorieStatusColor = "text-orange-500 dark:text-orange-400"
    } else {
      calorieStatusText = t('balanced')
      calorieStatusColor = "text-blue-500 dark:text-blue-400"
    }
  }

  // ▶️ 额外计算：宏量营养素、TEF、BMI 等
  const macros = summary.macros || { carbs: 0, protein: 0, fat: 0 }
  const totalMacros = macros.carbs + macros.protein + macros.fat
  const carbsPercent = totalMacros > 0 ? (macros.carbs / totalMacros) * 100 : 0
  const proteinPercent = totalMacros > 0 ? (macros.protein / totalMacros) * 100 : 0
  const fatPercent = totalMacros > 0 ? (macros.fat / totalMacros) * 100 : 0

  const MACRO_RANGES = {
    carbs: { min: 45, max: 65 },
    protein: { min: 10, max: 35 },
    fat: { min: 20, max: 35 },
  }

  const carbsStatus = carbsPercent < MACRO_RANGES.carbs.min ? 'low' : carbsPercent > MACRO_RANGES.carbs.max ? 'high' : 'ok'
  const proteinStatus = proteinPercent < MACRO_RANGES.protein.min ? 'low' : proteinPercent > MACRO_RANGES.protein.max ? 'high' : 'ok'
  const fatStatus = fatPercent < MACRO_RANGES.fat.min ? 'low' : fatPercent > MACRO_RANGES.fat.max ? 'high' : 'ok'

  const tefAnalysis = dailyLog.tefAnalysis

  // 体重变化预测使用的差值方向需与组件保持一致（正=盈余，负=缺口）
  const calorieDifferenceForWeight = calculatedTDEE ? netCalories - calculatedTDEE : 0
  const currentWeight = dailyLog.weight ?? userProfile.weight

  return (
    <div ref={summaryContentRef} className="container mx-auto px-4 py-8 max-w-4xl" data-screenshot="true">
      {/* 页面头部 */}
      <div className="mb-8">
        {/* 第一行：返回按钮和标题 */}
        {/* 第一行：返回按钮 */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="no-screenshot">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('backToHome')}
            </Button>
          </Link>
        </div>

        {/* 第二行：标题区域 - 居中 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground text-lg">{t('description')}</p>
        </div>

        {/* 第三行：日期和操作按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">{t('date')}:</p>
            <p className="text-lg font-medium">
              {format(selectedDate, "PPP (eeee)", { locale: currentLocale })}
            </p>
          </div>
          <Button
            onClick={handleCapture}
            disabled={isCapturing}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2 no-screenshot"
          >
            {isCapturing ? (
              <>
                <Download className="h-4 w-4 animate-spin" />
                <span>{t('screenshot.capturing')}</span>
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                <span>{t('screenshot.capture')}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {/* 热量平衡 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calculator className="mr-2 h-5 w-5 text-primary" />
              {t('calorieBalance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 卡路里摄入 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Utensils className="mr-2 h-5 w-5 text-green-500" />
                  <span className="text-lg font-medium">{t('caloriesIn')}</span>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {totalCaloriesConsumed.toFixed(0)} kcal
                </span>
              </div>

              {/* 膳食列表 */}
              {foodEntries.length > 0 ? (
                <div className="space-y-3">
                  {foodEntries.map((entry) => (
                    <FoodEntryCard
                      key={entry.log_id}
                      entry={entry}
                      onDelete={() => {}}
                      onUpdate={() => {}}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  {t('noFoodEntries')}
                </p>
              )}
            </div>

            {/* 运动消耗 */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Flame className="mr-2 h-5 w-5 text-red-500" />
                  <span className="text-lg font-medium">{t('exerciseBurn')}</span>
                </div>
                <span className="text-2xl font-bold text-red-600">
                  {totalCaloriesBurned.toFixed(0)} kcal
                </span>
              </div>

              {/* 运动列表 */}
              {exerciseEntries.length > 0 ? (
                <div className="space-y-3">
                  {exerciseEntries.map((entry) => (
                    <ExerciseEntryCard
                      key={entry.log_id}
                      entry={entry}
                      onDelete={() => {}}
                      onUpdate={() => {}}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  {t('noExerciseEntries')}
                </p>
              )}
            </div>

            {/* 净卡路里 */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {netCalories > 0 ?
                    <TrendingUp className="mr-2 h-5 w-5 text-orange-500" /> :
                    <TrendingDown className="mr-2 h-5 w-5 text-blue-500" />
                  }
                  <span className="text-lg font-medium">{t('netCalories')}</span>
                </div>
                <span className={`text-2xl font-bold ${netCalories > 0 ? "text-orange-500" : "text-blue-500"}`}>
                  {netCalories.toFixed(0)} kcal
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 估算每日能量需求 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="mr-2 h-5 w-5 text-primary" />
              {t('estimatedDailyNeeds')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* BMR */}
            {calculatedBMR && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <BedDouble className="mr-2 h-5 w-5 text-purple-500" />
                  <div>
                    <span className="text-lg font-medium">{t('bmr')}</span>
                    <p className="text-sm text-muted-foreground">{t('bmrDescription')}</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-purple-600">
                  {calculatedBMR.toFixed(0)} kcal
                </span>
              </div>
            )}

            {/* TDEE */}
            {calculatedTDEE && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Target className="mr-2 h-5 w-5 text-indigo-500" />
                  <div>
                    <span className="text-lg font-medium">{t('tdee')}</span>
                    <p className="text-sm text-muted-foreground">{t('tdeeDescription')}</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-indigo-600">
                  {calculatedTDEE.toFixed(0)} kcal
                </span>
              </div>
            )}

            {/* 热量缺口/盈余 */}
            {calorieDifference !== null && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {calorieDifference === 0 ?
                      <Minus className="mr-2 h-5 w-5 text-blue-500" /> :
                      calorieDifference > 0 ?
                        <TrendingDown className="mr-2 h-5 w-5 text-green-600" /> :
                        <TrendingUp className="mr-2 h-5 w-5 text-orange-500" />
                    }
                    <div>
                      <span className="text-lg font-medium">{t('calorieDeficitSurplus')}</span>
                      <p className="text-sm text-muted-foreground">{t('deficitSurplusDescription')}</p>
                    </div>
                  </div>
                  <span className={`text-2xl font-bold ${calorieStatusColor}`}>
                    {calorieStatusText}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <p className="text-sm text-muted-foreground flex items-start">
                <Info className="mr-2 h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{t('estimationNote')}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* TEF、宏量营养素、BMI、体重变化预测 */}
        <Card>
          <CardContent className="space-y-8 pt-6">
            {/* TEF 分析 */}
            <div className="space-y-3">
              <h4 className="text-lg font-medium flex items-center">
                <Zap className="mr-2 h-5 w-5 text-primary" />
                {tDashboard('summary.tef.title')}
              </h4>

              {tefAnalysis ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                      <div className="flex items-center justify-center mb-1">
                        <Flame className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">{tDashboard('summary.tef.baseTEF')}</div>
                      <div className="text-sm font-medium">
                        {tefAnalysis.baseTEF.toFixed(1)} kcal
                      </div>
                      <div className="text-xs text-muted-foreground">({tefAnalysis.baseTEFPercentage.toFixed(1)}%)</div>
                    </div>

                    {tefAnalysis.enhancementMultiplier > 1 ? (
                      <>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                          <div className="flex items-center justify-center mb-1">
                            <Brain className="h-4 w-4 text-purple-500" />
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">增强乘数</div>
                          <div className="text-sm font-medium text-purple-600">×{tefAnalysis.enhancementMultiplier.toFixed(2)}</div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                          <div className="flex items-center justify-center mb-1">
                            <Sparkles className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">{tDashboard('summary.tef.enhancedTEF')}</div>
                          <div className="text-sm font-bold text-emerald-600">{tefAnalysis.enhancedTEF.toFixed(1)} kcal</div>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">{tDashboard('summary.tef.noEnhancement')}</span>
                      </div>
                    )}
                  </div>

                  {tefAnalysis.enhancementFactors.length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground mb-1">{tDashboard('summary.tef.enhancementFactorsLabel')}</p>
                      <div className="flex flex-wrap gap-1">
                        {tefAnalysis.enhancementFactors.map((factor, idx) => (
                          <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{factor}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{tDashboard('summary.tef.noAnalysis')}</p>
              )}
            </div>

            {/* 宏量营养素分布 */}
            {totalMacros > 0 && (
              <div className="space-y-4 border-t pt-6">
                <h4 className="text-lg font-medium flex items-center">
                  <PieChart className="mr-2 h-5 w-5 text-primary" />
                  {tDashboard('summary.macronutrients')}
                </h4>

                {/* 碳水化合物 */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs">{tDashboard('summary.carbohydrates')}</span>
                    <span className="text-xs">
                      {macros.carbs.toFixed(1)}g ({carbsPercent.toFixed(0)}%)
                      {carbsStatus === 'low' && <span className="text-red-500 ml-1">↓低于{MACRO_RANGES.carbs.min}%</span>}
                      {carbsStatus === 'high' && <span className="text-orange-500 ml-1">↑高于{MACRO_RANGES.carbs.max}%</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                    <div className="absolute top-0 h-full bg-sky-500/20 dark:bg-sky-600/20" style={{ left: `${MACRO_RANGES.carbs.min}%`, width: `${MACRO_RANGES.carbs.max - MACRO_RANGES.carbs.min}%` }} />
                    <div className="h-full bg-sky-500 rounded-full relative" style={{ width: `${carbsPercent}%` }} />
                  </div>
                </div>

                {/* 蛋白质 */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs">{tDashboard('summary.protein')}</span>
                    <span className="text-xs">
                      {macros.protein.toFixed(1)}g ({proteinPercent.toFixed(0)}%)
                      {proteinStatus === 'low' && <span className="text-red-500 ml-1">↓低于{MACRO_RANGES.protein.min}%</span>}
                      {proteinStatus === 'high' && <span className="text-orange-500 ml-1">↑高于{MACRO_RANGES.protein.max}%</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                    <div className="absolute top-0 h-full bg-emerald-500/20 dark:bg-emerald-600/20" style={{ left: `${MACRO_RANGES.protein.min}%`, width: `${MACRO_RANGES.protein.max - MACRO_RANGES.protein.min}%` }} />
                    <div className="h-full bg-emerald-500 rounded-full relative" style={{ width: `${proteinPercent}%` }} />
                  </div>
                </div>

                {/* 脂肪 */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs">{tDashboard('summary.fat')}</span>
                    <span className="text-xs">
                      {macros.fat.toFixed(1)}g ({fatPercent.toFixed(0)}%)
                      {fatStatus === 'low' && <span className="text-red-500 ml-1">↓低于{MACRO_RANGES.fat.min}%</span>}
                      {fatStatus === 'high' && <span className="text-orange-500 ml-1">↑高于{MACRO_RANGES.fat.max}%</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                    <div className="absolute top-0 h-full bg-amber-500/20 dark:bg-amber-600/20" style={{ left: `${MACRO_RANGES.fat.min}%`, width: `${MACRO_RANGES.fat.max - MACRO_RANGES.fat.min}%` }} />
                    <div className="h-full bg-amber-500 rounded-full relative" style={{ width: `${fatPercent}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* BMI 指数 */}
            {currentWeight && userProfile.height && (
              <div className="border-t pt-6">
                <BMIIndicator weight={currentWeight} height={userProfile.height} />
              </div>
            )}

            {/* 体重变化预测 */}
            {currentWeight && calculatedTDEE && Math.abs(calorieDifferenceForWeight) > 0 && (
              <div className="border-t pt-6">
                <WeightChangePredictor calorieDifference={calorieDifferenceForWeight} currentWeight={currentWeight} targetWeight={userProfile?.targetWeight} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 智能建议 */}
        {smartSuggestions && smartSuggestions.suggestions && smartSuggestions.suggestions.length > 0 && (
          <Card className="smart-suggestions-card">
            <Collapsible open={isSmartSuggestionsOpen} onOpenChange={setIsSmartSuggestionsOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Brain className="mr-2 h-5 w-5 text-primary" />
                      {t('smartSuggestions')}
                      <span className="ml-2 text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {smartSuggestions.suggestions.reduce((total, category) => total + category.suggestions.length, 0)}
                      </span>
                    </div>
                    {isSmartSuggestionsOpen ?
                      <ChevronUp className="h-5 w-5" /> :
                      <ChevronDown className="h-5 w-5" />
                    }
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* 显示生成时间 */}
                    <div className="text-xs text-muted-foreground mb-4">
                      {t('generatedTime')}: {format(new Date(smartSuggestions.generatedAt), "yyyy/M/d HH:mm:ss")}
                    </div>

                    {/* 按类别显示建议 */}
                    {smartSuggestions.suggestions.map((category, categoryIndex) => (
                      <div key={categoryIndex} className="border rounded-lg p-4">
                        <div className="mb-3">
                          <h4 className="font-medium text-base flex items-center">
                            <span className="mr-2">{category.suggestions[0]?.icon || '💡'}</span>
                            {category.category}
                            <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                              category.priority === 'high' ? 'bg-red-100 text-red-700' :
                              category.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {category.priority === 'high' ? t('priorities.high') :
                               category.priority === 'medium' ? t('priorities.medium') : t('priorities.low')}
                            </span>
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">{category.summary}</p>
                        </div>

                        {/* 具体建议 */}
                        <div className="space-y-2">
                          {category.suggestions.map((suggestion, suggestionIndex) => (
                            <div key={suggestionIndex} className="border-l-2 border-primary/20 pl-3 py-2 bg-muted/30 rounded-r">
                              <div className="flex items-start space-x-2">
                                <span className="text-sm flex-shrink-0">{suggestion.icon}</span>
                                <div className="flex-1">
                                  <h5 className="font-medium text-sm">{suggestion.title}</h5>
                                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                    {suggestion.description}
                                  </p>
                                  {suggestion.actionable && (
                                    <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                      {t('actionable')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* 截图专用Logo区域 - 使用与导航栏一致的绿色主题 */}
        <div className="screenshot-logo-area mt-10 pt-8 border-t border-slate-200/50 dark:border-slate-600/30 text-center">
          <img
            src="/snapifit_summary.svg"
            alt="Snapifit AI Logo"
            className="mx-auto h-16 md:h-24 w-auto select-none opacity-90 hover:opacity-100 transition-opacity duration-300"
            style={{ filter: 'invert(34%) sepia(61%) saturate(504%) hue-rotate(90deg) brightness(95%) contrast(92%)' }}
          />
        </div>
      </div>
    </div>
  )
}

// 主导出组件，用 Suspense 包装
export default function SummaryPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>}>
      <SummaryPageContent params={params} />
    </Suspense>
  )
}
