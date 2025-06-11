"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useIndexedDB } from "@/hooks/use-indexed-db"
import { useAIMemory } from "@/hooks/use-ai-memory"
import { useSync } from "@/hooks/use-sync"
import type { AIConfig, ModelConfig } from "@/lib/types"
import type { OpenAIModel } from "@/lib/openai-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Check, ChevronsUpDown, Download, Loader2, Network, Plus, RefreshCw, Settings, Upload, UploadCloud, X } from "lucide-react"
import { useTranslation } from "@/hooks/use-i18n"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MultiSelect } from "@/components/ui/multi-select"
import { NetworkDiagnostic } from "@/components/network-diagnostic"
import { useWelcomeGuide } from "@/components/onboarding/welcome-guide"

// 定义共享Key的类型
interface PublicSharedKey {
  id: string;
  name: string;
  availableModels: string[] | null;
  provider: {
    username: string;
    avatarUrl: string | null;
  };
}

const DB_VERSION = 3;

const defaultUserProfile = {
  weight: 70,
  height: 170,
  age: 30,
  gender: "male",
  activityLevel: "moderate",
  goal: "maintain",
  targetWeight: undefined as number | undefined,
  targetCalories: undefined as number | undefined,
  notes: undefined as string | undefined,
  bmrFormula: "mifflin-st-jeor" as "mifflin-st-jeor" | "harris-benedict",
  bmrCalculationBasis: "totalWeight" as "totalWeight" | "leanBodyMass",
  bodyFatPercentage: undefined as number | undefined,
  // 专业模式字段
  professionalMode: false,
  medicalHistory: undefined as string | undefined,
  lifestyle: undefined as string | undefined,
  healthAwareness: undefined as string | undefined,
  // 新增共享Key配置
  sharedKey: {
    selectedKeyIds: [],
  }
}

const defaultAIConfig: AIConfig = {
  agentModel: {
    name: "gpt-4o",
    baseUrl: "https://api.openai.com",
    apiKey: "",
    source: 'shared', // 默认使用共享模型
    sharedKeyConfig: {
      mode: 'auto',
      selectedKeyIds: [],
    }
  },
  chatModel: {
    name: "gpt-4o",
    baseUrl: "https://api.openai.com",
    apiKey: "",
    source: 'shared', // 默认使用共享模型
    sharedKeyConfig: {
      mode: 'auto',
      selectedKeyIds: [],
    }
  },
  visionModel: {
    name: "gpt-4o",
    baseUrl: "https://api.openai.com",
    apiKey: "",
    source: 'shared', // 默认使用共享模型
    sharedKeyConfig: {
      mode: 'auto',
      selectedKeyIds: [],
    }
  },
  sharedKey: {
    selectedKeyIds: [],
  }
}

type ModelType = 'agentModel' | 'chatModel' | 'visionModel';

function LoadingFallback() {
  const t = useTranslation('settings')
  return (
    <div className="container mx-auto py-6 px-6 md:px-8 lg:px-12 max-w-8xl">
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('data.loadingSettings')}</p>
        </div>
      </div>
    </div>
  )
}

const SharedPoolConfigurator = ({
  modelType,
  config,
  publicSharedKeys,
  onConfigChange,
}: {
  modelType: ModelType;
  config: ModelConfig;
  publicSharedKeys: PublicSharedKey[];
  onConfigChange: (
    modelType: ModelType,
    updates: Partial<ModelConfig> | { sharedKeyConfig: Partial<NonNullable<ModelConfig['sharedKeyConfig']>> }
  ) => void;
}) => {
  const t = useTranslation('settings')
  const sharedConfig = config.sharedKeyConfig || { mode: 'auto' };

  // 从所有共享Key中提取出可用的模型列表
  const availableSharedModels = useMemo(() => {
    const models = new Set<string>();
    publicSharedKeys.forEach(key => {
      (key.availableModels || []).forEach(model => models.add(model));
    });
    return Array.from(models).sort();
  }, [publicSharedKeys]);

  // 根据选择的模型，过滤出可用的特定Key
  const keysForSelectedModel = useMemo(() => {
    if (!sharedConfig.selectedModel) return [];
    return publicSharedKeys.filter(key =>
      (key.availableModels || []).includes(sharedConfig.selectedModel!)
    );
  }, [sharedConfig.selectedModel, publicSharedKeys]);

  return (
    <div className="space-y-4 pt-4 mt-4 border-t">
      {/* 第一步：选择模型 */}
      <div className="space-y-2">
        <Label>{t('ai.selectSharedModel')}</Label>
        <Select
          value={sharedConfig.selectedModel}
          onValueChange={(model) => {
            onConfigChange(modelType, {
              sharedKeyConfig: { selectedModel: model, selectedKeyIds: [] } // 切换模型时重置已选的特定Key
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('ai.pleaseSelectModel')} />
          </SelectTrigger>
          <SelectContent>
            {availableSharedModels.map(model => (
              <SelectItem key={model} value={model}>{model}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 第二步：选择模式 (仅当模型被选择后显示) */}
      {sharedConfig.selectedModel && (
        <div className="space-y-4 pt-4 mt-2 border-t border-dashed">
           <Label>{t('ai.selectRunMode')}</Label>
          <RadioGroup
            value={sharedConfig.mode}
            onValueChange={(mode) => onConfigChange(modelType, { sharedKeyConfig: { mode: mode as any } })}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="auto" id={`${modelType}-auto`} />
              <Label htmlFor={`${modelType}-auto`}>{t('ai.autoBalance')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" id={`${modelType}-manual`} />
              <Label htmlFor={`${modelType}-manual`}>{t('ai.manualSpecify')}</Label>
            </div>
          </RadioGroup>

          {sharedConfig.mode === 'auto' && (
            <p className="text-sm text-muted-foreground">
              {t('ai.autoBalanceDescription', { model: sharedConfig.selectedModel })}
            </p>
          )}

          {sharedConfig.mode === 'manual' && (
            <div className="space-y-2">
              <Label>{t('ai.selectSpecificKeys')}</Label>
               <MultiSelect
                options={keysForSelectedModel.map(key => ({
                  value: key.id,
                  label: `${key.name} (${key.provider.username})`,
                }))}
                selected={sharedConfig.selectedKeyIds || []}
                onChange={(ids) => onConfigChange(modelType, { sharedKeyConfig: { selectedKeyIds: ids } })}
                placeholder={t('ai.selectSharedKeysPlaceholder')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function SettingsContent() {
  const { toast } = useToast()
  const t = useTranslation('settings')
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  const [userProfile, setUserProfile] = useLocalStorage("userProfile", defaultUserProfile)
  const [aiConfig, setAIConfig] = useLocalStorage<AIConfig>("aiConfig", defaultAIConfig)

  // 获取URL参数中的tab值，默认为profile
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab')
    // 更健壮的检查，确保 activeTab 始终是字符串
    return (tabParam && ['profile', 'goals', 'ai', 'data'].includes(tabParam)) ? tabParam : 'profile'
  })

  const { clearAllData } = useIndexedDB("healthLogs")
  const { memories, updateMemory, clearMemory, clearAllMemories } = useAIMemory()
  const { isSyncing, lastSynced, syncProgress, syncAll, pushMemories, pullMemories, pushProfile, pullProfile, shouldAutoSync, clearThrottleState, SYNC_THROTTLE_MINUTES } = useSync()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 记忆编辑状态管理
  const [editingMemories, setEditingMemories] = useState<Record<string, string>>({})
  const [memoryUpdateTimeouts, setMemoryUpdateTimeouts] = useState<Record<string, NodeJS.Timeout>>({})
  const [savingMemories, setSavingMemories] = useState<Record<string, boolean>>({})

  // 高级选项展开状态
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  // 网络诊断状态
  const [showDiagnostic, setShowDiagnostic] = useState(false)

  // 引导功能
  const { resetGuide } = useWelcomeGuide()

  // 初始化编辑状态
  useEffect(() => {
    const initialEditingState: Record<string, string> = {}
    Object.entries(memories).forEach(([expertId, memory]) => {
      initialEditingState[expertId] = memory.content
    })
    setEditingMemories(initialEditingState)
  }, [memories])

  // 处理记忆内容变化
  const handleMemoryContentChange = useCallback((expertId: string, content: string) => {
    // 更新本地编辑状态
    setEditingMemories(prev => ({
      ...prev,
      [expertId]: content
    }))

    // 清除之前的定时器
    if (memoryUpdateTimeouts[expertId]) {
      clearTimeout(memoryUpdateTimeouts[expertId])
    }

    // 设置新的定时器 - 3秒防抖，给用户足够时间输入
    const timeoutId = setTimeout(async () => {
      try {
        setSavingMemories(prev => ({ ...prev, [expertId]: true }))

        await updateMemory({
          expertId,
          newContent: content,
          reason: "用户手动编辑"
        })

        toast({
          title: t('ai.memoryManagement.memorySaved'),
          description: t('ai.memoryManagement.memorySavedDescription'),
        })
      } catch (error) {
        console.error("保存记忆失败:", error)
        toast({
          title: t('ai.memoryManagement.saveFailed'),
          description: t('ai.memoryManagement.saveFailedDescription'),
          variant: "destructive",
        })
      } finally {
        setSavingMemories(prev => ({ ...prev, [expertId]: false }))

        // 清除已完成的定时器
        setMemoryUpdateTimeouts(prev => {
          const newTimeouts = { ...prev }
          delete newTimeouts[expertId]
          return newTimeouts
        })
      }
    }, 3000) // 3秒防抖

    // 更新定时器记录
    setMemoryUpdateTimeouts(prev => ({
      ...prev,
      [expertId]: timeoutId
    }))
  }, [updateMemory, memoryUpdateTimeouts, toast])

  // 清理定时器
  useEffect(() => {
    return () => {
      Object.values(memoryUpdateTimeouts).forEach(timeoutId => {
        clearTimeout(timeoutId)
      })
    }
  }, [memoryUpdateTimeouts])

  // 检查是否有未保存的更改
  const hasUnsavedChanges = useCallback((expertId: string) => {
    const originalContent = memories[expertId]?.content || ""
    const editingContent = editingMemories[expertId] || ""
    return originalContent !== editingContent
  }, [memories, editingMemories])

  // 手动保存记忆
  const handleManualSave = useCallback(async (expertId: string) => {
    const content = editingMemories[expertId] || ""

    // 清除自动保存定时器
    if (memoryUpdateTimeouts[expertId]) {
      clearTimeout(memoryUpdateTimeouts[expertId])
      setMemoryUpdateTimeouts(prev => {
        const newTimeouts = { ...prev }
        delete newTimeouts[expertId]
        return newTimeouts
      })
    }

    try {
      setSavingMemories(prev => ({ ...prev, [expertId]: true }))

      await updateMemory({
        expertId,
        newContent: content,
        reason: "用户手动保存"
      })

      toast({
        title: t('ai.memoryManagement.memorySaved'),
        description: t('ai.memoryManagement.memorySavedDescription'),
      })
    } catch (error) {
      console.error("Save memory failed:", error)
      toast({
        title: t('ai.memoryManagement.saveFailed'),
        description: t('ai.memoryManagement.saveFailedDescription'),
        variant: "destructive",
      })
    } finally {
      setSavingMemories(prev => ({ ...prev, [expertId]: false }))
    }
  }, [editingMemories, memoryUpdateTimeouts, updateMemory, toast])

  // 使用独立的表单状态，避免与 localStorage 状态冲突
  const [formData, setFormData] = useState(defaultUserProfile)
  const [aiFormData, setAIFormData] = useState(defaultAIConfig)

  // 模型列表状态
  const [agentModels, setAgentModels] = useState<OpenAIModel[]>([])
  const [chatModels, setChatModels] = useState<OpenAIModel[]>([])
  const [visionModels, setVisionModels] = useState<OpenAIModel[]>([])
  const [publicSharedKeys, setPublicSharedKeys] = useState<PublicSharedKey[]>([])

  // 加载状态
  const [loadingAgentModels, setLoadingAgentModels] = useState(false)
  const [loadingChatModels, setLoadingChatModels] = useState(false)
  const [loadingVisionModels, setLoadingVisionModels] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    setFormData(userProfile)
  }, [userProfile])

  useEffect(() => {
    setAIFormData(aiConfig)
  }, [aiConfig])

  // 获取可用的共享Key列表，并只在组件挂载时运行一次
  useEffect(() => {
    const fetchPublicKeys = async () => {
      try {
        const response = await fetch('/api/shared-keys/public-list');
        const data = await response.json();
        if (data.keys) {
          setPublicSharedKeys(data.keys);
        }
      } catch (error) {
        console.error('Failed to fetch public shared keys:', error);
        toast({
          title: t('data.fetchSharedKeysListFailed'),
          variant: "destructive"
        });
      }
    };
    fetchPublicKeys();
  }, [toast]);

  // 处理表单输入变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let processedValue;
      // Handle primary numeric fields that should default to 0 if empty/invalid
      if (name === "weight" || name === "height" || name === "age") {
        processedValue = Number.parseFloat(value) || 0;
      }
      // Handle optional numeric fields that should be undefined if empty/invalid
      else if (name === "targetWeight" || name === "targetCalories" || name === "bodyFatPercentage") {
        if (value === "") {
          processedValue = undefined;
        } else {
          const parsed = Number.parseFloat(value);
          processedValue = Number.isNaN(parsed) ? undefined : parsed; // Store undefined if not a valid number
        }
      }
      // Handle string fields
      else {
        processedValue = value;
      }
      return {
        ...prev,
        [name]: processedValue,
      };
    });
  }, [])

  // 处理选择框变化
  const handleSelectChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }, [])

  // 处理Textarea变化
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, [])

  // 处理专业模式切换
  const handleProfessionalModeChange = useCallback((checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      professionalMode: checked,
    }));
  }, [])

  // 统一处理AI配置的更新，包括顶层source切换
  const handleAIConfigUpdate = (
    modelType: ModelType,
    updates: Partial<ModelConfig> | { sharedKeyConfig: Partial<NonNullable<ModelConfig['sharedKeyConfig']>> }
  ) => {
    setAIFormData(prev => {
      const newConfig = { ...prev };
      if ('sharedKeyConfig' in updates) {
        newConfig[modelType] = {
          ...newConfig[modelType],
          sharedKeyConfig: {
            ...newConfig[modelType].sharedKeyConfig,
            ...updates.sharedKeyConfig as object,
          } as any,
        };
      } else {
        newConfig[modelType] = {
          ...newConfig[modelType],
          ...updates,
        };
      }
      return newConfig;
    });
  };

  // 保存用户配置
  const handleSaveProfile = useCallback(async () => {
    try {
      // 1. 先更新本地存储
      setUserProfile(formData)

      // 2. 如果用户已登录，自动推送到云端
      if (session?.user?.id) {
        console.log('[Settings] Auto-pushing profile to cloud after save...')
        await pushProfile()
        console.log('[Settings] Profile successfully synced to cloud')
      }

      toast({
        title: t('profile.saveSuccess'),
        description: t('profile.saveSuccessDesc'),
      })
    } catch (error) {
      console.error('[Settings] Failed to sync profile to cloud:', error)
      // 即使云端同步失败，本地保存仍然成功
      toast({
        title: t('profile.saveSuccess'),
        description: t('profile.saveSuccessDesc') + ' (' + t('data.localSavedCloudSyncRetry') + ')',
      })
    }
  }, [formData, setUserProfile, toast, session?.user?.id, pushProfile])

  // 保存AI配置
  const handleSaveAIConfig = useCallback(() => {
    // 验证配置
    for (const modelType of ['agentModel', 'chatModel', 'visionModel'] as ModelType[]) {
      const model = aiFormData[modelType];

      if (model.source === 'private') {
        if (!model.name || !model.baseUrl || !model.apiKey) {
          toast({
            title: t('ai.privateConfigIncomplete'),
            description: t('ai.fillAllFieldsForModel', { modelType }),
            variant: "destructive",
          });
          return;
        }
      } else { // 'shared'
        if (!model.sharedKeyConfig?.selectedModel) {
           toast({
            title: t('ai.sharedPoolConfigIncomplete'),
            description: t('ai.selectSharedModelForModel', { modelType }),
            variant: "destructive",
          });
          return;
        }
        if (model.sharedKeyConfig.mode === 'manual' && (!model.sharedKeyConfig.selectedKeyIds || model.sharedKeyConfig.selectedKeyIds.length === 0)) {
           toast({
            title: t('ai.sharedPoolConfigIncomplete'),
            description: t('ai.selectSharedKeysForModel', { modelType }),
            variant: "destructive",
          });
          return;
        }
      }
    }

    setAIConfig(aiFormData)
    toast({
      title: t('ai.saveSuccess'),
      description: t('ai.saveSuccessDesc'),
    })
  }, [aiFormData, setAIConfig, toast])

  const handleFetchModels = useCallback(async (modelType: ModelType) => {
    const modelConfig = aiFormData[modelType];
    const setLoading = {
      agentModel: setLoadingAgentModels,
      chatModel: setLoadingChatModels,
      visionModel: setLoadingVisionModels
    }[modelType];
    const setModels = {
      agentModel: setAgentModels,
      chatModel: setChatModels,
      visionModel: setVisionModels
    }[modelType];

    if (!modelConfig.baseUrl || !modelConfig.apiKey) {
      toast({
        title: t('ai.cannotFetchModels'),
        description: t('ai.fillApiUrlAndKey'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      console.log("🔧 Fetching models for", modelType, "from", modelConfig.baseUrl);

      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: modelConfig.baseUrl,
          apiKey: modelConfig.apiKey,
        })
      });

      // 检查响应是否为JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Non-JSON response:", text.substring(0, 200));
        throw new Error("服务器返回了非JSON响应，可能是API地址错误或服务器故障");
      }

      const result = await response.json();
      console.log("📋 Models API response:", result);

      if (result.success && result.models) {
        toast({
          title: t('ai.fetchModelsSuccess'),
          description: t('ai.foundModels', { count: result.models.length })
        });
        setModels(result.models.map((model: any) => ({ id: model.id })));
      } else {
        throw new Error(result.error || t('ai.getModelsError'));
      }
    } catch (error: any) {
      console.error("❌ Fetch models error:", error);

      let errorMessage = error.message || t('ai.networkErrorOrApiUnavailable');

      // 特殊处理常见错误
      if (error.message?.includes("Unexpected token '<'")) {
        errorMessage = "API地址可能不正确：服务器返回了网页而不是API响应";
      } else if (error.message?.includes("Failed to fetch")) {
        errorMessage = "网络连接失败：请检查API地址和网络连接";
      }

      toast({
        title: t('ai.fetchModelsFailed'),
        description: errorMessage,
        variant: "destructive"
      });
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [aiFormData, toast]);

  // 测试AI配置
  const handleTestAIConfig = useCallback(
    async (modelType: ModelType) => {
      const model = aiFormData[modelType]
      if (!model.name || !model.baseUrl || !model.apiKey) {
        toast({
          title: t('ai.configIncomplete'),
          description: t('ai.fillAllFields'),
          variant: "destructive",
        })
        return
      }

      try {
        const response = await fetch("/api/test-model", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            modelConfig: model,
            modelType,
          }),
        })

        if (response.ok) {
          toast({
            title: t('ai.testSuccess'),
            description: t('ai.modelConnectionOk', { modelType }),
          })
        } else {
          throw new Error(t('ai.testConnectionFailed'))
        }
      } catch (error) {
        toast({
          title: t('ai.testFailed'),
          description: t('ai.modelConnectionFailed', { modelType }),
          variant: "destructive",
        })
      }
    },
    [aiFormData, toast],
  )

  // 导出所有数据
  const handleExportData = useCallback(async () => {
    try {
      const dbRequest = window.indexedDB.open("healthApp", DB_VERSION);

      const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        dbRequest.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        dbRequest.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
      });

      const db = await dbPromise;
      const transaction = db.transaction(["healthLogs", "aiMemories"], "readonly");
      const healthLogsStore = transaction.objectStore("healthLogs");
      const aiMemoriesStore = transaction.objectStore("aiMemories");

      const healthLogsPromise = new Promise<Record<string, any>>((resolve, reject) => {
        const allData: Record<string, any> = {};
        const request = healthLogsStore.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            allData[cursor.key as string] = cursor.value;
            cursor.continue();
          } else {
            resolve(allData);
          }
        };
        request.onerror = (event) => reject((event.target as IDBRequest).error);
      });

      const aiMemoriesPromise = new Promise<Record<string, any>>((resolve, reject) => {
        const allMemories: Record<string, any> = {};
        const request = aiMemoriesStore.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            allMemories[cursor.key as string] = cursor.value;
            cursor.continue();
          } else {
            resolve(allMemories);
          }
        };
        request.onerror = (event) => reject((event.target as IDBRequest).error);
      });

      const [healthLogs, aiMemories] = await Promise.all([healthLogsPromise, aiMemoriesPromise]);

      const exportData = {
        userProfile,
        aiConfig,
        healthLogs,
        aiMemories,
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
      const exportFileDefaultName = `health-data-${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();

      localStorage.setItem('lastExportTime', new Date().toISOString());

      toast({
        title: t('data.exportSuccessTitle'),
        description: t('data.exportSuccessDescription'),
      });
    } catch (error) {
      console.error("Export data failed:", error);
      toast({
        title: t('data.exportErrorTitle'),
        description: error instanceof Error ? error.message : t('data.exportErrorDescription'),
        variant: "destructive",
      });
    }
  }, [userProfile, aiConfig, toast, t]);

  // 导入数据
  const handleImportData = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const importedData = JSON.parse(content);

          if (!importedData.userProfile || !importedData.healthLogs) {
            throw new Error(t('data.importErrorDescription'));
          }

          setUserProfile(importedData.userProfile);
          if (importedData.aiConfig) {
            setAIConfig(importedData.aiConfig);
          }

          const dbOpenRequest = window.indexedDB.open("healthApp", DB_VERSION);

          dbOpenRequest.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains("healthLogs")) {
              db.createObjectStore("healthLogs");
            }
            if (!db.objectStoreNames.contains("aiMemories")) {
              db.createObjectStore("aiMemories");
            }
          };

          dbOpenRequest.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = db.transaction(["healthLogs", "aiMemories"], "readwrite");
            const healthLogsStore = transaction.objectStore("healthLogs");
            const aiMemoriesStore = transaction.objectStore("aiMemories");

            healthLogsStore.clear().onsuccess = () => {
              Object.entries(importedData.healthLogs).forEach(([key, value]) => {
                healthLogsStore.add(value, key);
              });
            };

            if (importedData.aiMemories) {
              aiMemoriesStore.clear().onsuccess = () => {
                Object.entries(importedData.aiMemories).forEach(([key, value]) => {
                  aiMemoriesStore.add(value, key);
                });
              };
            }

            transaction.oncomplete = () => {
              toast({
                title: t('data.importSuccessTitle'),
                description: t('data.importSuccessDescription'),
              });
              // 重新加载页面以确保状态同步
              window.location.reload();
            };

            transaction.onerror = (event) => {
              console.error("Import transaction error:", (event.target as IDBTransaction).error);
              throw new Error(t('data.importErrorDescription'));
            };
          };

          dbOpenRequest.onerror = (event) => {
            console.error("DB open error on import:", (event.target as IDBOpenDBRequest).error);
            throw new Error(t('data.importErrorDescription'));
          };

        } catch (error) {
          console.error("Import data failed:", error);
          toast({
            title: t('data.importErrorTitle'),
            description: error instanceof Error ? error.message : t('data.importErrorDescription'),
            variant: "destructive",
          });
        }
      };

      reader.readAsText(file);
    },
    [setUserProfile, setAIConfig, toast, t]
  );

  // 清空所有数据
  const handleClearAllData = useCallback(async () => {
    try {
      await clearAllData()
      toast({
        title: t('data.clearSuccessTitle'),
        description: t('data.clearSuccessDescription'),
      })
    } catch (error) {
      console.error("Clear data failed:", error)
      toast({
        title: t('data.clearErrorTitle'),
        description: t('data.clearErrorDescription'),
        variant: "destructive",
      })
    }
  }, [clearAllData, toast])

  // 渲染模型选择器
  const renderModelSelector = useCallback(
    (modelType: ModelType, models: OpenAIModel[], isLoading: boolean) => {
      const modelConfig = aiFormData[modelType]

      return (
        <div className="flex space-x-2 items-end">
          {models.length > 0 ? (
            <div className="flex-1">
              <Select
                value={modelConfig.name}
                onValueChange={(value) => handleAIConfigUpdate(modelType, { name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('ai.selectModel')} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Input
              className="flex-1"
              value={modelConfig.name}
              onChange={(e) => handleAIConfigUpdate(modelType, { name: e.target.value })}
              placeholder={t('ai.modelNamePlaceholder')}
            />
          )}
          <Button
            variant="outline"
            onClick={() => handleFetchModels(modelType)}
            disabled={isLoading || !modelConfig.baseUrl || !modelConfig.apiKey}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">{t('ai.fetchModels')}</span>
          </Button>
        </div>
      )
    },
    [aiFormData, handleAIConfigUpdate, handleFetchModels, t],
  )

  return (
    <div className="container mx-auto py-6 px-6 md:px-8 lg:px-12 max-w-8xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">{t('title')}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* 移动端：水平滚动布局 */}
        <TabsList className="md:hidden flex h-auto p-1 bg-muted rounded-lg overflow-x-auto w-full">
          <TabsTrigger
            value="profile"
            className="flex-shrink-0 text-sm px-3 py-2 whitespace-nowrap"
          >
            {t('tabs.profile')}
          </TabsTrigger>
          <TabsTrigger
            value="goals"
            className="flex-shrink-0 text-sm px-3 py-2 whitespace-nowrap"
          >
            {t('tabs.goals')}
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="flex-shrink-0 text-sm px-3 py-2 whitespace-nowrap"
          >
            {t('tabs.ai')}
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="flex-shrink-0 text-sm px-3 py-2 whitespace-nowrap"
          >
            {t('tabs.data')}
          </TabsTrigger>
        </TabsList>

        {/* 桌面端：网格布局 */}
        <TabsList className="hidden md:grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="text-base px-4">{t('tabs.profile')}</TabsTrigger>
          <TabsTrigger value="goals" className="text-base px-4">{t('tabs.goals')}</TabsTrigger>
          <TabsTrigger value="ai" className="text-base px-4">{t('tabs.ai')}</TabsTrigger>
          <TabsTrigger value="data" className="text-base px-4">{t('tabs.data')}</TabsTrigger>
        </TabsList>

        {/* 个人信息 */}
        <TabsContent value="profile">
          <Card>
            <CardHeader className="px-4 md:px-6">
              <CardTitle>{t('profile.title')}</CardTitle>
              <CardDescription>{t('profile.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">{t('profile.weight')}</Label>
                  <Input id="weight" name="weight" type="number" value={formData.weight} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">{t('profile.height')}</Label>
                  <Input id="height" name="height" type="number" value={formData.height} onChange={handleInputChange} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">{t('profile.age')}</Label>
                  <Input id="age" name="age" type="number" value={formData.age} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">{t('profile.gender')}</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleSelectChange("gender", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('profile.gender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('profile.male')}</SelectItem>
                      <SelectItem value="female">{t('profile.female')}</SelectItem>
                      <SelectItem value="other">{t('profile.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activityLevel">{t('profile.activityLevel')}</Label>
                <Select
                  value={formData.activityLevel}
                  onValueChange={(value) => handleSelectChange("activityLevel", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('profile.activityLevel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">{t('profile.activityLevels.sedentary')}</SelectItem>
                    <SelectItem value="light">{t('profile.activityLevels.light')}</SelectItem>
                    <SelectItem value="moderate">{t('profile.activityLevels.moderate')}</SelectItem>
                    <SelectItem value="active">{t('profile.activityLevels.active')}</SelectItem>
                    <SelectItem value="very_active">{t('profile.activityLevels.very_active')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('profile.activityLevelDescription')}
                </p>
              </div>

              {/* BMR Formula Selection */}
              <div className="space-y-2">
                <Label htmlFor="bmrFormula">{t('profile.bmrFormula')}</Label>
                <Select
                  value={formData.bmrFormula || 'mifflin-st-jeor'}
                  onValueChange={(value) => handleSelectChange("bmrFormula", value)}
                >
                  <SelectTrigger id="bmrFormula">
                    <SelectValue placeholder={t('profile.selectBmrFormula')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mifflin-st-jeor">{t('profile.mifflinStJeor')}</SelectItem>
                    <SelectItem value="harris-benedict">{t('profile.harrisBenedict')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('profile.bmrFormulaDescription')}
                </p>
              </div>

              {/* BMR Calculation Basis Selection */}
              <div className="space-y-2">
                <Label htmlFor="bmrCalculationBasis">{t('profile.bmrCalculationBasis')}</Label>
                <Select
                  value={formData.bmrCalculationBasis || 'totalWeight'}
                  onValueChange={(value) => handleSelectChange("bmrCalculationBasis", value)}
                >
                  <SelectTrigger id="bmrCalculationBasis">
                    <SelectValue placeholder={t('profile.selectBmrBasis')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalWeight">{t('profile.totalWeight')}</SelectItem>
                    <SelectItem value="leanBodyMass">{t('profile.leanBodyMass')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('profile.bmrBasisDescription')}
                </p>
              </div>

              {/* Body Fat Percentage Input (conditional) */}
              {formData.bmrCalculationBasis === 'leanBodyMass' && (
                <div className="space-y-2">
                  <Label htmlFor="bodyFatPercentage">{t('profile.bodyFatPercentage')}</Label>
                  <Input
                    id="bodyFatPercentage"
                    name="bodyFatPercentage"
                    type="number"
                    value={formData.bodyFatPercentage === undefined ? "" : String(formData.bodyFatPercentage)} // Display empty string for undefined
                    onChange={handleInputChange}
                    placeholder={t('profile.bodyFatPlaceholder')}
                    min="0"
                    max="99"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('profile.bodyFatDescription')}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="px-4 md:px-6">
              <Button onClick={handleSaveProfile}>{t('profile.saveProfile')}</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* 健康目标 */}
        <TabsContent value="goals">
          <Card>
            <CardHeader className="px-4 md:px-6">
              <CardTitle>{t('goals.title')}</CardTitle>
              <CardDescription>{t('goals.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-6">
              <div className="space-y-2">
                <Label htmlFor="goal">{t('goals.goalType')}</Label>
                <Select value={formData.goal} onValueChange={(value) => handleSelectChange("goal", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('goals.selectGoal')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lose_weight">{t('goals.loseWeight')}</SelectItem>
                    <SelectItem value="maintain">{t('goals.maintain')}</SelectItem>
                    <SelectItem value="gain_weight">{t('goals.gainWeight')}</SelectItem>
                    <SelectItem value="build_muscle">{t('goals.buildMuscle')}</SelectItem>
                    <SelectItem value="improve_health">{t('goals.improveHealth')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetWeight">{t('goals.targetWeight')}</Label>
                  <Input
                    id="targetWeight"
                    name="targetWeight"
                    type="number"
                    value={formData.targetWeight || ""}
                    onChange={handleInputChange}
                    placeholder={t('goals.optional')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetCalories">{t('goals.targetCalories')}</Label>
                  <Input
                    id="targetCalories"
                    name="targetCalories"
                    type="number"
                    value={formData.targetCalories || ""}
                    onChange={handleInputChange}
                    placeholder={t('goals.optional')}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="notes">{t('goals.notes')}</Label>
                  <p className="text-sm font-medium text-muted-foreground">{t('goals.notesSubtitle')}</p>
                </div>
                <div className="space-y-2">
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes || ""}
                    onChange={handleTextareaChange}
                    placeholder={t('goals.notesPlaceholder')}
                    className="min-h-[120px] text-base"
                  />
                  <div className="text-xs text-muted-foreground whitespace-pre-line">
                    {t('goals.notesDescription')}
                  </div>
                </div>
              </div>

              {/* 专业模式切换 */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="professional-mode">{t('goals.professionalMode')}</Label>
                    <p className="text-sm text-muted-foreground">{t('goals.professionalModeDescription')}</p>
                  </div>
                  <Switch
                    id="professional-mode"
                    checked={formData.professionalMode || false}
                    onCheckedChange={handleProfessionalModeChange}
                  />
                </div>

                {/* 专业模式字段 */}
                {formData.professionalMode && (
                  <div className="space-y-6 pt-4">
                    <div className="space-y-3">
                      <Label htmlFor="medicalHistory">{t('goals.medicalHistory')}</Label>
                      <Textarea
                        id="medicalHistory"
                        name="medicalHistory"
                        value={formData.medicalHistory || ""}
                        onChange={handleTextareaChange}
                        placeholder={t('goals.medicalHistoryPlaceholder')}
                        className="min-h-[150px] text-base"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="lifestyle">{t('goals.lifestyle')}</Label>
                      <Textarea
                        id="lifestyle"
                        name="lifestyle"
                        value={formData.lifestyle || ""}
                        onChange={handleTextareaChange}
                        placeholder={t('goals.lifestylePlaceholder')}
                        className="min-h-[150px] text-base"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="healthAwareness">{t('goals.healthAwareness')}</Label>
                      <Textarea
                        id="healthAwareness"
                        name="healthAwareness"
                        value={formData.healthAwareness || ""}
                        onChange={handleTextareaChange}
                        placeholder={t('goals.healthAwarenessPlaceholder')}
                        className="min-h-[150px] text-base"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="px-4 md:px-6">
              <Button onClick={handleSaveProfile}>{t('goals.saveGoals')}</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* AI 配置 */}
        <TabsContent value="ai">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 工作模型/Agents模型 */}
              <Card>
                <CardHeader className="px-4 md:px-6">
                  <CardTitle>{t('ai.agentModel')}</CardTitle>
                  <CardDescription>{t('ai.agentModelDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 md:px-6">
                  <RadioGroup
                    value={aiFormData.agentModel.source}
                    onValueChange={(value) => handleAIConfigUpdate("agentModel", { source: value as any })}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="private" id="agent-private" className="peer sr-only" />
                      <Label htmlFor="agent-private" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        {t('ai.privateConfig')}
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="shared" id="agent-shared" className="peer sr-only" />
                      <Label htmlFor="agent-shared" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        {t('ai.sharedPool')}
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* 私有配置UI */}
                  {aiFormData.agentModel.source === 'private' && (
                    <div className="space-y-4 pt-4 mt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="agent-base-url">{t('ai.baseUrl')}</Label>
                          <Input
                            id="agent-base-url"
                            value={aiFormData.agentModel.baseUrl}
                            onChange={(e) => handleAIConfigUpdate("agentModel", { baseUrl: e.target.value })}
                            placeholder={t('ai.baseUrlPlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="agent-api-key">{t('ai.apiKey')}</Label>
                          <Input
                            id="agent-api-key"
                            type="password"
                            value={aiFormData.agentModel.apiKey}
                            onChange={(e) => handleAIConfigUpdate("agentModel", { apiKey: e.target.value })}
                            placeholder={t('ai.apiKeyPlaceholder')}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="agent-model-name">{t('ai.modelName')}</Label>
                        {renderModelSelector("agentModel", agentModels, loadingAgentModels)}
                        {agentModels.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">{t('ai.modelsFound', { count: agentModels.length })}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 共享池配置UI */}
                  {aiFormData.agentModel.source === 'shared' && (
                     <SharedPoolConfigurator
                        modelType="agentModel"
                        config={aiFormData.agentModel}
                        publicSharedKeys={publicSharedKeys}
                        onConfigChange={handleAIConfigUpdate}
                      />
                  )}
                </CardContent>
                <CardFooter className="flex justify-between px-4 md:px-6">
                  {aiFormData.agentModel.source === 'private' && (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleTestAIConfig("agentModel")}>
                        {t('ai.testConnection')}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowDiagnostic(true)}
                        title={t('ai.networkDiagnostic')}
                      >
                        <Network className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>

              {/* 对话模型 */}
              <Card>
                <CardHeader className="px-4 md:px-6">
                  <CardTitle>{t('ai.chatModel')}</CardTitle>
                  <CardDescription>{t('ai.chatModelDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 md:px-6">
                   <RadioGroup
                    value={aiFormData.chatModel.source}
                    onValueChange={(value) => handleAIConfigUpdate("chatModel", { source: value as any })}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="private" id="chat-private" className="peer sr-only" />
                      <Label htmlFor="chat-private" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        {t('ai.privateConfig')}
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="shared" id="chat-shared" className="peer sr-only" />
                      <Label htmlFor="chat-shared" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        {t('ai.sharedPool')}
                      </Label>
                    </div>
                  </RadioGroup>

                  {aiFormData.chatModel.source === 'private' && (
                    <div className="space-y-4 pt-4 mt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="chat-base-url">{t('ai.baseUrl')}</Label>
                          <Input
                            id="chat-base-url"
                            value={aiFormData.chatModel.baseUrl}
                            onChange={(e) => handleAIConfigUpdate("chatModel", { baseUrl: e.target.value })}
                            placeholder={t('ai.baseUrlPlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chat-api-key">{t('ai.apiKey')}</Label>
                          <Input
                            id="chat-api-key"
                            type="password"
                            value={aiFormData.chatModel.apiKey}
                            onChange={(e) => handleAIConfigUpdate("chatModel", { apiKey: e.target.value })}
                            placeholder={t('ai.apiKeyPlaceholder')}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chat-model-name">{t('ai.modelName')}</Label>
                        {renderModelSelector("chatModel", chatModels, loadingChatModels)}
                        {chatModels.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">{t('ai.modelsFound', { count: chatModels.length })}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {aiFormData.chatModel.source === 'shared' && (
                     <SharedPoolConfigurator
                        modelType="chatModel"
                        config={aiFormData.chatModel}
                        publicSharedKeys={publicSharedKeys}
                        onConfigChange={handleAIConfigUpdate}
                      />
                  )}
                </CardContent>
                <CardFooter className="flex justify-between px-4 md:px-6">
                  {aiFormData.chatModel.source === 'private' && (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleTestAIConfig("chatModel")}>
                        {t('ai.testConnection')}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowDiagnostic(true)}
                        title={t('ai.networkDiagnostic')}
                      >
                        <Network className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>

              {/* 视觉模型 */}
              <Card>
                <CardHeader className="px-4 md:px-6">
                  <CardTitle>{t('ai.visionModel')}</CardTitle>
                  <CardDescription>{t('ai.visionModelDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 md:px-6">
                  <RadioGroup
                    value={aiFormData.visionModel.source}
                    onValueChange={(value) => handleAIConfigUpdate("visionModel", { source: value as any })}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="private" id="vision-private" className="peer sr-only" />
                      <Label htmlFor="vision-private" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        {t('ai.privateConfig')}
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="shared" id="vision-shared" className="peer sr-only" />
                      <Label htmlFor="vision-shared" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        {t('ai.sharedPool')}
                      </Label>
                    </div>
                  </RadioGroup>

                  {aiFormData.visionModel.source === 'private' && (
                    <div className="space-y-4 pt-4 mt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="vision-base-url">{t('ai.baseUrl')}</Label>
                          <Input
                            id="vision-base-url"
                            value={aiFormData.visionModel.baseUrl}
                            onChange={(e) => handleAIConfigUpdate("visionModel", { baseUrl: e.target.value })}
                            placeholder={t('ai.baseUrlPlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vision-api-key">{t('ai.apiKey')}</Label>
                          <Input
                            id="vision-api-key"
                            type="password"
                            value={aiFormData.visionModel.apiKey}
                            onChange={(e) => handleAIConfigUpdate("visionModel", { apiKey: e.target.value })}
                            placeholder={t('ai.apiKeyPlaceholder')}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vision-model-name">{t('ai.modelName')}</Label>
                        {renderModelSelector("visionModel", visionModels, loadingVisionModels)}
                        {visionModels.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">{t('ai.modelsFound', { count: visionModels.length })}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {aiFormData.visionModel.source === 'shared' && (
                     <SharedPoolConfigurator
                        modelType="visionModel"
                        config={aiFormData.visionModel}
                        publicSharedKeys={publicSharedKeys}
                        onConfigChange={handleAIConfigUpdate}
                      />
                  )}
                </CardContent>
                <CardFooter className="flex justify-between px-4 md:px-6">
                  {aiFormData.visionModel.source === 'private' && (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleTestAIConfig("visionModel")}>
                        {t('ai.testConnection')}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowDiagnostic(true)}
                        title={t('ai.networkDiagnostic')}
                      >
                        <Network className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            </div>

            <Button onClick={handleSaveAIConfig}>{t('ai.saveConfig')}</Button>

            {/* AI记忆管理 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t('ai.memoryManagement.title')}</CardTitle>
                <CardDescription>
                  {t('ai.memoryManagement.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(memories).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('ai.memoryManagement.noMemoryData')}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(memories).map(([expertId, memory]) => {
                      const getExpertName = (id: string) => {
                        return t(`ai.memoryManagement.expertNames.${id}`) || id
                      }

                      return (
                        <Card key={expertId} className="border border-slate-200 dark:border-slate-700 shadow-sm">
                          <CardHeader className="pb-2 px-4 pt-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium">
                                {getExpertName(expertId)}
                              </CardTitle>
                              <div className="text-xs text-muted-foreground">
                                {memory.content.length}/500
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(memory.lastUpdated).toLocaleDateString('zh-CN')}
                            </div>
                          </CardHeader>
                          <CardContent className="px-4 pb-3">
                            <div className="space-y-2">
                              <div className="relative">
                                <Textarea
                                  value={editingMemories[expertId] || ""}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 500) {
                                      handleMemoryContentChange(expertId, e.target.value)
                                    }
                                  }}
                                  placeholder={t('ai.memoryManagement.memoryPlaceholder')}
                                  className="min-h-[60px] resize-none text-sm"
                                  maxLength={500}
                                />
                                {/* 保存状态指示器 */}
                                {savingMemories[expertId] && (
                                  <div className="absolute top-1 right-1 flex items-center space-x-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span>{t('ai.memoryManagement.saving')}</span>
                                  </div>
                                )}
                                {hasUnsavedChanges(expertId) && !savingMemories[expertId] && (
                                  <div className="absolute top-1 right-1 flex items-center space-x-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                    <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div>
                                    <span>{t('ai.memoryManagement.unsaved')}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="text-xs text-muted-foreground">
                                  {(editingMemories[expertId] || "").length > 400 && (
                                    <span className="text-amber-600">
                                      {t('data.approachingLimit')}
                                    </span>
                                  )}
                                  {hasUnsavedChanges(expertId) && (
                                    <span className="text-amber-600">
                                      {t('data.autoSaveIn3Seconds')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex space-x-1">
                                  {hasUnsavedChanges(expertId) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleManualSave(expertId)}
                                      disabled={savingMemories[expertId]}
                                      className="h-6 px-2 text-xs"
                                    >
                                      {savingMemories[expertId] ? t('ai.memoryManagement.saving') : t('common.save')}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      clearMemory(expertId).then(() => {
                                        // 同时清空编辑状态
                                        setEditingMemories(prev => ({
                                          ...prev,
                                          [expertId]: ""
                                        }))
                                        toast({
                                          title: t('ai.memoryManagement.allMemoriesCleared'),
                                          description: t('ai.expertMemoryCleared', { expertName: getExpertName(expertId) }),
                                        })
                                      }).catch((error) => {
                                        toast({
                                          title: t('ai.memoryManagement.clearFailed'),
                                          description: error.message,
                                          variant: "destructive",
                                        })
                                      })
                                    }}
                                    className="h-6 px-2 text-xs"
                                  >
                                    {t('common.clear')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                {Object.entries(memories).length > 0 && (
                  <div className="pt-4 border-t">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          {t('ai.memoryManagement.clearAllMemories')}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('ai.memoryManagement.confirmClearTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('ai.memoryManagement.confirmClearDescription')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('ai.memoryManagement.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              clearAllMemories().then(() => {
                                toast({
                                  title: t('ai.memoryManagement.allMemoriesCleared'),
                                  description: t('ai.memoryManagement.allMemoriesClearedDescription'),
                                })
                              }).catch((error) => {
                                toast({
                                  title: t('ai.memoryManagement.clearFailed'),
                                  description: error.message,
                                  variant: "destructive",
                                })
                              })
                            }}
                          >
                            {t('ai.memoryManagement.confirmClear')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* 数据管理 */}
        <TabsContent value="data">
          <Card>
            <CardHeader className="px-4 md:px-6">
              <CardTitle>{t('data.title')}</CardTitle>
              <CardDescription>{t('data.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-4 md:px-6">
              {/* 云同步功能 - 现代化设计 */}
              <div className="health-card p-6 space-y-6">
                {/* 标题区域 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{t('data.cloudSync')}</h3>
                      <p className="text-sm text-muted-foreground">{t('data.crossDeviceSync')}</p>
                    </div>
                  </div>
                  {lastSynced && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t('data.lastSync')}</div>
                      <div className="text-sm font-medium">{lastSynced.toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</div>
                    </div>
                  )}
                </div>

                {/* 同步进度指示器 */}
                {isSyncing && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span>{t('data.syncingData')}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('data.healthLogs')}</span>
                        <span>{syncProgress.logs ? '✓' : '⏳'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('data.aiMemories')}</span>
                        <span>{syncProgress.memories ? '✓' : '⏳'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('data.userProfile')}</span>
                        <span>{syncProgress.profile ? '✓' : '⏳'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 主要操作按钮 */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => syncAll(true)}
                    disabled={isSyncing}
                    className="flex-1 h-11 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t('data.syncing')}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t('data.syncNow')}
                      </>
                    )}
                  </Button>

                  {/* 高级选项按钮 */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className={`h-11 w-11 transition-all duration-200 ${showAdvancedOptions ? 'bg-accent' : ''}`}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${showAdvancedOptions ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                </div>

                {/* 高级选项面板 */}
                {showAdvancedOptions && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">{t('data.categorizedSync')}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pullMemories()}
                          disabled={isSyncing}
                          className="text-xs h-9"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          {t('data.pullMemories')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pushMemories()}
                          disabled={isSyncing}
                          className="text-xs h-9"
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {t('data.pushMemories')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pullProfile()}
                          disabled={isSyncing}
                          className="text-xs h-9"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          {t('data.pullProfile')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pushProfile()}
                          disabled={isSyncing}
                          className="text-xs h-9"
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {t('data.pushProfile')}
                        </Button>
                      </div>
                    </div>

                    {/* 开发者选项 */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">{t('data.developerOptions')}</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearThrottleState}
                        className="text-xs h-9"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        {t('data.clearThrottleState')}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        {t('data.clearThrottleDescription')}
                      </p>
                    </div>
                  </div>
                )}

                {/* 状态指示器 */}
                {!isSyncing && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      {lastSynced ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-muted-foreground">{t('data.dataSynced')}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-sm text-muted-foreground">{t('data.notSyncedYet')}</span>
                        </>
                      )}
                    </div>
                    {!shouldAutoSync() && (
                      <div className="text-xs text-muted-foreground">
                        {t('data.throttlingMinutes', { minutes: SYNC_THROTTLE_MINUTES })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('data.exportData')}</h3>
                <p className="text-sm text-muted-foreground">{t('data.exportDescription')}</p>
                <Button onClick={handleExportData}>{t('data.exportAllData')}</Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('data.importData')}</h3>
                <p className="text-sm text-muted-foreground">{t('data.importDescription')}</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    {t('data.selectFile')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('data.clearData')}</h3>
                <p className="text-sm text-muted-foreground">{t('data.clearDescription')}</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">{t('data.clearAllData')}</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('data.confirmClearTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('data.confirmClearDescription')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('data.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAllData}>{t('data.confirmClear')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 关于与帮助 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('about.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">{t('about.privacyTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('about.privacyDescription')}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium">{t('about.usageTitle')}</h3>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('about.quotaInfo')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('about.modelOptions')}
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>{t('about.usage1')}</li>
                <li>{t('about.usage2')}</li>
                <li>{t('about.usage3')}</li>
                <li>{t('about.usage4')}</li>
                <li>{t('about.usage5')}</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium">{t('about.dataBackupTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('about.dataBackupDescription')}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium">{t('about.versionTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('about.versionInfo')}</p>
          </div>

          <div>
            <h3 className="text-lg font-medium">使用引导</h3>
            <p className="text-sm text-muted-foreground mb-3">
              重新查看初次使用时的引导说明，了解SnapFit AI社区版的特色功能。
            </p>
            <Button
              variant="outline"
              onClick={() => {
                resetGuide();
                toast({
                  title: "引导已重置",
                  description: "欢迎引导将在页面刷新后显示",
                });
              }}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              重新显示使用引导
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 网络诊断对话框 */}
      {showDiagnostic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <NetworkDiagnostic
            baseUrl={aiFormData.agentModel.baseUrl}
            apiKey={aiFormData.agentModel.apiKey}
            onClose={() => setShowDiagnostic(false)}
          />
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SettingsContent />
    </Suspense>
  )
}
