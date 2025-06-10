"use client"

import type React from "react"

import { useState, useEffect, useRef, use, useCallback } from "react"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import Link from "next/link"
import { CalendarIcon, X, ImageIcon, Brain, ClipboardPenLine, Utensils, Dumbbell, Weight, Activity, AlertCircle, CheckCircle2, Info, Settings2, UploadCloud, Trash2, Edit3, TrendingUp, TrendingDown, Sigma, Flame, BedDouble, Target, PieChart, ListChecks, Sparkles, Save, CalendarDays, UserCheck, AlertTriangle, Clock, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useUsageLimit } from "@/hooks/use-usage-limit"
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
import { useSync } from '@/hooks/use-sync';
import { v4 as uuidv4 } from 'uuid';

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
  const { refreshUsageInfo } = useUsageLimit()
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
      source: "shared", // 默认使用共享模型
    },
    chatModel: {
      name: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "",
      source: "shared", // 默认使用共享模型
    },
    visionModel: {
      name: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "",
      source: "shared", // 默认使用共享模型
    },
    sharedKey: {
      selectedKeyIds: [],
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

  // 集成云同步钩子
  const { pushData, removeEntry, pullData, syncAll, isSyncing } = useSync();

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

  // 创建一个包装函数，用于更新本地状态和数据库
  const setDailyLogAndSave = (newLog: DailyLog) => {
    setDailyLog(newLog);
    saveDailyLog(newLog.date, newLog);
  }

  // 创建一个用于部分更新和同步的函数
  const updateLogAndPush = (patch: Partial<DailyLog>) => {
    const date = dailyLog.date;

    // 1. 更新本地状态
    setDailyLog(prevLog => {
      const newLog = { ...prevLog, ...patch };
      // 2. 保存完整的最新日志到本地IndexedDB
      saveDailyLog(date, newLog);
      return newLog;
    });

    // 3. 将补丁推送到云端
    pushData(date, patch);
  };

  // 封装加载日志的逻辑，以便重用
  const loadDailyLog = useCallback((date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    getDailyLog(dateKey).then((data) => {
      console.log("从IndexedDB为日期加载数据:", dateKey, data);
      const defaultActivity = userProfile.activityLevel || "moderate";
      if (data) {
        setDailyLog(data);
        setCurrentDayWeight(data.weight ? data.weight.toString() : "");
        setCurrentDayActivityLevelForSelect(data.activityLevel || defaultActivity);
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
        });
        setCurrentDayWeight("");
        setCurrentDayActivityLevelForSelect(defaultActivity);
      }
    });
  }, [getDailyLog, userProfile.activityLevel]);

  // 当选择的日期变化时，加载对应日期的数据
  useEffect(() => {
    loadDailyLog(selectedDate);
  }, [selectedDate, loadDailyLog]);

  // 监听强制数据刷新事件（删除操作后触发）
  useEffect(() => {
    const handleForceRefresh = (event: CustomEvent) => {
      const { date } = event.detail;
      const eventDate = format(new Date(date), "yyyy-MM-dd");
      const currentDate = format(selectedDate, "yyyy-MM-dd");

      if (eventDate === currentDate) {
        console.log(`[Page] Force refreshing data for ${currentDate}`);
        loadDailyLog(selectedDate);
      }
    };

    window.addEventListener('forceDataRefresh', handleForceRefresh as EventListener);

    return () => {
      window.removeEventListener('forceDataRefresh', handleForceRefresh as EventListener);
    };
  }, [selectedDate, loadDailyLog]);

  // 订阅缓存更新事件，用于在缓存被刷新后自动更新UI
  useEffect(() => {
    const handleCacheChange = () => {
      console.log('缓存已更新，正在重新加载UI...');
      // 重新加载当前日期的数据
      loadDailyLog(selectedDate);
    };

    // 订阅
    const unsubscribe = tefCacheManager.subscribe(handleCacheChange);

    // 组件卸载时取消订阅
    return () => {
      unsubscribe();
    };
  }, [loadDailyLog, selectedDate]);

  // TEF 分析功能
  const performTEFAnalysis = async (foodEntries: FoodEntry[]) => {
    if (!foodEntries.length) return null;

    try {
      const response = await fetch("/api/openai/tef-analysis-shared", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foodEntries,
          aiConfig // 添加AI配置
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429 && errorData.code === 'LIMIT_EXCEEDED') {
          const details = errorData.details || {}
          const currentUsage = details.currentUsage || '未知'
          const dailyLimit = details.dailyLimit || '未知'
          console.warn("TEF analysis failed: Daily limit exceeded");
          toast({
            title: "TEF分析失败",
            description: `今日AI使用次数已达上限 (${currentUsage}/${dailyLimit})，请明天再试或提升信任等级`,
            variant: "destructive",
          });
        } else if (response.status === 401) {
          console.warn("TEF analysis failed: Authentication required");
        } else {
          console.warn("TEF analysis failed:", response.statusText);
        }
        return null;
      }

      const result = await response.json();

      // 🔄 TEF分析成功后刷新使用量信息，确保所有组件同步
      console.log('[TEF Analysis] Refreshing usage info after successful analysis')
      refreshUsageInfo()

      return result;
    } catch (error) {
      console.warn("TEF analysis error:", error);
      return null;
    }
  };

  // 智能建议localStorage存储
  const [smartSuggestions, setSmartSuggestions] = useLocalStorage<Record<string, SmartSuggestionsResponse>>('smartSuggestions', {});

  // 智能建议功能
  const generateSmartSuggestions = async (targetDate?: string) => {
    const analysisDate = targetDate || dailyLog.date;
    const targetLog = targetDate ? await getDailyLog(targetDate) : dailyLog;

    if (!targetLog || (targetLog.foodEntries?.length === 0 && targetLog.exerciseEntries?.length === 0)) {
      console.warn("No data available for smart suggestions on", analysisDate);
      // 可选：在这里给用户一个提示
      toast({
        title: t('smartSuggestions.noData.title'),
        description: t('smartSuggestions.noData.description', { date: analysisDate }),
        variant: "default",
      })
      return;
    }

    setSmartSuggestionsLoading(true);
    try {
      // 获取目标日期前7天的数据
      const recentLogs = [];
      const targetDateObj = new Date(analysisDate);
      for (let i = 1; i <= 7; i++) { // 从前一天开始
        const date = new Date(targetDateObj);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const log = await getDailyLog(dateKey);
        if (log && (log.foodEntries?.length > 0 || log.exerciseEntries?.length > 0)) {
          recentLogs.push(log);
        }
      }

      const response = await fetch("/api/openai/smart-suggestions-shared", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dailyLog: targetLog,
          userProfile,
          recentLogs,
          aiConfig, // 添加AI配置
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429 && errorData.code === 'LIMIT_EXCEEDED') {
          // 🚫 限额超过
          const details = errorData.details || {};
          toast({
            title: "智能建议生成失败",
            description: `今日AI使用次数已达上限 (${details.currentUsage}/${details.dailyLimit})，请明天再试或提升信任等级`,
            variant: "destructive",
          });
        } else if (response.status === 401 && errorData.code === 'UNAUTHORIZED') {
          toast({
            title: "智能建议生成失败",
            description: "请先登录后再使用AI功能",
            variant: "destructive",
          });
        } else {
          console.warn("Smart suggestions failed:", response.statusText, errorData);
          toast({
            title: t('smartSuggestions.error.title'),
            description: errorData.error || t('smartSuggestions.error.description'),
            variant: "destructive",
          });
        }
        return;
      }

      const suggestions = await response.json();

      // 保存到localStorage
      const newSuggestions = { ...smartSuggestions };
      newSuggestions[analysisDate] = suggestions as SmartSuggestionsResponse;
      setSmartSuggestions(newSuggestions);

      // 🔄 智能建议生成成功后刷新使用量信息，确保所有组件同步
      console.log('[Smart Suggestions] Refreshing usage info after successful generation')
      refreshUsageInfo()

      toast({
        title: t('smartSuggestions.success.title'),
        description: t('smartSuggestions.success.description', { date: analysisDate }),
        variant: "default",
      })

    } catch (error) {
      console.warn("Smart suggestions error:", error);
       toast({
        title: t('smartSuggestions.unknownError.title'),
        description: t('smartSuggestions.unknownError.description'),
        variant: "destructive",
      })
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
            tefAnalysis: cachedAnalysis,
            last_modified: new Date().toISOString(),
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
                tefAnalysis: finalAnalysis,
                last_modified: new Date().toISOString(),
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
          const updatedLog = { ...currentLog, tefAnalysis: undefined, last_modified: new Date().toISOString() };
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
  }, [dailyLog.foodEntries, aiConfig, saveDailyLog, getDailyLog, userProfile]);

  // 当日期变化时，检查是否有该日期的智能建议
  useEffect(() => {
    const currentDateSuggestions = smartSuggestions[dailyLog.date];

    // 如果当前日期没有建议，且有足够的数据，可以提示用户生成建议
    if (currentDateSuggestions && dailyLog.foodEntries?.length > 0 && checkAIConfig()) {
      console.log(`No smart suggestions found for ${dailyLog.date}, user can generate new ones`);
    }
  }, [dailyLog.date, smartSuggestions, dailyLog.foodEntries?.length]);

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
            last_modified: new Date().toISOString(),
          };
          // 只有在实际值发生变化时才保存，避免不必要的写入
          if (currentLogState.calculatedBMR !== newBmr || currentLogState.calculatedTDEE !== newTdee || (rates && (!currentLogState.calculatedBMR || !currentLogState.calculatedTDEE))){
            saveDailyLog(updatedLogWithNewRates.date, updatedLogWithNewRates);
            return updatedLogWithNewRates;
          }
          return updatedLogWithNewRates;
        });
      }
    }
  }, [userProfile, dailyLog.date, dailyLog.weight, dailyLog.activityLevel, dailyLog.tefAnalysis, saveDailyLog, dailyLog.calculatedBMR, dailyLog.calculatedTDEE]);

  // 处理每日活动水平变化
  const handleDailyActivityLevelChange = (newValue: string) => {
    setCurrentDayActivityLevelForSelect(newValue)
    const rates = calculateMetabolicRates(userProfile, {
      weight: dailyLog.weight,
      activityLevel: newValue
    })

    const patch: Partial<DailyLog> = { activityLevel: newValue };
    if (rates) {
      patch.calculatedBMR = rates.bmr;
      patch.calculatedTDEE = rates.tdee;
    }
    updateLogAndPush(patch);

    toast({
      title: t('handleDailyActivityLevelChange.success.title'),
      description: t('handleDailyActivityLevelChange.success.description', { level: newValue }),
      variant: "default",
    })
  };

  // 检查AI配置是否完整
  const checkAIConfig = () => {
    const modelType = uploadedImages.length > 0 ? "visionModel" : "agentModel"
    const modelConfig = aiConfig[modelType]

    // 如果使用共享模型，只需要检查source字段
    if (modelConfig.source === 'shared') {
      return true // 共享模型不需要用户配置API Key
    }

    // 如果使用私有配置，需要检查完整的配置
    if (!modelConfig.name || !modelConfig.baseUrl || !modelConfig.apiKey) {
      toast({
        title: t('errors.aiConfigIncomplete'),
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
        title: t('errors.imageCountExceeded'),
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
            title: t('errors.invalidFileType'),
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
        title: t('errors.imageProcessingFailed'),
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
    if (isProcessing) return
    setIsProcessing(true)
    if (!checkAIConfig()) {
      setIsProcessing(false);
      return;
    }

    try {
      const endpoint = uploadedImages.length > 0 ? "/api/openai/parse-with-images" : "/api/openai/parse-shared";

      let body: string | FormData;
      const headers: HeadersInit = {};

      if (uploadedImages.length > 0) {
        const formData = new FormData();
        formData.append("text", inputText);
        formData.append("lang", resolvedParams.locale);
        formData.append("type", activeTab);
        formData.append("userWeight", userProfile.weight.toString());
        formData.append("aiConfig", JSON.stringify(aiConfig));

        uploadedImages.forEach((img, index) => {
          formData.append(`image${index}`, img.compressedFile || img.file);
        });

        body = formData;
      } else {
        body = JSON.stringify({
          text: inputText,
          lang: resolvedParams.locale,
          type: activeTab,
          userWeight: userProfile.weight,
          aiConfig: aiConfig, // 添加AI配置
        });
        headers["Content-Type"] = "application/json; charset=utf-8";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429 && errorData.code === 'LIMIT_EXCEEDED') {
          // 🚫 限额超过
          const details = errorData.details || {};
          throw new Error(`今日AI使用次数已达上限 (${details.currentUsage}/${details.dailyLimit})，请明天再试或提升信任等级`);
        } else if (response.status === 401 && errorData.code === 'UNAUTHORIZED') {
          throw new Error('请先登录后再使用AI功能');
        } else if (response.status === 503 && errorData.code === 'SHARED_KEYS_EXHAUSTED') {
          // 🚫 共享密钥耗尽
          throw new Error(errorData.error || '共享AI服务暂时不可用，所有密钥已达到每日使用限制。请稍后重试或联系管理员。');
        } else if (errorData.error && typeof errorData.error === 'string') {
          throw new Error(errorData.error);
        } else {
          throw new Error(`服务器错误 (${response.status})，请稍后重试`);
        }
      }

      const result = await response.json()
      if (result.error) {
        throw new Error(result.error)
      }

      const newFoodEntries: FoodEntry[] = (result.food || []).map((entry: any) => ({
        ...entry,
        log_id: uuidv4(), // 强制生成一个新的唯一ID
      }));
      const newExerciseEntries: ExerciseEntry[] = (result.exercise || []).map((entry: any) => ({
        ...entry,
        log_id: uuidv4(), // 强制生成一个新的唯一ID
      }));

      // 使用函数式更新来确保我们基于最新的状态进行修改
      setDailyLog(prevLog => {
        const updatedLog = {
          ...prevLog,
          foodEntries: [...prevLog.foodEntries, ...newFoodEntries],
          exerciseEntries: [...prevLog.exerciseEntries, ...newExerciseEntries],
        };
        const finalLog = recalculateSummary(updatedLog);

        // 增量更新: 将所有相关的更改合并到一个补丁中
        const patch: Partial<DailyLog> = {
          foodEntries: finalLog.foodEntries,
          exerciseEntries: finalLog.exerciseEntries,
          summary: finalLog.summary,
        };

        // 直接保存和推送，避免嵌套的setDailyLog调用
        saveDailyLog(finalLog.date, finalLog);
        pushData(finalLog.date, patch);

        return finalLog;
      });

      setInputText("")
      setUploadedImages([]) // 清空上传的图片
      toast({
        title: t('handleSubmit.success.title'),
        description: t('handleSubmit.success.description', { foodCount: newFoodEntries.length, exerciseCount: newExerciseEntries.length }),
        variant: "default",
      })
    } catch (error: any) {
      toast({
        title: t('handleSubmit.error.title'),
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteEntry = async (id: string, type: "food" | "exercise") => {
    try {
      // 🗑️ 使用新的安全删除函数 - 转换日期格式
      const dateString = format(selectedDate, "yyyy-MM-dd");
      await removeEntry(dateString, type, id);

      // 本地立即更新UI（removeEntry已经处理了本地删除）
      const updatedLog = { ...dailyLog };

      if (type === "food") {
        updatedLog.foodEntries = updatedLog.foodEntries.filter((entry) => entry.log_id !== id);
      } else {
        updatedLog.exerciseEntries = updatedLog.exerciseEntries.filter((entry) => entry.log_id !== id);
      }

      // 重新计算汇总并更新本地状态
      const finalLog = recalculateSummary(updatedLog);
      setDailyLog(finalLog);

      // 🔄 删除成功后，延迟触发一次数据拉取，确保其他设备能同步
      setTimeout(() => {
        console.log('[Delete] Triggering data pull to ensure sync across devices');
        pullData(false).catch(error => {
          console.warn('[Delete] Post-delete sync failed:', error);
        });
      }, 500);

      toast({
        title: t('handleDeleteEntry.success.title'),
        description: t('handleDeleteEntry.success.description'),
        variant: "default",
      });
    } catch (error) {
      console.error('Delete entry error:', error);
      toast({
        title: t('handleDeleteEntry.error.title') || 'Delete Failed',
        description: t('handleDeleteEntry.error.description') || 'Failed to delete entry',
        variant: "destructive",
      });
    }
  }

  const handleUpdateEntry = (updatedEntry: FoodEntry | ExerciseEntry, type: "food" | "exercise") => {
    let patch: Partial<DailyLog> = {};
    const updatedLog = { ...dailyLog };

    if (type === "food") {
      updatedLog.foodEntries = updatedLog.foodEntries.map((entry) =>
        entry.log_id === (updatedEntry as FoodEntry).log_id ? (updatedEntry as FoodEntry) : entry
      );
      patch = { foodEntries: updatedLog.foodEntries };
    } else {
      updatedLog.exerciseEntries = updatedLog.exerciseEntries.map((entry) =>
        entry.log_id === (updatedEntry as ExerciseEntry).log_id ? (updatedEntry as ExerciseEntry) : entry
      );
      patch = { exerciseEntries: updatedLog.exerciseEntries };
    }

    const finalLog = recalculateSummary(updatedLog);
    patch.summary = finalLog.summary;

    updateLogAndPush(patch);

    toast({
      title: t('handleUpdateEntry.success.title'),
      description: t('handleUpdateEntry.success.description'),
      variant: "default",
    })
  }

  const recalculateSummary = (log: DailyLog): DailyLog => {
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

    const newSummary = {
      totalCaloriesConsumed,
      totalCaloriesBurned,
      macros: { carbs: totalCarbs, protein: totalProtein, fat: totalFat },
      micronutrients,
    }

    return { ...log, summary: newSummary }
  }

  const handleSaveDailyWeight = () => {
    const newWeight = parseFloat(currentDayWeight)
    if (isNaN(newWeight) || newWeight <= 0) {
      toast({
        title: t('handleSaveDailyWeight.error.title'),
        description: t('handleSaveDailyWeight.error.description'),
        variant: "destructive",
      })
      return
    }

    const rates = calculateMetabolicRates(userProfile, {
      weight: newWeight,
      activityLevel: dailyLog.activityLevel
    });

    const patch: Partial<DailyLog> = { weight: newWeight };
    if (rates) {
      patch.calculatedBMR = rates.bmr;
      patch.calculatedTDEE = rates.tdee;
    }

    updateLogAndPush(patch);

    toast({
      title: t('handleSaveDailyWeight.success.title'),
      description: t('handleSaveDailyWeight.success.description', { weight: newWeight }),
      variant: "default",
    })
  }

  // 处理每日状态保存
  const handleSaveDailyStatus = (status: DailyStatus) => {
    const patch = { dailyStatus: status };
    updateLogAndPush(patch);
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
      <div className="relative z-10 container mx-auto py-6 md:py-12 px-4 md:px-6 lg:px-12 max-w-6xl">
        <header className="mb-8 md:mb-16 fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 md:gap-8">
            <div className="flex items-center space-x-4 md:space-x-6">
              <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
                <img
                  src="/placeholder.svg"
                  alt="SnapFit AI Logo"
                  className="w-8 h-8 md:w-10 md:h-10 object-contain filter invert"
                />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-1 md:mb-2">
                  SnapFit AI
                </h1>
                <p className="text-muted-foreground text-base md:text-lg">
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
                  {/* 刷新按钮 - 移动端右对齐，桌面端与日历左边对齐 */}
                  <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <button
                      onClick={() => {
                        console.log('[Manual Sync] User triggered manual sync');
                        syncAll(true).then(() => {
                          toast({
                            title: "同步完成",
                            description: "数据已从云端更新",
                            variant: "default",
                          });
                        }).catch((error) => {
                          console.error('[Manual Sync] Failed:', error);
                          toast({
                            title: "同步失败",
                            description: "请检查网络连接",
                            variant: "destructive",
                          });
                        });
                      }}
                      disabled={isSyncing}
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:text-green-400 dark:disabled:text-green-600 transition-colors disabled:cursor-not-allowed underline-offset-2 hover:underline"
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          {t('ui.refreshing')}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          {t('ui.refresh')}
                        </>
                      )}
                    </button>
                    <span>/</span>
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

          {/* 桌面端：左侧图表，右侧体重和活动水平 */}
          <div className="mt-8 md:mt-12 hidden lg:grid lg:grid-cols-3 gap-8">
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
                    <p className="text-base text-muted-foreground">{t('ui.recordWeightChanges')}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Input
                    id="daily-weight-desktop"
                    type="number"
                    placeholder={t('placeholders.weightExample')}
                    value={currentDayWeight}
                    onChange={(e) => setCurrentDayWeight(e.target.value)}
                    className="w-full h-12 text-base"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveDailyWeight()
                        // 聚焦到活动水平选择器
                        const activitySelect = document.getElementById('daily-activity-level-desktop')
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
                    <p className="text-base text-muted-foreground">{t('ui.setTodayActivity')}</p>
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
                  <SelectTrigger className="w-full h-12 text-base" id="daily-activity-level-desktop">
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

          {/* 移动端：使用Tabs布局 */}
          <div className="mt-6 lg:hidden">
            <Tabs defaultValue="daily" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12">
                <TabsTrigger value="daily" className="text-sm py-3 px-4">
                  <UserCheck className="mr-2 h-4 w-4" />
                  {t('ui.todayData')}
                </TabsTrigger>
                <TabsTrigger value="charts" className="text-xs py-3 px-4">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {t('ui.dataCharts')}
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="daily" className="space-y-6">
                  {/* 体重记录 */}
                  <div className="health-card p-4 space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white">
                        <Weight className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold">{t('ui.todayWeight')}</h3>
                        <p className="text-sm text-muted-foreground">{t('ui.recordWeightChanges')}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Input
                        id="daily-weight-mobile"
                        type="number"
                        placeholder={t('placeholders.weightExample')}
                        value={currentDayWeight}
                        onChange={(e) => setCurrentDayWeight(e.target.value)}
                        className="w-full h-11 text-base"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveDailyWeight()
                            // 聚焦到活动水平选择器
                            const activitySelect = document.getElementById('daily-activity-level-mobile')
                            if (activitySelect) {
                              activitySelect.click()
                            }
                          }
                        }}
                      />
                      <Button
                        onClick={handleSaveDailyWeight}
                        disabled={isProcessing}
                        className="btn-gradient-primary w-full h-11"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {t('ui.saveWeight')}
                      </Button>
                    </div>
                  </div>

                  {/* 活动水平 */}
                  <div className="health-card p-4 space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold">{t('ui.activityLevel')}</h3>
                        <p className="text-sm text-muted-foreground">{t('ui.setTodayActivity')}</p>
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
                      <SelectTrigger className="w-full h-11 text-base" id="daily-activity-level-mobile">
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
                </TabsContent>

                <TabsContent value="charts">
                  <ManagementCharts selectedDate={selectedDate} refreshTrigger={chartRefreshTrigger} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </header>

        {/* 输入区域 */}
        <div className="health-card mb-8 md:mb-16 slide-up">
          <div className="p-4 md:p-8">
            <div className="mb-6 md:mb-8">
              {/* 移动端：标题和计数器在同一行 */}
              <div className="flex items-center justify-between mb-4 md:hidden">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white">
                    <ClipboardPenLine className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl font-semibold">{t('ui.recordHealthData')}</h2>
                </div>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {(() => {
                    let count = 0
                    if (dailyLog.foodEntries?.length > 0) count++
                    if (dailyLog.exerciseEntries?.length > 0) count++
                    if (dailyLog.dailyStatus) count++
                    return `${count}/3`
                  })()}
                </span>
              </div>

              {/* 移动端：描述文字单独一行 */}
              <div className="md:hidden">
                <p className="text-muted-foreground text-sm ml-13">{t('ui.recordHealthDataDesc')}</p>
              </div>

              {/* 桌面端：保持原有布局 */}
              <div className="hidden md:flex md:items-center justify-between">
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
                  <span className="text-sm text-muted-foreground">{t('ui.todayRecords')}</span>
                  <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {(() => {
                      let count = 0
                      if (dailyLog.foodEntries?.length > 0) count++
                      if (dailyLog.exerciseEntries?.length > 0) count++
                      if (dailyLog.dailyStatus) count++
                      return `${count}/3`
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6 md:mb-8">
              <TabsList className="grid w-full grid-cols-3 h-12 md:h-14">
                <TabsTrigger value="food" className="text-sm md:text-base py-3 md:py-4 px-2 md:px-8">
                  <Utensils className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden sm:inline">{t('ui.dietRecord')}</span>
                  <span className="sm:hidden">{t('ui.diet')}</span>
                </TabsTrigger>
                <TabsTrigger value="exercise" className="text-sm md:text-base py-3 md:py-4 px-2 md:px-8">
                  <Dumbbell className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden sm:inline">{t('ui.exerciseRecord')}</span>
                  <span className="sm:hidden">{t('ui.exercise')}</span>
                </TabsTrigger>
                <TabsTrigger value="status" className="text-sm md:text-base py-3 md:py-4 px-2 md:px-8">
                  <Activity className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden sm:inline">{t('ui.dailyStatus')}</span>
                  <span className="sm:hidden">{t('ui.status')}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4 md:space-y-6">
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
                  className={`min-h-[120px] md:min-h-[140px] p-4 md:p-6 rounded-xl ${isMobile ? 'text-sm' : 'text-base'}`}
                />
              )}

              {activeTab !== "status" && uploadedImages.length > 0 && (
                <div className="p-4 md:p-6 rounded-xl bg-muted/30 border">
                  <p className="text-muted-foreground mb-3 md:mb-4 flex items-center font-medium text-sm md:text-base">
                    <ImageIcon className="mr-2 h-4 w-4 md:h-5 md:w-5" /> {t('images.uploaded', { count: uploadedImages.length })}
                  </p>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 border-white dark:border-slate-700 shadow-md hover:shadow-lg transition-all group">
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
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 md:gap-6 pt-4 md:pt-6">
                <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 w-full sm:w-auto">
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
                    size={isMobile ? "default" : "lg"}
                    disabled={isProcessing || isCompressing || uploadedImages.length >= 5}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto h-11 md:h-12 px-4 md:px-6"
                  >
                    <UploadCloud className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                    <span className="text-sm md:text-base">
                      {isCompressing ? t('buttons.imageProcessing') : `${t('buttons.uploadImages')} (${uploadedImages.length}/5)`}
                    </span>
                  </Button>
                  {uploadedImages.length > 0 && (
                    <Button
                      variant="ghost"
                      size={isMobile ? "default" : "lg"}
                      onClick={() => setUploadedImages([])}
                      className="w-full sm:w-auto text-destructive hover:text-destructive h-11 md:h-12"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span className="text-sm md:text-base">{t('buttons.clearImages')}</span>
                    </Button>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  size={isMobile ? "default" : "lg"}
                  className="btn-gradient-primary w-full sm:w-auto px-8 md:px-12 h-11 md:h-12 text-sm md:text-base"
                  disabled={isProcessing || isCompressing || (!inputText.trim() && uploadedImages.length === 0)}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 md:h-5 md:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('buttons.processing')}
                    </>
                  ) : (
                    <>
                      {activeTab === "food" ? <Utensils className="mr-2 h-4 w-4 md:h-5 md:w-5" /> : <Dumbbell className="mr-2 h-4 w-4 md:h-5 md:w-5" />}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12 mb-8 md:mb-16">
          <div className="health-card scale-in">
            <div className="p-4 md:p-8">
              <div className="flex items-center space-x-3 md:space-x-4 mb-6 md:mb-8">
                <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary text-white">
                  <Utensils className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold">{t('ui.myMeals')}</h3>
                  <p className="text-muted-foreground text-sm md:text-lg">{t('ui.todayFoodCount', { count: dailyLog.foodEntries?.length || 0 })}</p>
                </div>
              </div>

              {(dailyLog.foodEntries?.length || 0) === 0 ? (
                <div className="text-center py-12 md:py-16 text-muted-foreground">
                  <div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-2xl bg-muted/50">
                    <Utensils className="h-8 w-8 md:h-10 md:w-10" />
                  </div>
                  <p className="text-lg md:text-xl font-medium mb-2 md:mb-3">{t('ui.noFoodRecords')}</p>
                  <p className="text-sm md:text-lg opacity-75">{t('ui.addFoodAbove')}</p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4 max-h-[400px] md:max-h-[500px] overflow-y-auto custom-scrollbar pr-1 md:pr-2">
                  {(dailyLog.foodEntries || []).map((entry) => (
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
            <div className="p-4 md:p-8">
              <div className="flex items-center space-x-3 md:space-x-4 mb-6 md:mb-8">
                <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary text-white">
                  <Dumbbell className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold">{t('ui.myExercise')}</h3>
                  <p className="text-muted-foreground text-sm md:text-lg">{t('ui.todayExerciseCount', { count: dailyLog.exerciseEntries?.length || 0 })}</p>
                </div>
              </div>

              {(dailyLog.exerciseEntries?.length || 0) === 0 ? (
                <div className="text-center py-12 md:py-16 text-muted-foreground">
                  <div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-2xl bg-muted/50">
                    <Dumbbell className="h-8 w-8 md:h-10 md:w-10" />
                  </div>
                  <p className="text-lg md:text-xl font-medium mb-2 md:mb-3">{t('ui.noExerciseRecords')}</p>
                  <p className="text-sm md:text-lg opacity-75">{t('ui.addExerciseAbove')}</p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4 max-h-[400px] md:max-h-[500px] overflow-y-auto custom-scrollbar pr-1 md:pr-2">
                  {(dailyLog.exerciseEntries || []).map((entry) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
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
        <div className="mt-8 md:mt-12 pt-4 md:pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
          <div className="text-center">
            <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 leading-relaxed px-4">
              {t('ui.healthDisclaimer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
