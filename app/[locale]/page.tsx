"use client"

import type React from "react"

import { useState, useEffect, useRef, use } from "react"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import Link from "next/link"
import { CalendarIcon, X, ImageIcon, Brain, ClipboardPenLine, Utensils, Dumbbell, Weight, Activity, AlertCircle, CheckCircle2, Info, Settings2, UploadCloud, Trash2, Edit3, TrendingUp, TrendingDown, Sigma, Flame, BedDouble, Target, PieChart, ListChecks, Sparkles, Save, CalendarDays, UserCheck, AlertTriangle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import type { FoodEntry, ExerciseEntry, DailyLog, AIConfig, DailyStatus } from "@/lib/types"
import { FoodEntryCard } from "@/components/food-entry-card"
import { ExerciseEntryCard } from "@/components/exercise-entry-card"
import { DailySummary } from "@/components/daily-summary"
import { ManagementCharts } from "@/components/management-charts"
import { SmartSuggestions } from "@/components/smart-suggestions"
import { DailyStatusCard } from "@/components/DailyStatusCard"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useIndexedDB } from "@/hooks/use-indexed-db"
import { useExportReminder } from "@/hooks/use-export-reminder"
import { useDateRecords } from "@/hooks/use-date-records"
import { useIsMobile } from "@/hooks/use-mobile"
import { compressImage } from "@/lib/image-utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { calculateMetabolicRates } from "@/lib/health-utils"
import { generateTEFAnalysis } from "@/lib/tef-utils"
import { tefCacheManager } from "@/lib/tef-cache"
import type { SmartSuggestionsResponse } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/hooks/use-i18n"

// 图片预览类型
interface ImagePreview {
  file: File
  url: string
  compressedFile?: File
}

export default function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslation('dashboard')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // 解包params Promise
  const resolvedParams = use(params)

  // 获取当前语言环境
  const currentLocale = resolvedParams.locale === 'en' ? enUS : zhCN
  const [inputText, setInputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState("food")
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentDayWeight, setCurrentDayWeight] = useState<string>("")
  const [currentDayActivityLevelForSelect, setCurrentDayActivityLevelForSelect] = useState<string>("")
  const [chartRefreshTrigger, setChartRefreshTrigger] = useState<number>(0)
  const [tefAnalysisCountdown, setTEFAnalysisCountdown] = useState(0)
  const [smartSuggestionsLoading, setSmartSuggestionsLoading] = useState(false)

  // 图片上传状态
  const [uploadedImages, setUploadedImages] = useState<ImagePreview[]>([])
  const [isCompressing, setIsCompressing] = useState(false)

  // 使用本地存储钩子获取用户配置
  const [userProfile] = useLocalStorage("userProfile", {
    weight: 70,
    height: 170,
    age: 30,
    gender: "male",
    activityLevel: "moderate",
    goal: "maintain",
    bmrFormula: "mifflin-st-jeor" as "mifflin-st-jeor",
  })

  // 获取AI配置
  const [aiConfig] = useLocalStorage<AIConfig>("aiConfig", {
    agentModel: {
      name: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "",
    },
    chatModel: {
      name: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "",
    },
    visionModel: {
      name: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "",
    },
  })

  // 使用 IndexedDB 钩子获取日志数据
  const { getData: getDailyLog, saveData: saveDailyLog, isLoading } = useIndexedDB("healthLogs")

  // 使用导出提醒Hook
  const exportReminder = useExportReminder()

  // 使用日期记录检查Hook
  const { hasRecord, refreshRecords } = useDateRecords()

  // 使用移动端检测Hook
  const isMobile = useIsMobile()

  const [dailyLog, setDailyLog] = useState<DailyLog>(() => ({
    date: format(selectedDate, "yyyy-MM-dd"),
    foodEntries: [],
    exerciseEntries: [],
    summary: {
      totalCaloriesConsumed: 0,
      totalCaloriesBurned: 0,
      macros: { carbs: 0, protein: 0, fat: 0 },
      micronutrients: {},
    },
    weight: undefined,
    activityLevel: userProfile.activityLevel || "moderate",
    calculatedBMR: undefined,
    calculatedTDEE: undefined,
  }))

  // 当选择的日期变化时，加载对应日期的数据
  useEffect(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd")
    getDailyLog(dateKey).then((data) => {
      console.log("从IndexedDB读取到的数据：", data)
      const defaultActivity = userProfile.activityLevel || "moderate"
      if (data) {
        setDailyLog(data)
        setCurrentDayWeight(data.weight ? data.weight.toString() : "")
        setCurrentDayActivityLevelForSelect(data.activityLevel || defaultActivity)
      } else {
        setDailyLog({
          date: dateKey,
          foodEntries: [],
          exerciseEntries: [],
          summary: {
            totalCaloriesConsumed: 0,
            totalCaloriesBurned: 0,
            macros: { carbs: 0, protein: 0, fat: 0 },
            micronutrients: {},
          },
          weight: undefined,
          activityLevel: defaultActivity,
          calculatedBMR: undefined,
          calculatedTDEE: undefined,
        })
        setCurrentDayWeight("")
        setCurrentDayActivityLevelForSelect(defaultActivity)
      }
    })
  }, [selectedDate, getDailyLog, userProfile.activityLevel])

  // 辅助 useEffect 来监控 dailyLog 状态的变化
  // useEffect(() => {
  //   console.log("[State Monitor] dailyLog state has changed to:", JSON.parse(JSON.stringify(dailyLog)));
  // }, [dailyLog]);

  // TEF 分析功能
  const performTEFAnalysis = async (foodEntries: FoodEntry[]) => {
    if (!foodEntries.length || !checkAIConfig()) return null;

    try {
      const response = await fetch("/api/openai/tef-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-config": JSON.stringify(aiConfig),
        },
        body: JSON.stringify({ foodEntries }),
      });

      if (!response.ok) {
        console.warn("TEF analysis failed:", response.statusText);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn("TEF analysis error:", error);
      return null;
    }
  };

  // 智能建议localStorage存储
  const [smartSuggestions, setSmartSuggestions] = useLocalStorage<Record<string, SmartSuggestionsResponse>>('smartSuggestions', {});

  // 智能建议功能
  const generateSmartSuggestions = async (targetDate?: string) => {
    if (!checkAIConfig()) return;

    const analysisDate = targetDate || dailyLog.date;
    const targetLog = targetDate ? await getDailyLog(targetDate) : dailyLog;

    if (!targetLog || targetLog.foodEntries.length === 0) {
      console.warn("No data available for smart suggestions on", analysisDate);
      return;
    }

    setSmartSuggestionsLoading(true);
    try {
      // 获取目标日期前7天的数据
      const recentLogs = [];
      const targetDateObj = new Date(analysisDate);
      for (let i = 0; i < 7; i++) {
        const date = new Date(targetDateObj);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const log = await getDailyLog(dateKey);
        if (log && log.foodEntries.length > 0) {
          recentLogs.push(log);
        }
      }

      const response = await fetch("/api/openai/smart-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-config": JSON.stringify(aiConfig),
        },
        body: JSON.stringify({
          dailyLog: targetLog,
          userProfile,
          recentLogs
        }),
      });

      if (!response.ok) {
        console.warn("Smart suggestions failed:", response.statusText);
        return;
      }

      const suggestions = await response.json();

      // 保存到localStorage
      const newSuggestions = { ...smartSuggestions };
      newSuggestions[analysisDate] = suggestions as SmartSuggestionsResponse;
      setSmartSuggestions(newSuggestions);

    } catch (error) {
      console.warn("Smart suggestions error:", error);
    } finally {
      setSmartSuggestionsLoading(false);
    }
  };

  // TEF 分析防抖定时器
  const tefAnalysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 用于跟踪食物条目的实际内容变化
  const previousFoodEntriesHashRef = useRef<string>('');

  // 当食物条目变化时，使用防抖机制重新分析TEF
  useEffect(() => {
    const currentHash = tefCacheManager.generateFoodEntriesHash(dailyLog.foodEntries);

    // 检查是否已有缓存的分析结果
    const cachedAnalysis = tefCacheManager.getCachedAnalysis(dailyLog.foodEntries);
    if (cachedAnalysis && dailyLog.foodEntries.length > 0) {
      // 使用缓存的分析结果
      if (!dailyLog.tefAnalysis || JSON.stringify(dailyLog.tefAnalysis) !== JSON.stringify(cachedAnalysis)) {
        console.log('Applying cached TEF analysis');
        setDailyLog(currentLog => {
          const updatedLog = {
            ...currentLog,
            tefAnalysis: cachedAnalysis
          };
          saveDailyLog(updatedLog.date, updatedLog);
          return updatedLog;
        });
      }
      previousFoodEntriesHashRef.current = currentHash;
      return;
    }

    // 检查是否需要重新分析
    if (!tefCacheManager.shouldAnalyzeTEF(dailyLog.foodEntries, previousFoodEntriesHashRef.current)) {
      return;
    }

    // 更新哈希引用
    previousFoodEntriesHashRef.current = currentHash;

    console.log('Food entries changed significantly, starting TEF analysis countdown...');

    // 清除之前的定时器
    if (tefAnalysisTimeoutRef.current) {
      clearTimeout(tefAnalysisTimeoutRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // 只有当有食物条目时才设置分析
    if (dailyLog.foodEntries.length > 0) {
      // 开始倒计时
      setTEFAnalysisCountdown(15);

      // 每秒更新倒计时
      countdownIntervalRef.current = setInterval(() => {
        setTEFAnalysisCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // 设置15秒的防抖延迟
      tefAnalysisTimeoutRef.current = setTimeout(() => {
        console.log('Starting TEF analysis after 15 seconds delay...');
        setTEFAnalysisCountdown(0);
        performTEFAnalysis(dailyLog.foodEntries).then(tefResult => {
          if (tefResult) {
            // 使用本地工具计算基础TEF，并结合AI分析的乘数和因素
            const localTEFAnalysis = generateTEFAnalysis(
              dailyLog.foodEntries,
              tefResult.enhancementMultiplier
            );

            const finalAnalysis = {
              ...localTEFAnalysis,
              // 使用AI分析的因素，如果AI没有提供则使用本地识别的
              enhancementFactors: tefResult.enhancementFactors && tefResult.enhancementFactors.length > 0
                ? tefResult.enhancementFactors
                : localTEFAnalysis.enhancementFactors,
              analysisTimestamp: tefResult.analysisTimestamp || localTEFAnalysis.analysisTimestamp,
            };

            // 缓存分析结果
            tefCacheManager.setCachedAnalysis(dailyLog.foodEntries, finalAnalysis);

            console.log('AI enhancementFactors:', tefResult.enhancementFactors);
            console.log('Local enhancementFactors:', localTEFAnalysis.enhancementFactors);

            setDailyLog(currentLog => {
              const updatedLog = {
                ...currentLog,
                tefAnalysis: finalAnalysis
              };
              saveDailyLog(updatedLog.date, updatedLog);
              return updatedLog;
            });
          }
        }).catch(error => {
          console.warn('TEF analysis failed:', error);
        });
      }, 15000); // 15秒
    } else {
      // 如果没有食物条目，清除TEF分析和倒计时
      setTEFAnalysisCountdown(0);
      if (dailyLog.tefAnalysis) {
        setDailyLog(currentLog => {
          const updatedLog = { ...currentLog, tefAnalysis: undefined };
          saveDailyLog(updatedLog.date, updatedLog);
          return updatedLog;
        });
      }
    }

    // 清理函数
    return () => {
      if (tefAnalysisTimeoutRef.current) {
        clearTimeout(tefAnalysisTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [dailyLog.foodEntries, aiConfig, saveDailyLog]);

  // 当日期变化时，检查是否有该日期的智能建议
  useEffect(() => {
    const currentDateSuggestions = smartSuggestions[dailyLog.date];

    // 如果当前日期没有建议，且有足够的数据，可以提示用户生成建议
    if (!currentDateSuggestions && dailyLog.foodEntries.length > 0 && checkAIConfig()) {
      console.log(`No smart suggestions found for ${dailyLog.date}, user can generate new ones`);
    }
  }, [dailyLog.date, smartSuggestions, dailyLog.foodEntries.length]);

  // 当用户配置或每日日志（特别是体重、日期和活动水平）变化时，重新计算BMR和TDEE
  useEffect(() => {
    if (userProfile && dailyLog.date) {
      // 计算额外的TEF增强
      const additionalTEF = dailyLog.tefAnalysis
        ? dailyLog.tefAnalysis.enhancedTEF - dailyLog.tefAnalysis.baseTEF
        : undefined;

      const rates = calculateMetabolicRates(userProfile, {
        weight: dailyLog.weight,
        activityLevel: dailyLog.activityLevel,
        additionalTEF
      })

      const newBmr = rates?.bmr;
      const newTdee = rates?.tdee;

      if (
        dailyLog.calculatedBMR !== newBmr ||
        dailyLog.calculatedTDEE !== newTdee ||
        (rates && !dailyLog.calculatedBMR && !dailyLog.calculatedTDEE)
      ) {
        setDailyLog(currentLogState => {
          const updatedLogWithNewRates = {
            ...currentLogState,
            calculatedBMR: newBmr,
            calculatedTDEE: newTdee,
          };
          // 只有在实际值发生变化时才保存，避免不必要的写入
          if (currentLogState.calculatedBMR !== newBmr || currentLogState.calculatedTDEE !== newTdee || (rates && (!currentLogState.calculatedBMR || !currentLogState.calculatedTDEE))){
            saveDailyLog(updatedLogWithNewRates.date, updatedLogWithNewRates);
          }
          return updatedLogWithNewRates;
        });
      }
    }
  }, [userProfile, dailyLog.date, dailyLog.weight, dailyLog.activityLevel, dailyLog.tefAnalysis, saveDailyLog, dailyLog.calculatedBMR, dailyLog.calculatedTDEE]); // Added dependencies

  // 处理每日活动水平变化
  const handleDailyActivityLevelChange = (newValue: string) => {
    setCurrentDayActivityLevelForSelect(newValue);
    setDailyLog(prevLog => ({
      ...prevLog,
      activityLevel: newValue,
    }));
    // 触发图表刷新（因为活动水平影响TDEE计算）
    setChartRefreshTrigger(prev => prev + 1);
  };

  // 检查AI配置是否完整
  const checkAIConfig = () => {
    const modelType = uploadedImages.length > 0 ? "visionModel" : "agentModel"
    const modelConfig = aiConfig[modelType]

    if (!modelConfig.name || !modelConfig.baseUrl || !modelConfig.apiKey) {
      toast({
        title: (
          <span className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
            {t('errors.aiConfigIncomplete')}
          </span>
        ),
        description: t('errors.configureModelFirst', {
          modelType: uploadedImages.length > 0 ? t('modelTypes.vision') : t('modelTypes.work')
        }),
        variant: "destructive",
      })
      return false
    }
    return true
  }

  // 处理图片上传
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (uploadedImages.length + files.length > 5) {
      toast({
        title: (
          <span className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
            {t('errors.imageCountExceeded')}
          </span>
        ),
        description: t('errors.maxImagesAllowed'),
        variant: "destructive",
      })
      return
    }

    setIsCompressing(true)

    try {
      const newImages: ImagePreview[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        if (!file.type.startsWith("image/")) {
          toast({
            title: (
              <span className="flex items-center">
                <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
                {t('errors.invalidFileType')}
              </span>
            ),
            description: t('errors.notImageFile', { fileName: file.name }),
            variant: "destructive",
          })
          continue
        }

        const previewUrl = URL.createObjectURL(file)
        const compressedFile = await compressImage(file, 500 * 1024) // 500KB

        newImages.push({
          file,
          url: previewUrl,
          compressedFile,
        })
      }

      setUploadedImages((prev) => [...prev, ...newImages])
    } catch (error) {
      console.error("Error processing images:", error)
      toast({
        title: (
          <span className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
            {t('errors.imageProcessingFailed')}
          </span>
        ),
        description: t('errors.cannotProcessImages'),
        variant: "destructive",
      })
    } finally {
      setIsCompressing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // 删除已上传的图片
  const handleRemoveImage = (index: number) => {
    setUploadedImages((prev) => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].url)
      newImages.splice(index, 1)
      return newImages
    })
  }

  // 处理提交（文本+可能的图片）
  const handleSubmit = async () => {
    if (!inputText.trim() && uploadedImages.length === 0) {
      toast({
        title: (
          <span className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
            {t('errors.emptyInput')}
          </span>
        ),
        description: t('errors.enterTextOrUpload'),
        variant: "destructive",
      })
      return
    }

    if (!checkAIConfig()) return

    setIsProcessing(true)
    try {
      let result
      const effectiveWeight = dailyLog.weight || userProfile.weight

      if (uploadedImages.length > 0) {
        const formData = new FormData()
        formData.append("text", inputText)
        formData.append("type", activeTab)
        formData.append("userWeight", effectiveWeight.toString())
        formData.append("aiConfig", JSON.stringify(aiConfig))
        uploadedImages.forEach((img, index) => {
          formData.append(`image${index}`, img.compressedFile || img.file)
        })

        const response = await fetch("/api/openai/parse-with-images", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "解析失败" }))
          throw new Error(errorData.message || "解析失败")
        }
        result = await response.json()
      } else {
        const response = await fetch("/api/openai/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ai-config": JSON.stringify(aiConfig),
          },
          body: JSON.stringify({
            text: inputText,
            type: activeTab,
            userWeight: effectiveWeight,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "解析失败" }))
          throw new Error(errorData.message || "解析失败")
        }
        result = await response.json()
      }

      const updatedLog = { ...dailyLog }

      if (activeTab === "food" && result.food) {
        updatedLog.foodEntries = [...updatedLog.foodEntries, ...result.food]
        recalculateSummary(updatedLog)
      } else if (activeTab === "exercise" && result.exercise) {
        updatedLog.exerciseEntries = [...updatedLog.exerciseEntries, ...result.exercise]
        recalculateSummary(updatedLog)
      }

      setDailyLog(updatedLog)
      saveDailyLog(updatedLog.date, updatedLog)
      // 触发图表刷新
      setChartRefreshTrigger(prev => prev + 1)
      // 刷新日期记录状态
      refreshRecords()

      setInputText("")
      setUploadedImages([])

      toast({
        title: (
          <span className="flex items-center">
            <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
            {t('success.recordAdded')}
          </span>
        ),
        description: activeTab === "food" ? t('success.foodAdded') : t('success.exerciseAdded'),
      })
    } catch (error: any) {
      console.error("Error:", error)
      toast({
        title: (
          <span className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
            处理失败
          </span>
        ),
        description: error.message || "无法解析您的输入，请重试。",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // 删除条目
  const handleDeleteEntry = (id: string, type: "food" | "exercise") => {
    const updatedLog = { ...dailyLog }

    if (type === "food") {
      updatedLog.foodEntries = updatedLog.foodEntries.filter((entry) => entry.log_id !== id)
    } else {
      updatedLog.exerciseEntries = updatedLog.exerciseEntries.filter((entry) => entry.log_id !== id)
    }

    recalculateSummary(updatedLog)
    setDailyLog(updatedLog)
    saveDailyLog(updatedLog.date, updatedLog)
    // 触发图表刷新
    setChartRefreshTrigger(prev => prev + 1)
    // 刷新日期记录状态
    refreshRecords()

    toast({
      title: (
        <span className="flex items-center">
          <Trash2 className="mr-2 h-5 w-5 text-green-500" />
          {t('success.recordDeleted')}
        </span>
      ),
      description: type === "food" ? t('success.foodDeleted') : t('success.exerciseDeleted'),
    })
  }

  // 更新条目
  const handleUpdateEntry = (updatedEntry: FoodEntry | ExerciseEntry, type: "food" | "exercise") => {
    const updatedLog = { ...dailyLog }

    if (type === "food") {
      updatedLog.foodEntries = updatedLog.foodEntries.map((entry) =>
        entry.log_id === (updatedEntry as FoodEntry).log_id ? (updatedEntry as FoodEntry) : entry,
      )
    } else {
      updatedLog.exerciseEntries = updatedLog.exerciseEntries.map((entry) =>
        entry.log_id === (updatedEntry as ExerciseEntry).log_id ? (updatedEntry as ExerciseEntry) : entry,
      )
    }

    recalculateSummary(updatedLog)
    setDailyLog(updatedLog)
    saveDailyLog(updatedLog.date, updatedLog)
    // 触发图表刷新
    setChartRefreshTrigger(prev => prev + 1)
    // 刷新日期记录状态
    refreshRecords()

    toast({
      title: (
        <span className="flex items-center">
          <Edit3 className="mr-2 h-5 w-5 text-green-500" />
          {t('success.recordUpdated')}
        </span>
      ),
      description: type === "food" ? t('success.foodUpdated') : t('success.exerciseUpdated'),
    })
  }

  const recalculateSummary = (log: DailyLog) => {
    let totalCaloriesConsumed = 0
    let totalCarbs = 0
    let totalProtein = 0
    let totalFat = 0
    let totalCaloriesBurned = 0
    const micronutrients: Record<string, number> = {}

    log.foodEntries.forEach((entry) => {
      if (entry.total_nutritional_info_consumed) {
        totalCaloriesConsumed += entry.total_nutritional_info_consumed.calories || 0
        totalCarbs += entry.total_nutritional_info_consumed.carbohydrates || 0
        totalProtein += entry.total_nutritional_info_consumed.protein || 0
        totalFat += entry.total_nutritional_info_consumed.fat || 0
        Object.entries(entry.total_nutritional_info_consumed).forEach(([key, value]) => {
          if (!["calories", "carbohydrates", "protein", "fat"].includes(key) && typeof value === "number") {
            micronutrients[key] = (micronutrients[key] || 0) + value
          }
        })
      }
    })

    log.exerciseEntries.forEach((entry) => {
      totalCaloriesBurned += entry.calories_burned_estimated || 0
    })

    log.summary = {
      totalCaloriesConsumed,
      totalCaloriesBurned,
      macros: { carbs: totalCarbs, protein: totalProtein, fat: totalFat },
      micronutrients,
    }
  }

  const handleSaveDailyWeight = () => {
    const dateKey = format(selectedDate, "yyyy-MM-dd")
    if (!currentDayWeight.trim()) {
      const updatedLog = { ...dailyLog, weight: undefined }
      setDailyLog(updatedLog)
      saveDailyLog(dateKey, updatedLog)
      // 刷新日期记录状态
      refreshRecords()
      toast({
        title: <span className="flex items-center"><Info className="mr-2 h-5 w-5" />{t('success.weightCleared')}</span>,
        description: t('success.weightClearedDesc', { date: dateKey })
      })
      return
    }

    const weightValue = parseFloat(currentDayWeight)
    if (isNaN(weightValue) || weightValue <= 0) {
      toast({
        title: <span className="flex items-center"><AlertCircle className="mr-2 h-5 w-5 text-destructive" />{t('validation.invalidWeight')}</span>,
        description: t('validation.invalidWeightDesc'),
        variant: "destructive"
      })
      return
    }

    const updatedLog = { ...dailyLog, weight: weightValue }
    setDailyLog(updatedLog)
    saveDailyLog(dateKey, updatedLog)
    // 触发图表刷新
    setChartRefreshTrigger(prev => prev + 1)
    // 刷新日期记录状态
    refreshRecords()
    toast({
      title: <span className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />{t('success.weightSaved')}</span>,
      description: t('success.weightSavedDesc', { date: dateKey, weight: weightValue })
    })
  }

  // 处理每日状态保存
  const handleSaveDailyStatus = (status: DailyStatus) => {
    const dateKey = format(selectedDate, "yyyy-MM-dd")
    const updatedLog = { ...dailyLog, dailyStatus: status }
    setDailyLog(updatedLog)
    saveDailyLog(dateKey, updatedLog)
    // 刷新日期记录状态
    refreshRecords()
    toast({
      title: <span className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />每日状态已保存</span>,
      description: `已保存 ${dateKey} 的状态记录`
    })
  }

  return (
    <div className="min-h-screen relative bg-white dark:bg-slate-900">
      {/* 弥散绿色背景效果 - 带动画 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-40 top-20 w-96 h-96 bg-emerald-300/40 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -right-40 top-40 w-80 h-80 bg-emerald-400/35 rounded-full blur-3xl animate-bounce-slow"></div>
        <div className="absolute left-20 bottom-20 w-72 h-72 bg-emerald-200/45 rounded-full blur-3xl animate-breathing"></div>
        <div className="absolute right-32 bottom-40 w-64 h-64 bg-emerald-300/40 rounded-full blur-3xl animate-float"></div>
        <div className="absolute left-1/2 top-1/3 w-56 h-56 bg-emerald-200/30 rounded-full blur-3xl transform -translate-x-1/2 animate-glow"></div>
      </div>

      <style jsx>{`
        @keyframes breathing {
          0%, 100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.1) rotate(2deg);
            opacity: 0.25;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px) scale(1);
          }
          33% {
            transform: translateY(-10px) translateX(5px) scale(1.05);
          }
          66% {
            transform: translateY(5px) translateX(-3px) scale(0.98);
          }
        }

        @keyframes glow {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.3;
          }
          50% {
            transform: translateX(-50%) scale(1.2);
            opacity: 0.15;
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0px) scale(1);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-15px) scale(1.08);
            opacity: 0.50;
          }
        }

        .animate-breathing {
          animation: breathing 6s ease-in-out infinite;
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        .animate-glow {
          animation: glow 5s ease-in-out infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 7s ease-in-out infinite;
        }
      `}</style>
      <div className="relative z-10 container mx-auto py-12 px-6 sm:px-8 lg:px-12 max-w-6xl">
        <header className="mb-16 fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
            <div className="flex items-center space-x-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
                <img
                  src="/placeholder.svg"
                  alt="SnapFit AI Logo"
                  className="w-10 h-10 object-contain filter invert"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight mb-2">
                  SnapFit AI
                </h1>
                <p className="text-muted-foreground text-lg">
                  {t('ui.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex flex-col gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full sm:w-[280px] justify-start text-left font-normal text-base h-12"
                    >
                      <CalendarDays className="mr-3 h-5 w-5 text-primary" />
                      {format(selectedDate, "PPP (eeee)", { locale: currentLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      locale={currentLocale}
                      hasRecord={hasRecord}
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <Settings2 className="h-3 w-3" />
                    <Link
                      href={`/${resolvedParams.locale}/settings?tab=ai`}
                      className="hover:text-primary transition-colors underline-offset-2 hover:underline"
                    >
                      {t('ui.quickConfig')}
                    </Link>
                    <span>/</span>
                    <Link
                      href={`/${resolvedParams.locale}/settings?tab=data`}
                      className="hover:text-primary transition-colors underline-offset-2 hover:underline"
                    >
                      {t('ui.dataExport')}
                    </Link>
                  </div>

                  {/* 导出提醒 */}
                  {exportReminder.shouldRemind && exportReminder.hasEnoughData && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      <span>
                        {exportReminder.lastExportDate === null
                          ? t('ui.neverExported')
                          : t('ui.exportReminder', { days: exportReminder.daysSinceLastExport })
                        }
                      </span>
                      <Clock className="h-3 w-3 ml-1" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 新布局：左侧图表，右侧体重和活动水平 */}
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧：管理图表 (占2列) */}
            <div className="lg:col-span-2">
              <ManagementCharts selectedDate={selectedDate} refreshTrigger={chartRefreshTrigger} />
            </div>

            {/* 右侧：体重和活动水平 (占1列) */}
            <div className="space-y-8">
              <div className="health-card p-8 space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
                    <Weight className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{t('ui.todayWeight')}</h3>
                    <p className="text-muted-foreground">{t('ui.recordWeightChanges')}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Input
                    id="daily-weight"
                    type="number"
                    placeholder={t('placeholders.weightExample')}
                    value={currentDayWeight}
                    onChange={(e) => setCurrentDayWeight(e.target.value)}
                    className="w-full h-12 text-base"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveDailyWeight()
                        // 聚焦到活动水平选择器
                        const activitySelect = document.getElementById('daily-activity-level')
                        if (activitySelect) {
                          activitySelect.click()
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={handleSaveDailyWeight}
                    disabled={isProcessing}
                    className="btn-gradient-primary w-full h-12"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {t('ui.saveWeight')}
                  </Button>
                </div>
              </div>

              <div className="health-card p-8 space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{t('ui.activityLevel')}</h3>
                    <p className="text-muted-foreground">{t('ui.setTodayActivity')}</p>
                  </div>
                </div>
                <Select
                  value={currentDayActivityLevelForSelect}
                  onValueChange={(value) => {
                    handleDailyActivityLevelChange(value)
                    // 选择完活动水平后，聚焦到输入区域
                    setTimeout(() => {
                      const textarea = document.querySelector('textarea')
                      if (textarea) {
                        textarea.focus()
                      }
                    }, 100)
                  }}
                >
                  <SelectTrigger className="w-full h-12 text-base" id="daily-activity-level">
                    <SelectValue placeholder={t('ui.selectActivityLevel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">{t('activityLevels.sedentary')}</SelectItem>
                    <SelectItem value="light">{t('activityLevels.light')}</SelectItem>
                    <SelectItem value="moderate">{t('activityLevels.moderate')}</SelectItem>
                    <SelectItem value="active">{t('activityLevels.active')}</SelectItem>
                    <SelectItem value="very_active">{t('activityLevels.very_active')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </header>

        {/* 输入区域 */}
        <div className="health-card mb-16 slide-up">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
                  <ClipboardPenLine className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">{t('ui.recordHealthData')}</h2>
                  <p className="text-muted-foreground text-lg">{t('ui.recordHealthDataDesc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isMobile && <span className="text-sm text-muted-foreground">今日记录</span>}
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {(() => {
                    let count = 0
                    if (dailyLog.foodEntries.length > 0) count++
                    if (dailyLog.exerciseEntries.length > 0) count++
                    if (dailyLog.dailyStatus) count++
                    return `${count}/3`
                  })()}
                </span>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
              <TabsList className="grid w-full grid-cols-3 h-14">
                <TabsTrigger value="food" className="text-base py-4 px-8">
                  <Utensils className="mr-2 h-5 w-5" />{t('ui.dietRecord')}
                </TabsTrigger>
                <TabsTrigger value="exercise" className="text-base py-4 px-8">
                  <Dumbbell className="mr-2 h-5 w-5" />{t('ui.exerciseRecord')}
                </TabsTrigger>
                <TabsTrigger value="status" className="text-base py-4 px-8">
                  <Activity className="mr-2 h-5 w-5" />{t('ui.dailyStatus')}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-6">
              {activeTab === "status" ? (
                <DailyStatusCard
                  date={format(selectedDate, "yyyy-MM-dd")}
                  initialStatus={dailyLog.dailyStatus}
                  onSave={handleSaveDailyStatus}
                />
              ) : (
                <Textarea
                  placeholder={
                    activeTab === "food"
                      ? t('placeholders.foodExample')
                      : t('placeholders.exerciseExample')
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="min-h-[140px] text-base p-6 rounded-xl"
                />
              )}

              {activeTab !== "status" && uploadedImages.length > 0 && (
                <div className="p-6 rounded-xl bg-muted/30 border">
                  <p className="text-muted-foreground mb-4 flex items-center font-medium">
                    <ImageIcon className="mr-2 h-5 w-5" /> {t('images.uploaded', { count: uploadedImages.length })}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-white dark:border-slate-700 shadow-md hover:shadow-lg transition-all group">
                        <img
                          src={img.url || "/placeholder.svg"}
                          alt={`预览 ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 shadow-lg"
                          aria-label="删除图片"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab !== "status" && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-6">
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isProcessing || isCompressing || uploadedImages.length >= 5}
                    ref={fileInputRef}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    size="lg"
                    disabled={isProcessing || isCompressing || uploadedImages.length >= 5}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-12 px-6"
                  >
                    <UploadCloud className="mr-2 h-5 w-5" />
                    {isCompressing ? t('buttons.imageProcessing') : `${t('buttons.uploadImages')} (${uploadedImages.length}/5)`}
                  </Button>
                  {uploadedImages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => setUploadedImages([])}
                      className="text-destructive hover:text-destructive h-12"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> {t('buttons.clearImages')}
                    </Button>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  size="lg"
                  className="btn-gradient-primary w-full sm:w-auto px-12 h-12 text-base"
                  disabled={isProcessing || isCompressing || (!inputText.trim() && uploadedImages.length === 0)}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('buttons.processing')}
                    </>
                  ) : (
                    <>
                      {activeTab === "food" ? <Utensils className="mr-2 h-5 w-5" /> : <Dumbbell className="mr-2 h-5 w-5" />}
                      {t('buttons.submitRecord')}
                    </>
                  )}
                </Button>
              </div>
              )}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-16 fade-in">
            <div className="flex justify-center items-center mb-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-200 dark:border-emerald-800"></div>
                <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
              </div>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">{t('loading.dataLoading')}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          <div className="health-card scale-in">
            <div className="p-8">
              <div className="flex items-center space-x-4 mb-8">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
                  <Utensils className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold">{t('ui.myMeals')}</h3>
                  <p className="text-muted-foreground text-lg">{t('ui.todayFoodCount', { count: dailyLog.foodEntries.length })}</p>
                </div>
              </div>

              {dailyLog.foodEntries.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50">
                    <Utensils className="h-10 w-10" />
                  </div>
                  <p className="text-xl font-medium mb-3">{t('ui.noFoodRecords')}</p>
                  <p className="text-lg opacity-75">{t('ui.addFoodAbove')}</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                  {dailyLog.foodEntries.map((entry) => (
                    <FoodEntryCard
                      key={entry.log_id}
                      entry={entry}
                      onDelete={() => handleDeleteEntry(entry.log_id, "food")}
                      onUpdate={(updated) => handleUpdateEntry(updated, "food")}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="health-card scale-in">
            <div className="p-8">
              <div className="flex items-center space-x-4 mb-8">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold">{t('ui.myExercise')}</h3>
                  <p className="text-muted-foreground text-lg">{t('ui.todayExerciseCount', { count: dailyLog.exerciseEntries.length })}</p>
                </div>
              </div>

              {dailyLog.exerciseEntries.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50">
                    <Dumbbell className="h-10 w-10" />
                  </div>
                  <p className="text-xl font-medium mb-3">{t('ui.noExerciseRecords')}</p>
                  <p className="text-lg opacity-75">{t('ui.addExerciseAbove')}</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                  {dailyLog.exerciseEntries.map((entry) => (
                    <ExerciseEntryCard
                      key={entry.log_id}
                      entry={entry}
                      onDelete={() => handleDeleteEntry(entry.log_id, "exercise")}
                      onUpdate={(updated) => handleUpdateEntry(updated, "exercise")}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="scale-in">
            <DailySummary
              summary={dailyLog.summary}
              calculatedBMR={dailyLog.calculatedBMR}
              calculatedTDEE={dailyLog.calculatedTDEE}
              tefAnalysis={dailyLog.tefAnalysis}
              tefAnalysisCountdown={tefAnalysisCountdown}
              selectedDate={selectedDate}
            />
          </div>
          <div className="scale-in">
            <SmartSuggestions
              suggestions={smartSuggestions[dailyLog.date]}
              isLoading={smartSuggestionsLoading}
              onRefresh={() => generateSmartSuggestions(dailyLog.date)}
              currentDate={dailyLog.date}
            />
          </div>
        </div>

        {/* 免责声明 */}
        <div className="mt-12 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
          <div className="text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              本应用基于AI技术，仅为您提供健康管理参考。请注意：AI分析可能存在偏差，特别是营养数据方面。您的健康很重要，在做出重要的饮食或运动决策前，建议咨询专业的医生、营养师或健身教练。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
