"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { TrendingUp, Weight, Utensils, Dumbbell, Target, Calendar } from "lucide-react"
import { format, subDays, parseISO, eachDayOfInterval } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useIndexedDB } from "@/hooks/use-indexed-db"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/hooks/use-i18n"

interface ChartData {
  date: string
  weight?: number
  caloriesIn?: number
  caloriesOut?: number
  calorieDeficit?: number
}

interface ManagementChartsProps {
  selectedDate: Date
  refreshTrigger?: number
}

type DateRange = '7d' | '14d' | '30d' | '90d'

interface DateRangeOption {
  value: DateRange
  label: string
  days: number
}

export function ManagementCharts({ selectedDate, refreshTrigger }: ManagementChartsProps) {
  const t = useTranslation('dashboard.charts')
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUsingMockData, setIsUsingMockData] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('7d')
  const [isDataOptimized, setIsDataOptimized] = useState(false)
  const [realDataCount, setRealDataCount] = useState(0)
  const { getData: getDailyLog, isInitializing: dbInitializing } = useIndexedDB("healthLogs")

  // 日期范围选项
  const dateRangeOptions: DateRangeOption[] = [
    { value: '7d', label: t('dateRanges.7d'), days: 7 },
    { value: '14d', label: t('dateRanges.14d'), days: 14 },
    { value: '30d', label: t('dateRanges.30d'), days: 30 },
    { value: '90d', label: t('dateRanges.90d'), days: 90 },
  ]

  useEffect(() => {
    // 等待 IndexedDB 初始化完成后再获取数据
    if (!dbInitializing) {
      const timer = setTimeout(() => {
        fetchChartData()
      }, 100) // 减少延迟时间

      return () => clearTimeout(timer)
    }
  }, [selectedDate, refreshTrigger, dbInitializing, getDailyLog, dateRange])

  const fetchChartData = async () => {
    setIsLoading(true)
    try {
      // 根据选择的日期范围获取数据
      const selectedRange = dateRangeOptions.find(option => option.value === dateRange)
      const daysToFetch = selectedRange?.days || 7
      const data: ChartData[] = []

      for (let i = daysToFetch - 1; i >= 0; i--) {
        const date = subDays(selectedDate, i)
        const dateStr = format(date, 'yyyy-MM-dd')

        try {
          const dailyLog = await getDailyLog(dateStr)

          // 为每一天都创建一个条目，即使没有数据
          const chartEntry: ChartData = {
            date: format(date, 'MM/dd', { locale: zhCN }),
            weight: dailyLog?.weight !== undefined ? dailyLog.weight : undefined,
            caloriesIn: Math.round(dailyLog?.summary?.totalCaloriesConsumed || 0),
            caloriesOut: Math.round(dailyLog?.summary?.totalCaloriesBurned || 0),
            calorieDeficit: Math.round(
              (dailyLog?.summary?.totalCaloriesConsumed || 0) -
              (dailyLog?.summary?.totalCaloriesBurned || 0) -
              (dailyLog?.calculatedTDEE || 1800)
            )
          }

          data.push(chartEntry)
        } catch (error) {
          // 即使出错也添加一个空数据点，保持图表连续性
          console.warn(`获取 ${dateStr} 数据失败:`, error)
          data.push({
            date: format(date, 'MM/dd', { locale: zhCN }),
            weight: undefined,
            caloriesIn: 0,
            caloriesOut: 0,
            calorieDeficit: -1800
          })
        }
      }

      // 检查是否有任何真实数据
      const hasRealData = data.some(entry =>
        entry.weight !== undefined || entry.caloriesIn > 0 || entry.caloriesOut > 0
      )

      if (hasRealData) {
        // 计算有效数据点的数量
        const realDataCount = data.filter(entry =>
          entry.weight !== undefined || entry.caloriesIn > 0 || entry.caloriesOut > 0
        ).length

        // 智能调整显示策略
        const optimizedData = optimizeDataForDisplay(data, realDataCount)
        const isOptimized = optimizedData.length < data.length

        console.log(`✅ 图表显示真实数据，共 ${optimizedData.length} 天，有效数据 ${realDataCount} 天 (${dateRange}):`, optimizedData)
        setIsUsingMockData(false)
        setIsDataOptimized(isOptimized)
        setRealDataCount(realDataCount)
        setChartData(optimizedData)
      } else {
        console.log(`❌ 没有找到真实数据，使用模拟数据 (${dateRange})`)
        setIsUsingMockData(true)
        generateMockData()
      }
    } catch (error) {
      console.error('获取图表数据失败:', error)
      setIsUsingMockData(true)
      generateMockData()
    } finally {
      setIsLoading(false)
    }
  }





  // 智能优化数据显示策略
  const optimizeDataForDisplay = (data: ChartData[], realDataCount: number): ChartData[] => {
    // 如果有效数据点很少，调整显示策略
    if (realDataCount <= 3) {
      // 只显示有数据的天数及其前后各一天，最少显示5天
      const dataWithRealValues = data.filter(entry =>
        entry.weight !== undefined || entry.caloriesIn > 0 || entry.caloriesOut > 0
      )

      if (dataWithRealValues.length === 0) return data

      // 找到第一个和最后一个有数据的索引
      const firstRealIndex = data.findIndex(entry =>
        entry.weight !== undefined || entry.caloriesIn > 0 || entry.caloriesOut > 0
      )
      const lastRealIndex = data.findLastIndex(entry =>
        entry.weight !== undefined || entry.caloriesIn > 0 || entry.caloriesOut > 0
      )

      // 计算显示范围，确保至少显示5天
      const minDisplayDays = 5
      const actualSpan = lastRealIndex - firstRealIndex + 1
      const displaySpan = Math.max(minDisplayDays, actualSpan + 2) // 前后各留一天

      const startIndex = Math.max(0, firstRealIndex - Math.floor((displaySpan - actualSpan) / 2))
      const endIndex = Math.min(data.length - 1, startIndex + displaySpan - 1)

      return data.slice(startIndex, endIndex + 1)
    }

    // 如果有效数据点较少（少于选择范围的1/3），建议更短的时间范围
    const selectedRange = dateRangeOptions.find(option => option.value === dateRange)
    const totalDays = selectedRange?.days || 7

    if (realDataCount < totalDays / 3) {
      // 数据稀疏，只显示有数据的区间
      const firstRealIndex = data.findIndex(entry =>
        entry.weight !== undefined || entry.caloriesIn > 0 || entry.caloriesOut > 0
      )
      const lastRealIndex = data.findLastIndex(entry =>
        entry.weight !== undefined || entry.caloriesIn > 0 || entry.caloriesOut > 0
      )

      if (firstRealIndex !== -1 && lastRealIndex !== -1) {
        // 显示从第一个数据点到最后一个数据点的区间，前后各留1-2天
        const padding = Math.min(2, Math.floor(totalDays * 0.1))
        const startIndex = Math.max(0, firstRealIndex - padding)
        const endIndex = Math.min(data.length - 1, lastRealIndex + padding)

        return data.slice(startIndex, endIndex + 1)
      }
    }

    // 数据充足，返回原始数据
    return data
  }
  const generateMockData = () => {
    const selectedRange = dateRangeOptions.find(option => option.value === dateRange)
    const daysToGenerate = selectedRange?.days || 7
    const data: ChartData[] = []

    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const date = subDays(selectedDate, i)
      const weight = 70 + Math.sin(i * 0.1) * 2 + Math.random() * 1 - 0.5
      const caloriesIn = 1800 + Math.random() * 600
      const caloriesOut = 300 + Math.random() * 400
      const calorieDeficit = caloriesIn - caloriesOut - 1800 // 假设TDEE为1800

      data.push({
        date: format(date, 'MM/dd', { locale: zhCN }),
        weight: Number(weight.toFixed(1)),
        caloriesIn: Number(caloriesIn.toFixed(0)),
        caloriesOut: Number(caloriesOut.toFixed(0)),
        calorieDeficit: Number(calorieDeficit.toFixed(0))
      })
    }
    setChartData(data)
  }

  const formatTooltipValue = (value: number, name: string) => {
    switch (name) {
      case 'weight':
        return [`${value} kg`, t('weight')]
      case 'caloriesIn':
        return [`${value} kcal`, t('caloriesIn')]
      case 'caloriesOut':
        return [`${value} kcal`, t('caloriesOut')]
      case 'calorieDeficit':
        return [`${value > 0 ? '+' : ''}${value} kcal`, value > 0 ? t('calorieSurplus') : t('calorieDeficit')]
      default:
        return [value, name]
    }
  }

  // 自定义X轴标签格式化函数
  const formatXAxisLabel = (tickItem: string) => {
    // tickItem 格式是 'MM/dd'，我们需要转换为完整日期来获取星期
    const currentYear = new Date().getFullYear()
    const [month, day] = tickItem.split('/')
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day))

    // 根据日期范围和数据量调整显示格式
    if ((dateRange === '7d' || dateRange === '14d') || chartData.length <= 10) {
      // 短期范围或数据点少时显示星期
      const weekday = format(date, 'eee', { locale: zhCN })
      return `${tickItem}\n${weekday}`
    } else {
      // 长期范围只显示日期
      return tickItem
    }
  }

  // 动态计算X轴间隔
  const getXAxisInterval = () => {
    if (chartData.length <= 5) return 0 // 5个点以下显示所有
    if (chartData.length <= 10) return 'preserveStartEnd' // 10个点以下保持首尾
    if (dateRange === '90d') return 'preserveStartEnd'
    return 'preserveStartEnd'
  }

  if (isLoading) {
    return (
      <div className="health-card">
        <div className="p-8">
          <div className="flex items-center space-x-4 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">{t('title')}</h3>
              <p className="text-muted-foreground text-lg">{t('description', { days: '30日' })}</p>
            </div>
          </div>
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">{t('loadingCharts')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="health-card">
      <div className="p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">{t('title')}</h3>
              <p className="text-muted-foreground text-lg">
                {isUsingMockData
                  ? t('demoDescription')
                  : t('description', { days: `${dateRangeOptions.find(opt => opt.value === dateRange)?.label}` })
                }
              </p>
              {isDataOptimized && !isUsingMockData && (
                <p className="text-sm text-amber-600 mt-1">
                  {t('optimizedDisplay', { count: realDataCount })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
              <SelectTrigger className="w-[120px] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>



        <Tabs defaultValue="weight" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-14">
            <TabsTrigger value="weight" className="text-base py-4 px-4">
              <Weight className="mr-2 h-4 w-4" />
              {t('weight')}
            </TabsTrigger>
            <TabsTrigger value="calories" className="text-base py-4 px-4">
              <Utensils className="mr-2 h-4 w-4" />
              {t('calories')}
            </TabsTrigger>
            <TabsTrigger value="exercise" className="text-base py-4 px-4">
              <Dumbbell className="mr-2 h-4 w-4" />
              {t('exercise')}
            </TabsTrigger>
            <TabsTrigger value="deficit" className="text-base py-4 px-4">
              <Target className="mr-2 h-4 w-4" />
              {t('deficit')}
            </TabsTrigger>
          </TabsList>

          <div className="mt-8 relative">
            {/* 图表内容 */}
            <div className={isUsingMockData ? 'blur-sm' : ''}>
              <TabsContent value="weight" className="space-y-4">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 11,
                          angle: dateRange === '90d' ? -90 : -45,
                          textAnchor: 'end'
                        }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        interval={getXAxisInterval()}
                        minTickGap={chartData.length <= 5 ? 10 : (dateRange === '90d' ? 20 : 35)}
                        height={(dateRange === '7d' || dateRange === '14d') || chartData.length <= 10 ? 70 : 50}
                        tickFormatter={formatXAxisLabel}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        domain={[(dataMin: number) => Math.max(0, dataMin - 2), (dataMax: number) => dataMax + 2]}
                      />
                      <Tooltip
                        formatter={formatTooltipValue}
                        labelStyle={{ color: '#64748b' }}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="calories" className="space-y-4">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 11,
                          angle: dateRange === '90d' ? -90 : -45,
                          textAnchor: 'end'
                        }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        interval={getXAxisInterval()}
                        minTickGap={chartData.length <= 5 ? 10 : (dateRange === '90d' ? 20 : 35)}
                        height={(dateRange === '7d' || dateRange === '14d') || chartData.length <= 10 ? 70 : 50}
                        tickFormatter={formatXAxisLabel}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        domain={['dataMin', 'dataMax']}
                      />
                      <Tooltip
                        formatter={formatTooltipValue}
                        labelStyle={{ color: '#64748b' }}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="caloriesIn"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                        name="卡路里摄入"
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="exercise" className="space-y-4">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 11,
                          angle: dateRange === '90d' ? -90 : -45,
                          textAnchor: 'end'
                        }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        interval={getXAxisInterval()}
                        minTickGap={chartData.length <= 5 ? 10 : (dateRange === '90d' ? 20 : 35)}
                        height={(dateRange === '7d' || dateRange === '14d') || chartData.length <= 10 ? 70 : 50}
                        tickFormatter={formatXAxisLabel}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        domain={['dataMin', 'dataMax']}
                      />
                      <Tooltip
                        formatter={formatTooltipValue}
                        labelStyle={{ color: '#64748b' }}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="caloriesOut"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="deficit" className="space-y-4">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 11,
                          angle: dateRange === '90d' ? -90 : -45,
                          textAnchor: 'end'
                        }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        interval={getXAxisInterval()}
                        minTickGap={chartData.length <= 5 ? 10 : (dateRange === '90d' ? 20 : 35)}
                        height={(dateRange === '7d' || dateRange === '14d') || chartData.length <= 10 ? 70 : 50}
                        tickFormatter={formatXAxisLabel}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        domain={['dataMin - 100', 'dataMax + 100']}
                      />
                      <Tooltip
                        formatter={formatTooltipValue}
                        labelStyle={{ color: '#64748b' }}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="calorieDeficit"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </div>

            {/* 模拟数据覆盖层 - 确保在最上层且清晰显示 */}
            {isUsingMockData && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg">
                <div className="text-center p-8 max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="text-xl font-bold text-foreground mb-3">
                    {t('startRecording')}
                  </h4>
                  <p className="text-base text-muted-foreground mb-4 leading-relaxed">
                    {t('recordingPrompt')}
                  </p>
                  <div className="text-sm text-muted-foreground/80 bg-muted/50 px-3 py-2 rounded-lg">
                    {t('demoDataNote')}
                  </div>
                </div>
              </div>
            )}


          </div>
        </Tabs>
      </div>
    </div>
  )
}
