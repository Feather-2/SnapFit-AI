"use client";

import type React from "react";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useDailyLogCache } from "@/hooks/use-daily-log-cache";
import { useAIMemoryServer } from "@/hooks/use-ai-memory-server";
import { useAIMemory } from "@/hooks/use-ai-memory";
import { useAIConfigServer } from "@/hooks/use-ai-config-server";
import type { AIConfig, ModelConfig } from "@/lib/types";
import type { OpenAIModel } from "@/lib/openai-client";
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
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { useTranslation } from "@/hooks/use-i18n";

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
};

const defaultAIConfig: AIConfig = {
  agentModel: {
    name: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com",
    apiKey: "",
  },
  chatModel: {
    name: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com",
    apiKey: "",
  },
  visionModel: {
    name: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com",
    apiKey: "",
  },
};

function SettingsContent() {
  const { toast } = useToast();
  const t = useTranslation("settings");
  const searchParams = useSearchParams();
  const [userProfile, setUserProfile] = useLocalStorage(
    "userProfile",
    defaultUserProfile
  );
  // 使用服务器端 AI 配置存储
  const { aiConfig, saveAIConfig: saveAIConfigServer } = useAIConfigServer();
  const currentAIConfig = aiConfig || defaultAIConfig;

  // 为了兼容现有代码，创建一个本地设置函数
  const setAIConfig = async (config: AIConfig) => {
    try {
      await saveAIConfigServer(config);
    } catch (error) {
      console.error("Failed to save AI config:", error);
      throw error;
    }
  };

  // 获取URL参数中的tab值，默认为profile
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get("tab");
    return ["profile", "goals", "ai", "data"].includes(tabParam || "")
      ? tabParam
      : "profile";
  });

  const { getAllDailyLogs } = useDailyLogCache();
  const { getAllMemories: getAllServerMemories } = useAIMemoryServer();
  const { memories, updateMemory, clearMemory, clearAllMemories } =
    useAIMemory();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 记忆编辑状态管理
  const [editingMemories, setEditingMemories] = useState<
    Record<string, string>
  >({});
  const [memoryUpdateTimeouts, setMemoryUpdateTimeouts] = useState<
    Record<string, NodeJS.Timeout>
  >({});
  const [savingMemories, setSavingMemories] = useState<Record<string, boolean>>(
    {}
  );

  // 初始化编辑状态
  useEffect(() => {
    const initialEditingState: Record<string, string> = {};
    Object.entries(memories).forEach(([expertId, memory]) => {
      initialEditingState[expertId] = memory.content;
    });
    setEditingMemories(initialEditingState);
  }, [memories]);

  // 处理记忆内容变化
  const handleMemoryContentChange = useCallback(
    (expertId: string, content: string) => {
      // 更新本地编辑状态
      setEditingMemories((prev) => ({
        ...prev,
        [expertId]: content,
      }));

      // 清除之前的定时器
      if (memoryUpdateTimeouts[expertId]) {
        clearTimeout(memoryUpdateTimeouts[expertId]);
      }

      // 设置新的定时器 - 3秒防抖，给用户足够时间输入
      const timeoutId = setTimeout(async () => {
        try {
          setSavingMemories((prev) => ({ ...prev, [expertId]: true }));

          await updateMemory({
            expertId,
            newContent: content,
            reason: "用户手动编辑",
          });

          toast({
            title: t("ai.memoryManagement.memorySaved"),
            description: t("ai.memoryManagement.memorySavedDescription"),
          });
        } catch (error) {
          console.error("保存记忆失败:", error);
          toast({
            title: t("ai.memoryManagement.saveFailed"),
            description: t("ai.memoryManagement.saveFailedDescription"),
            variant: "destructive",
          });
        } finally {
          setSavingMemories((prev) => ({ ...prev, [expertId]: false }));

          // 清除已完成的定时器
          setMemoryUpdateTimeouts((prev) => {
            const newTimeouts = { ...prev };
            delete newTimeouts[expertId];
            return newTimeouts;
          });
        }
      }, 3000); // 3秒防抖

      // 更新定时器记录
      setMemoryUpdateTimeouts((prev) => ({
        ...prev,
        [expertId]: timeoutId,
      }));
    },
    [updateMemory, memoryUpdateTimeouts, toast]
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      Object.values(memoryUpdateTimeouts).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, [memoryUpdateTimeouts]);

  // 检查是否有未保存的更改
  const hasUnsavedChanges = useCallback(
    (expertId: string) => {
      const originalContent = memories[expertId]?.content || "";
      const editingContent = editingMemories[expertId] || "";
      return originalContent !== editingContent;
    },
    [memories, editingMemories]
  );

  // 手动保存记忆
  const handleManualSave = useCallback(
    async (expertId: string) => {
      const content = editingMemories[expertId] || "";

      // 清除自动保存定时器
      if (memoryUpdateTimeouts[expertId]) {
        clearTimeout(memoryUpdateTimeouts[expertId]);
        setMemoryUpdateTimeouts((prev) => {
          const newTimeouts = { ...prev };
          delete newTimeouts[expertId];
          return newTimeouts;
        });
      }

      try {
        setSavingMemories((prev) => ({ ...prev, [expertId]: true }));

        await updateMemory({
          expertId,
          newContent: content,
          reason: "用户手动保存",
        });

        toast({
          title: t("ai.memoryManagement.memorySaved"),
          description: t("ai.memoryManagement.memorySavedDescription"),
        });
      } catch (error) {
        console.error("保存记忆失败:", error);
        toast({
          title: t("ai.memoryManagement.saveFailed"),
          description: t("ai.memoryManagement.saveFailedDescription"),
          variant: "destructive",
        });
      } finally {
        setSavingMemories((prev) => ({ ...prev, [expertId]: false }));
      }
    },
    [editingMemories, memoryUpdateTimeouts, updateMemory, toast]
  );

  // 使用独立的表单状态，避免与 localStorage 状态冲突
  const [formData, setFormData] = useState(defaultUserProfile);
  const [aiFormData, setAIFormData] = useState(defaultAIConfig);

  // 模型列表状态
  const [agentModels, setAgentModels] = useState<OpenAIModel[]>([]);
  const [chatModels, setChatModels] = useState<OpenAIModel[]>([]);
  const [visionModels, setVisionModels] = useState<OpenAIModel[]>([]);

  // 加载状态
  const [loadingAgentModels, setLoadingAgentModels] = useState(false);
  const [loadingChatModels, setLoadingChatModels] = useState(false);
  const [loadingVisionModels, setLoadingVisionModels] = useState(false);

  // 初始化表单数据
  useEffect(() => {
    setFormData(userProfile);
  }, [userProfile]);

  useEffect(() => {
    // 确保 currentAIConfig 的所有字段都是有效的 ModelConfig 对象
    const safeAIConfig = {
      agentModel: currentAIConfig.agentModel || {
        name: "gpt-4.1-mini",
        baseUrl: "https://api.openai.com",
        apiKey: "",
      },
      chatModel: currentAIConfig.chatModel || {
        name: "gpt-4.1-mini",
        baseUrl: "https://api.openai.com",
        apiKey: "",
      },
      visionModel: currentAIConfig.visionModel || {
        name: "gpt-4.1-mini",
        baseUrl: "https://api.openai.com",
        apiKey: "",
      },
    };
    setAIFormData(safeAIConfig);
  }, [currentAIConfig]);

  // 处理表单输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => {
        let processedValue;
        // Handle primary numeric fields that should default to 0 if empty/invalid
        if (name === "weight" || name === "height" || name === "age") {
          processedValue = Number.parseFloat(value) || 0;
        }
        // Handle optional numeric fields that should be undefined if empty/invalid
        else if (
          name === "targetWeight" ||
          name === "targetCalories" ||
          name === "bodyFatPercentage"
        ) {
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
    },
    []
  );

  // 处理选择框变化
  const handleSelectChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  // 处理Textarea变化
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    },
    []
  );

  // 处理专业模式切换
  const handleProfessionalModeChange = useCallback((checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      professionalMode: checked,
    }));
  }, []);

  // 处理AI配置变化
  const handleAIConfigChange = useCallback(
    (modelType: keyof AIConfig, field: keyof ModelConfig, value: string) => {
      setAIFormData((prev) => ({
        ...prev,
        [modelType]: {
          ...prev[modelType],
          [field]: value,
        },
      }));

      // 如果修改了 baseUrl 或 apiKey，清空对应的模型列表
      if (field === "baseUrl" || field === "apiKey") {
        setTimeout(() => {
          switch (modelType) {
            case "agentModel":
              setAgentModels([]);
              break;
            case "chatModel":
              setChatModels([]);
              break;
            case "visionModel":
              setVisionModels([]);
              break;
          }
        }, 100);
      }
    },
    []
  );

  // 获取模型列表
  const fetchModels = useCallback(
    async (modelType: keyof AIConfig) => {
      const modelConfig = aiFormData[modelType];

      if (!modelConfig.baseUrl || !modelConfig.apiKey) {
        toast({
          title: t("ai.configIncomplete"),
          description: t("ai.fillBaseUrlAndKey"),
          variant: "destructive",
        });
        return;
      }

      // 设置加载状态
      switch (modelType) {
        case "agentModel":
          setLoadingAgentModels(true);
          break;
        case "chatModel":
          setLoadingChatModels(true);
          break;
        case "visionModel":
          setLoadingVisionModels(true);
          break;
      }

      try {
        const response = await fetch("/api/models", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            baseUrl: modelConfig.baseUrl,
            apiKey: modelConfig.apiKey,
          }),
        });

        if (!response.ok) {
          throw new Error(t("ai.fetchModelsFailed"));
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // 更新对应的模型列表
        switch (modelType) {
          case "agentModel":
            setAgentModels(data.data || []);
            break;
          case "chatModel":
            setChatModels(data.data || []);
            break;
          case "visionModel":
            setVisionModels(data.data || []);
            break;
        }

        toast({
          title: t("ai.fetchSuccess"),
          description: t("ai.fetchSuccessDesc", {
            count: data.data?.length || 0,
          }),
        });
      } catch (error) {
        console.error("Error fetching models:", error);
        toast({
          title: t("ai.fetchFailed"),
          description:
            error instanceof Error ? error.message : t("ai.fetchFailedDesc"),
          variant: "destructive",
        });
      } finally {
        // 清除加载状态
        switch (modelType) {
          case "agentModel":
            setLoadingAgentModels(false);
            break;
          case "chatModel":
            setLoadingChatModels(false);
            break;
          case "visionModel":
            setLoadingVisionModels(false);
            break;
        }
      }
    },
    [aiFormData, toast]
  );

  // 保存用户配置
  const handleSaveProfile = useCallback(() => {
    setUserProfile(formData);
    toast({
      title: t("profile.saveSuccess"),
      description: t("profile.saveSuccessDesc"),
    });
  }, [formData, setUserProfile, toast]);

  // 保存AI配置
  const handleSaveAIConfig = useCallback(() => {
    // 验证配置
    const models = [
      aiFormData.agentModel,
      aiFormData.chatModel,
      aiFormData.visionModel,
    ];
    for (const model of models) {
      if (!model.name || !model.baseUrl || !model.apiKey) {
        toast({
          title: t("ai.configIncomplete"),
          description: t("ai.fillAllFields"),
          variant: "destructive",
        });
        return;
      }
    }

    setAIConfig(aiFormData);
    toast({
      title: t("ai.saveSuccess"),
      description: t("ai.saveSuccessDesc"),
    });
  }, [aiFormData, setAIConfig, toast]);

  // 测试AI配置
  const handleTestAIConfig = useCallback(
    async (modelType: keyof AIConfig) => {
      const model = aiFormData[modelType];
      if (!model.name || !model.baseUrl || !model.apiKey) {
        toast({
          title: t("ai.configIncomplete"),
          description: t("ai.fillAllFields"),
          variant: "destructive",
        });
        return;
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
        });

        if (response.ok) {
          toast({
            title: t("ai.testSuccess"),
            description: t("ai.modelConnectionOk", { modelType }),
          });
        } else {
          throw new Error("测试失败");
        }
      } catch (error) {
        toast({
          title: t("ai.testFailed"),
          description: t("ai.modelConnectionFailed", { modelType }),
          variant: "destructive",
        });
      }
    },
    [aiFormData, toast]
  );

  // 导出所有数据
  const handleExportData = useCallback(async () => {
    try {
      // 获取所有健康日志
      const healthLogsArray = await getAllDailyLogs();
      const healthLogs: Record<string, any> = {};
      healthLogsArray.forEach((log) => {
        healthLogs[log.date] = log;
      });

      // 获取AI记忆数据
      let aiMemories: Record<string, any> = {};
      try {
        const memoriesArray = await getAllServerMemories();
        memoriesArray.forEach((memory) => {
          aiMemories[memory.expertId] = memory;
        });
      } catch (error) {
        console.warn("获取服务端AI记忆失败，尝试从本地获取:", error);
        // 如果服务端获取失败，尝试从本地IndexedDB获取
        aiMemories = memories;
      }

      // 创建导出对象
      const exportData = {
        userProfile,
        aiConfig: currentAIConfig,
        healthLogs,
        aiMemories,
      };

      // 创建并下载 JSON 文件
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      const exportFileDefaultName = `health-data-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();

      // 记录导出时间
      localStorage.setItem("lastExportTime", new Date().toISOString());

      toast({
        title: t("data.exportSuccessTitle"),
        description: t("data.exportSuccessDescription"),
      });
    } catch (error) {
      console.error("导出数据失败:", error);
      toast({
        title: t("data.exportErrorTitle"),
        description: t("data.exportErrorDescription"),
        variant: "destructive",
      });
    }
  }, [
    userProfile,
    currentAIConfig,
    getAllDailyLogs,
    getAllServerMemories,
    memories,
    toast,
  ]);

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

          // 验证导入的数据格式
          if (!importedData.userProfile || !importedData.healthLogs) {
            throw new Error("无效的数据格式");
          }

          // 使用数据迁移API导入数据到服务端
          const response = await fetch("/api/db/migrate-indexeddb", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              indexedDBData: importedData,
            }),
          });

          if (!response.ok) {
            throw new Error("数据导入失败");
          }

          const result = await response.json();
          console.log("数据导入结果:", result);

          // 更新本地状态
          setUserProfile(importedData.userProfile);
          if (importedData.aiConfig) {
            setAIConfig(importedData.aiConfig);
          }

          toast({
            title: t("data.importSuccessTitle"),
            description: t("data.importSuccessDescription"),
          });

          // 重置文件输入
          if (event.target) {
            (event.target as HTMLInputElement).value = "";
          }
        } catch (error) {
          console.error("导入数据失败:", error);
          toast({
            title: t("data.importErrorTitle"),
            description: t("data.importErrorDescription"),
            variant: "destructive",
          });
        }
      };

      reader.readAsText(file);
    },
    [setUserProfile, setAIConfig, toast]
  );

  // 清空所有数据
  const handleClearAllData = useCallback(async () => {
    try {
      // 清空 AI 记忆
      await clearAllMemories();

      // 重置用户配置和 AI 配置到默认值
      setUserProfile(defaultUserProfile);
      setAIConfig(defaultAIConfig);

      toast({
        title: t("data.clearSuccessTitle"),
        description: t("data.clearSuccessDescription"),
      });
    } catch (error) {
      console.error("清除数据失败:", error);
      toast({
        title: t("data.clearErrorTitle"),
        description: t("data.clearErrorDescription"),
        variant: "destructive",
      });
    }
  }, [clearAllMemories, setUserProfile, setAIConfig, toast]);

  // 渲染模型选择器
  const renderModelSelector = useCallback(
    (modelType: keyof AIConfig, models: OpenAIModel[], isLoading: boolean) => {
      const modelConfig = aiFormData[modelType];

      return (
        <div className="flex space-x-2 items-end">
          {models.length > 0 ? (
            <div className="flex-1">
              <Select
                value={modelConfig.name}
                onValueChange={(value) =>
                  handleAIConfigChange(modelType, "name", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("ai.selectModel")} />
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
              onChange={(e) =>
                handleAIConfigChange(modelType, "name", e.target.value)
              }
              placeholder={t("ai.modelNamePlaceholder")}
            />
          )}
          <Button
            variant="outline"
            onClick={() => fetchModels(modelType)}
            disabled={isLoading || !modelConfig.baseUrl || !modelConfig.apiKey}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{t("ai.fetchModels")}</span>
          </Button>
        </div>
      );
    },
    [aiFormData, handleAIConfigChange, fetchModels]
  );

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 sm:px-6 max-w-7xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">
        {t("title")}
      </h1>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto sm:h-10">
          <TabsTrigger
            value="profile"
            className="text-xs sm:text-sm py-2 px-2 sm:px-3"
          >
            <span className="truncate">{t("tabs.profile")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="goals"
            className="text-xs sm:text-sm py-2 px-2 sm:px-3"
          >
            <span className="truncate">{t("tabs.goals")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="text-xs sm:text-sm py-2 px-2 sm:px-3"
          >
            <span className="truncate">{t("tabs.ai")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="text-xs sm:text-sm py-2 px-2 sm:px-3"
          >
            <span className="truncate">{t("tabs.data")}</span>
          </TabsTrigger>
        </TabsList>

        {/* 个人信息 */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.title")}</CardTitle>
              <CardDescription>{t("profile.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">{t("profile.weight")}</Label>
                  <Input
                    id="weight"
                    name="weight"
                    type="number"
                    value={formData.weight}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">{t("profile.height")}</Label>
                  <Input
                    id="height"
                    name="height"
                    type="number"
                    value={formData.height}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">{t("profile.age")}</Label>
                  <Input
                    id="age"
                    name="age"
                    type="number"
                    value={formData.age}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">{t("profile.gender")}</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      handleSelectChange("gender", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("profile.gender")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("profile.male")}</SelectItem>
                      <SelectItem value="female">
                        {t("profile.female")}
                      </SelectItem>
                      <SelectItem value="other">
                        {t("profile.other")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activityLevel">
                  {t("profile.activityLevel")}
                </Label>
                <Select
                  value={formData.activityLevel}
                  onValueChange={(value) =>
                    handleSelectChange("activityLevel", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("profile.activityLevel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">
                      {t("profile.activityLevels.sedentary")}
                    </SelectItem>
                    <SelectItem value="light">
                      {t("profile.activityLevels.light")}
                    </SelectItem>
                    <SelectItem value="moderate">
                      {t("profile.activityLevels.moderate")}
                    </SelectItem>
                    <SelectItem value="active">
                      {t("profile.activityLevels.active")}
                    </SelectItem>
                    <SelectItem value="very_active">
                      {t("profile.activityLevels.very_active")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("profile.activityLevelDescription")}
                </p>
              </div>

              {/* BMR Formula Selection */}
              <div className="space-y-2">
                <Label htmlFor="bmrFormula">{t("profile.bmrFormula")}</Label>
                <Select
                  value={formData.bmrFormula || "mifflin-st-jeor"}
                  onValueChange={(value) =>
                    handleSelectChange("bmrFormula", value)
                  }
                >
                  <SelectTrigger id="bmrFormula">
                    <SelectValue placeholder={t("profile.selectBmrFormula")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mifflin-st-jeor">
                      {t("profile.mifflinStJeor")}
                    </SelectItem>
                    <SelectItem value="harris-benedict">
                      {t("profile.harrisBenedict")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("profile.bmrFormulaDescription")}
                </p>
              </div>

              {/* BMR Calculation Basis Selection */}
              <div className="space-y-2">
                <Label htmlFor="bmrCalculationBasis">
                  {t("profile.bmrCalculationBasis")}
                </Label>
                <Select
                  value={formData.bmrCalculationBasis || "totalWeight"}
                  onValueChange={(value) =>
                    handleSelectChange("bmrCalculationBasis", value)
                  }
                >
                  <SelectTrigger id="bmrCalculationBasis">
                    <SelectValue placeholder={t("profile.selectBmrBasis")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalWeight">
                      {t("profile.totalWeight")}
                    </SelectItem>
                    <SelectItem value="leanBodyMass">
                      {t("profile.leanBodyMass")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("profile.bmrBasisDescription")}
                </p>
              </div>

              {/* Body Fat Percentage Input (conditional) */}
              {formData.bmrCalculationBasis === "leanBodyMass" && (
                <div className="space-y-2">
                  <Label htmlFor="bodyFatPercentage">
                    {t("profile.bodyFatPercentage")}
                  </Label>
                  <Input
                    id="bodyFatPercentage"
                    name="bodyFatPercentage"
                    type="number"
                    value={
                      formData.bodyFatPercentage === undefined
                        ? ""
                        : String(formData.bodyFatPercentage)
                    } // Display empty string for undefined
                    onChange={handleInputChange}
                    placeholder={t("profile.bodyFatPlaceholder")}
                    min="0"
                    max="99"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("profile.bodyFatDescription")}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveProfile}>
                {t("profile.saveProfile")}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* 健康目标 */}
        <TabsContent value="goals">
          <Card>
            <CardHeader>
              <CardTitle>{t("goals.title")}</CardTitle>
              <CardDescription>{t("goals.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal">{t("goals.goalType")}</Label>
                <Select
                  value={formData.goal}
                  onValueChange={(value) => handleSelectChange("goal", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("goals.selectGoal")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lose_weight">
                      {t("goals.loseWeight")}
                    </SelectItem>
                    <SelectItem value="maintain">
                      {t("goals.maintain")}
                    </SelectItem>
                    <SelectItem value="gain_weight">
                      {t("goals.gainWeight")}
                    </SelectItem>
                    <SelectItem value="build_muscle">
                      {t("goals.buildMuscle")}
                    </SelectItem>
                    <SelectItem value="improve_health">
                      {t("goals.improveHealth")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetWeight">
                    {t("goals.targetWeight")}
                  </Label>
                  <Input
                    id="targetWeight"
                    name="targetWeight"
                    type="number"
                    value={formData.targetWeight || ""}
                    onChange={handleInputChange}
                    placeholder={t("goals.optional")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetCalories">
                    {t("goals.targetCalories")}
                  </Label>
                  <Input
                    id="targetCalories"
                    name="targetCalories"
                    type="number"
                    value={formData.targetCalories || ""}
                    onChange={handleInputChange}
                    placeholder={t("goals.optional")}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="notes">{t("goals.notes")}</Label>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("goals.notesSubtitle")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes || ""}
                    onChange={handleTextareaChange}
                    placeholder={t("goals.notesPlaceholder")}
                    className="min-h-[120px] text-base"
                  />
                  <div className="text-xs text-muted-foreground whitespace-pre-line">
                    {t("goals.notesDescription")}
                  </div>
                </div>
              </div>

              {/* 专业模式切换 */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="professional-mode">
                      {t("goals.professionalMode")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("goals.professionalModeDescription")}
                    </p>
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
                      <Label htmlFor="medicalHistory">
                        {t("goals.medicalHistory")}
                      </Label>
                      <Textarea
                        id="medicalHistory"
                        name="medicalHistory"
                        value={formData.medicalHistory || ""}
                        onChange={handleTextareaChange}
                        placeholder={t("goals.medicalHistoryPlaceholder")}
                        className="min-h-[150px] text-base"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="lifestyle">{t("goals.lifestyle")}</Label>
                      <Textarea
                        id="lifestyle"
                        name="lifestyle"
                        value={formData.lifestyle || ""}
                        onChange={handleTextareaChange}
                        placeholder={t("goals.lifestylePlaceholder")}
                        className="min-h-[150px] text-base"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="healthAwareness">
                        {t("goals.healthAwareness")}
                      </Label>
                      <Textarea
                        id="healthAwareness"
                        name="healthAwareness"
                        value={formData.healthAwareness || ""}
                        onChange={handleTextareaChange}
                        placeholder={t("goals.healthAwarenessPlaceholder")}
                        className="min-h-[150px] text-base"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveProfile}>
                {t("goals.saveGoals")}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* AI 配置 */}
        <TabsContent value="ai">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* 工作模型/Agents模型 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("ai.agentModel")}</CardTitle>
                  <CardDescription>
                    {t("ai.agentModelDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="agent-base-url">{t("ai.baseUrl")}</Label>
                      <Input
                        id="agent-base-url"
                        value={aiFormData.agentModel.baseUrl}
                        onChange={(e) =>
                          handleAIConfigChange(
                            "agentModel",
                            "baseUrl",
                            e.target.value
                          )
                        }
                        placeholder={t("ai.baseUrlPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agent-api-key">{t("ai.apiKey")}</Label>
                      <Input
                        id="agent-api-key"
                        type="password"
                        value={aiFormData.agentModel.apiKey}
                        onChange={(e) =>
                          handleAIConfigChange(
                            "agentModel",
                            "apiKey",
                            e.target.value
                          )
                        }
                        placeholder={t("ai.apiKeyPlaceholder")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-model-name">
                      {t("ai.modelName")}
                    </Label>
                    {renderModelSelector(
                      "agentModel",
                      agentModels,
                      loadingAgentModels
                    )}
                    {agentModels.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("ai.modelsFound", { count: agentModels.length })}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    onClick={() => handleTestAIConfig("agentModel")}
                  >
                    {t("ai.testConnection")}
                  </Button>
                </CardFooter>
              </Card>

              {/* 对话模型 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("ai.chatModel")}</CardTitle>
                  <CardDescription>
                    {t("ai.chatModelDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="chat-base-url">{t("ai.baseUrl")}</Label>
                      <Input
                        id="chat-base-url"
                        value={aiFormData.chatModel.baseUrl}
                        onChange={(e) =>
                          handleAIConfigChange(
                            "chatModel",
                            "baseUrl",
                            e.target.value
                          )
                        }
                        placeholder={t("ai.baseUrlPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chat-api-key">{t("ai.apiKey")}</Label>
                      <Input
                        id="chat-api-key"
                        type="password"
                        value={aiFormData.chatModel.apiKey}
                        onChange={(e) =>
                          handleAIConfigChange(
                            "chatModel",
                            "apiKey",
                            e.target.value
                          )
                        }
                        placeholder={t("ai.apiKeyPlaceholder")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chat-model-name">{t("ai.modelName")}</Label>
                    {renderModelSelector(
                      "chatModel",
                      chatModels,
                      loadingChatModels
                    )}
                    {chatModels.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("ai.modelsFound", { count: chatModels.length })}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    onClick={() => handleTestAIConfig("chatModel")}
                  >
                    {t("ai.testConnection")}
                  </Button>
                </CardFooter>
              </Card>

              {/* 视觉模型 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("ai.visionModel")}</CardTitle>
                  <CardDescription>
                    {t("ai.visionModelDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="vision-base-url">{t("ai.baseUrl")}</Label>
                      <Input
                        id="vision-base-url"
                        value={aiFormData.visionModel.baseUrl}
                        onChange={(e) =>
                          handleAIConfigChange(
                            "visionModel",
                            "baseUrl",
                            e.target.value
                          )
                        }
                        placeholder={t("ai.baseUrlPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vision-api-key">{t("ai.apiKey")}</Label>
                      <Input
                        id="vision-api-key"
                        type="password"
                        value={aiFormData.visionModel.apiKey}
                        onChange={(e) =>
                          handleAIConfigChange(
                            "visionModel",
                            "apiKey",
                            e.target.value
                          )
                        }
                        placeholder={t("ai.apiKeyPlaceholder")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vision-model-name">
                      {t("ai.modelName")}
                    </Label>
                    {renderModelSelector(
                      "visionModel",
                      visionModels,
                      loadingVisionModels
                    )}
                    {visionModels.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("ai.modelsFound", { count: visionModels.length })}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    onClick={() => handleTestAIConfig("visionModel")}
                  >
                    {t("ai.testConnection")}
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <Button onClick={handleSaveAIConfig}>{t("ai.saveConfig")}</Button>

            {/* AI记忆管理 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t("ai.memoryManagement.title")}</CardTitle>
                <CardDescription>
                  {t("ai.memoryManagement.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(memories).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("ai.memoryManagement.noMemoryData")}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(memories).map(([expertId, memory]) => {
                      const getExpertName = (id: string) => {
                        return t(`ai.memoryManagement.expertNames.${id}`) || id;
                      };

                      return (
                        <Card
                          key={expertId}
                          className="border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
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
                              {new Date(memory.lastUpdated).toLocaleDateString(
                                "zh-CN"
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="px-4 pb-3">
                            <div className="space-y-2">
                              <div className="relative">
                                <Textarea
                                  value={editingMemories[expertId] || ""}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 500) {
                                      handleMemoryContentChange(
                                        expertId,
                                        e.target.value
                                      );
                                    }
                                  }}
                                  placeholder={t(
                                    "ai.memoryManagement.memoryPlaceholder"
                                  )}
                                  className="min-h-[60px] resize-none text-sm"
                                  maxLength={500}
                                />
                                {/* 保存状态指示器 */}
                                {savingMemories[expertId] && (
                                  <div className="absolute top-1 right-1 flex items-center space-x-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span>
                                      {t("ai.memoryManagement.saving")}
                                    </span>
                                  </div>
                                )}
                                {hasUnsavedChanges(expertId) &&
                                  !savingMemories[expertId] && (
                                    <div className="absolute top-1 right-1 flex items-center space-x-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div>
                                      <span>
                                        {t("ai.memoryManagement.unsaved")}
                                      </span>
                                    </div>
                                  )}
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="text-xs text-muted-foreground">
                                  {(editingMemories[expertId] || "").length >
                                    400 && (
                                    <span className="text-amber-600">
                                      即将达到上限
                                    </span>
                                  )}
                                  {hasUnsavedChanges(expertId) && (
                                    <span className="text-amber-600">
                                      3秒后自动保存
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
                                      {savingMemories[expertId]
                                        ? t("ai.memoryManagement.saving")
                                        : t("common.save")}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      clearMemory(expertId)
                                        .then(() => {
                                          // 同时清空编辑状态
                                          setEditingMemories((prev) => ({
                                            ...prev,
                                            [expertId]: "",
                                          }));
                                          toast({
                                            title: t(
                                              "ai.memoryManagement.allMemoriesCleared"
                                            ),
                                            description: `${getExpertName(
                                              expertId
                                            )}的记忆已清空`,
                                          });
                                        })
                                        .catch((error) => {
                                          toast({
                                            title: t(
                                              "ai.memoryManagement.clearFailed"
                                            ),
                                            description: error.message,
                                            variant: "destructive",
                                          });
                                        });
                                    }}
                                    className="h-6 px-2 text-xs"
                                  >
                                    {t("common.clear")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {Object.entries(memories).length > 0 && (
                  <div className="pt-4 border-t">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          {t("ai.memoryManagement.clearAllMemories")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("ai.memoryManagement.confirmClearTitle")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("ai.memoryManagement.confirmClearDescription")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("ai.memoryManagement.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              clearAllMemories()
                                .then(() => {
                                  toast({
                                    title: t(
                                      "ai.memoryManagement.allMemoriesCleared"
                                    ),
                                    description: t(
                                      "ai.memoryManagement.allMemoriesClearedDescription"
                                    ),
                                  });
                                })
                                .catch((error) => {
                                  toast({
                                    title: t("ai.memoryManagement.clearFailed"),
                                    description: error.message,
                                    variant: "destructive",
                                  });
                                });
                            }}
                          >
                            {t("ai.memoryManagement.confirmClear")}
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
            <CardHeader>
              <CardTitle>{t("data.title")}</CardTitle>
              <CardDescription>{t("data.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t("data.exportData")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("data.exportDescription")}
                </p>
                <Button onClick={handleExportData}>
                  {t("data.exportAllData")}
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t("data.importData")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("data.importDescription")}
                </p>
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
                    {t("data.selectFile")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t("data.clearData")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("data.clearDescription")}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      {t("data.clearAllData")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("data.confirmClearTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("data.confirmClearDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("data.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAllData}>
                        {t("data.confirmClear")}
                      </AlertDialogAction>
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
          <CardTitle>{t("about.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">{t("about.privacyTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("about.privacyDescription")}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium">{t("about.usageTitle")}</h3>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>{t("about.usage1")}</li>
              <li>{t("about.usage2")}</li>
              <li>{t("about.usage3")}</li>
              <li>{t("about.usage4")}</li>
              <li>{t("about.usage5")}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-medium">{t("about.versionTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("about.versionInfo")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-6 max-w-8xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">加载设置...</p>
            </div>
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
