import { useState, useEffect } from "react"
import type { SmartSuggestionsResponse, SmartSuggestion, SmartSuggestionCategory } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useTranslation } from "@/hooks/use-i18n"
import { Progress } from "@/components/ui/progress"
import {
  Brain,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Settings2,
  Stethoscope,
  Dumbbell,
  Flame,
  User,
  Heart,
  Activity,
  Zap,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"

interface SmartSuggestionsProps {
  suggestions?: SmartSuggestionsResponse
  isLoading?: boolean
  onRefresh?: () => void
  currentDate?: string
  progress?: {
    status: 'idle' | 'loading' | 'partial' | 'success' | 'error';
    message?: string;
    categories: Record<string, {
      status: 'pending' | 'generating' | 'success' | 'error';
      message?: string;
    }>;
  }
  selectedExperts: string[];
  onSelectedExpertsChange: (experts: string[]) => void;
}

const expertOptions = [
  { id: 'nutrition', name: '营养师', icon: Stethoscope },
  { id: 'exercise', name: '运动专家', icon: Dumbbell },
  { id: 'metabolism', name: '代谢专家', icon: Flame },
  { id: 'behavior', name: '行为专家', icon: Brain },
  { id: 'timing', name: '时机专家', icon: Clock },
  { id: 'wellness', name: '整体健康', icon: Heart },
];

export function SmartSuggestions({
  suggestions,
  isLoading,
  onRefresh,
  currentDate,
  progress = { status: 'idle', categories: {} },
  selectedExperts,
  onSelectedExpertsChange,
}: SmartSuggestionsProps) {
  const t = useTranslation('dashboard.suggestions')
  const tChatSuggestions = useTranslation('chat.suggestions')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [isClient, setIsClient] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(0)
  const [animateSuggestion, setAnimateSuggestion] = useState<string | null>(null)
  const { toast } = useToast()

  const handleExpertSelection = (expertId: string) => {
    const newSelection = selectedExperts.includes(expertId)
      ? selectedExperts.filter(id => id !== expertId)
      : [...selectedExperts, expertId];

    if (newSelection.length > 3) {
      toast({
        title: "选择已达上限",
        description: "最多只能选择3位专家提供建议。",
        variant: "default",
      });
      return;
    }

    onSelectedExpertsChange(newSelection);
  };

  // 添加自定义动画样式
  useEffect(() => {
    // 添加自定义动画样式到文档头
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes slideIn {
        0% {
          opacity: 0;
          transform: translateY(-10px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-slideIn {
        animation: slideIn 0.5s ease-out forwards;
      }

      @keyframes pulse-border {
        0% {
          border-color: rgba(79, 70, 229, 0.2);
        }
        50% {
          border-color: rgba(79, 70, 229, 0.8);
        }
        100% {
          border-color: rgba(79, 70, 229, 0.2);
        }
      }
      .animate-pulse-border {
        animation: pulse-border 1.5s infinite;
      }
    `;
    document.head.appendChild(styleEl);

    // 清理函数
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // 类别名称映射：中文 -> 英文键
  const categoryKeyMap: Record<string, string> = {
    "营养配比优化": "nutritionOptimization",
    "运动处方优化": "exerciseOptimization",
    "代谢效率提升": "metabolismEnhancement",
    "代谢调节优化": "metabolismEnhancement", // 别名映射
    "行为习惯优化": "behaviorOptimization",
    "时机优化策略": "timingOptimization",
    "整体健康优化": "overallHealthOptimization",
    "睡眠优化": "sleepOptimization",
    "压力管理": "stressManagement",
    "水分补充": "hydrationOptimization",
    "心理健康": "mentalHealth",
    // 英文键名映射（API返回的键名）
    "nutrition": "nutritionOptimization",
    "exercise": "exerciseOptimization",
    "metabolism": "metabolismEnhancement",
    "behavior": "behaviorOptimization",
    "timing": "timingOptimization",
    "wellness": "overallHealthOptimization"
  }

  // 获取翻译后的类别名称
  const getCategoryDisplayName = (categoryName: string) => {
    // 直接映射常见的分类名称
    const directMapping: Record<string, string> = {
      "营养配比优化": "营养配比优化",
      "运动处方优化": "运动处方优化",
      "代谢调节优化": "代谢调节优化",
      "代谢效率提升": "代谢效率提升",
      "行为习惯优化": "行为习惯优化",
      "时机优化策略": "时机优化策略",
      "整体健康优化": "整体健康优化",
      "睡眠优化": "睡眠优化",
      "压力管理": "压力管理",
      "水分补充": "水分补充",
      "心理健康": "心理健康",
      // API返回的英文键名
      "nutrition": "营养配比优化",
      "exercise": "运动处方优化",
      "metabolism": "代谢调节优化",
      "behavior": "行为习惯优化",
      "timing": "时机优化策略",
      "wellness": "整体健康优化"
    }

    // 直接返回映射的中文名称
    if (directMapping[categoryName]) {
      return directMapping[categoryName]
    }

    // 如果没有映射，返回原始名称
    return categoryName
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  // 当建议数据更新时，自动展开所有分类
  useEffect(() => {
    if (suggestions && suggestions.suggestions && suggestions.suggestions.length > 0) {
      const allKeys = new Set(suggestions.suggestions.map(category => category.key));
      setExpandedCategories(allKeys);

      // 检查是否有新的更新
      if (suggestions.lastUpdated && suggestions.lastUpdated !== lastUpdated) {
        setLastUpdated(suggestions.lastUpdated);

        // 如果是部分结果，设置动画状态
        if (suggestions.isPartial) {
          // 找到最新更新的类别
          const currentCategoryKey = suggestions.currentCategory;
          const updatedCategory = currentCategoryKey
            ? suggestions.suggestions.find(cat => cat.category === currentCategoryKey)
            : suggestions.suggestions.find(cat =>
                cat.category === Object.keys(progress.categories).find(key =>
                  progress.categories[key].status === 'success' ||
                  progress.categories[key].status === 'generating'
                )
              );

          if (updatedCategory) {
            setAnimateSuggestion(updatedCategory.key);

            // 如果有最新添加的单条建议，播放更明显的动画
            if (suggestions.recentSuggestion) {
              // 移除音效代码
            }

            // 3秒后清除动画状态
            setTimeout(() => setAnimateSuggestion(null), 3000);
          }
        }
      }
    }
  }, [suggestions, progress, lastUpdated]);

  const toggleCategory = (key: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedCategories(newExpanded)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="h-3 w-3" />
      case 'medium': return <Clock className="h-3 w-3" />
      case 'low': return <CheckCircle2 className="h-3 w-3" />
      default: return null
    }
  }

  // 获取进度状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-muted-foreground" />
      case 'generating': return <Loader2 className="h-4 w-4 text-primary animate-spin" />
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  // 添加一个辅助函数来计算进度值
  const getProgressValue = (status: 'idle' | 'loading' | 'partial' | 'success' | 'error'): number => {
    if (status === 'success') return 100;
    if (status === 'partial') return 75;
    if (status === 'loading') return 25;
    if (status === 'error') return 50;
    return 0; // idle
  };

  // 渲染单个建议项
  const renderSuggestionItem = (suggestion: SmartSuggestion, index: number, category: SmartSuggestionCategory) => {
    const isRecentSuggestion = suggestions?.recentSuggestion &&
                              suggestions.currentCategory === category.category &&
                              index === category.suggestions.length - 1;

    return (
      <div
        key={index}
        className={`pl-2 py-1 text-sm ${
          isRecentSuggestion ? 'border-l-2 border-l-primary' : ''
        } relative mb-1`}
      >
        <div className="flex items-start space-x-1">
          <span className="text-xs flex-shrink-0">{suggestion.icon}</span>
          <div className="min-w-0 flex-1">
            <h4 className={`font-medium text-xs ${isRecentSuggestion ? 'text-primary' : ''}`}>
              {suggestion.title}
              {isRecentSuggestion && <span className="ml-1 text-primary text-xs">•</span>}
            </h4>
            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {suggestion.description && suggestion.description.split('\n').map((line: string, lineIndex: number) => {
                // 跳过空行
                if (!line.trim()) {
                  return <div key={lineIndex} className="h-1" />
                }

                // 处理基本的Markdown格式
                const processedLine = line.trim()
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>') // 粗体
                  .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>') // 斜体
                  .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>') // 代码
                  .replace(/^- (.*)/, '<span class="flex items-start"><span class="text-primary mr-1 flex-shrink-0">•</span><span class="flex-1">$1</span></span>') // 列表项
                  .replace(/^(\d+)\. (.*)/, '<span class="flex items-start"><span class="text-primary mr-1 flex-shrink-0 font-medium">$1.</span><span class="flex-1">$2</span></span>') // 数字列表

                return (
                  <div key={lineIndex} className="leading-relaxed">
                    {processedLine.includes('<') ? (
                      <span dangerouslySetInnerHTML={{ __html: processedLine }} />
                    ) : (
                      <span>{processedLine}</span>
                    )}
                  </div>
                )
              })}
            </div>
            {suggestion.actionable && (
              <span className="text-xs text-primary">可执行</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 确保即使只有部分数据也能正确显示
  const renderSuggestions = () => {
    if (!suggestions || !suggestions.suggestions || !Array.isArray(suggestions.suggestions)) {
      return null;
    }

    return (
      <div className="space-y-1 flex-1 overflow-y-auto">
        {suggestions.suggestions.map((category) => (
          <Collapsible
            key={category.key}
            open={expandedCategories.has(category.key)}
            onOpenChange={() => toggleCategory(category.key)}
            defaultOpen={true}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={`w-full justify-between py-1.5 px-2 h-auto text-left transition-all ${
                  suggestions?.currentCategory === category.category ? 'text-primary' : ''
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <span className="text-base flex-shrink-0">
                    {category.suggestions && category.suggestions[0]?.icon || '💡'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate flex items-center">
                      {getCategoryDisplayName(category.category)}
                      {suggestions?.currentCategory === category.category && (
                        <span className="ml-1 text-xs text-primary">•</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {category.summary}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <span className={`text-xs px-1 ${getPriorityColor(category.priority)}`}>
                    {category.priority}
                  </span>
                  {expandedCategories.has(category.key) ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pb-1">
              <div className="space-y-1 mt-1">
                {category.suggestions && category.suggestions.map((suggestion, index) =>
                  renderSuggestionItem(suggestion, index, category)
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  // 在客户端渲染之前显示简化版本
  if (!isClient) {
    return (
      <Card className="health-card h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="mr-2 h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">{t('loading')}</p>
        </CardContent>
      </Card>
    )
  }

  // 显示进度状态
  if (isLoading && progress.status !== 'idle') {
    // 如果是部分结果且已有建议，则显示建议内容而不是进度指示器
    if (progress.status === 'partial' && suggestions && suggestions.suggestions && suggestions.suggestions.length > 0) {
      return (
        <Card className="health-card h-full flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-base">
              <Brain className="mr-2 h-4 w-4 text-primary" />
              {t('title')}
              {suggestions?.isPartial && (
                <span className="ml-2 text-xs text-primary">
                  {t('partialResults')}
                </span>
              )}
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  className="ml-auto h-6 w-6 p-0"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </CardTitle>
            {suggestions?.currentCategory && (
              <div className="flex items-center text-xs mt-1">
                <span className="text-primary mr-1">•</span>
                <span className="text-muted-foreground">
                  正在生成: {getCategoryDisplayName(suggestions.currentCategory)}
                </span>
              </div>
            )}
            <Progress
              value={getProgressValue(progress.status)}
              className="h-0.5 mt-2"
            />
          </CardHeader>
          <CardContent className="pt-0 flex-1 flex flex-col">
            {renderSuggestions()}

            {suggestions && suggestions.generatedAt && (
              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>
                    {new Date(suggestions.generatedAt).toLocaleString()}
                  </span>

                  {/* 简化的建议计数器 */}
                  {suggestions.isPartial && suggestions.suggestions && (
                    <span className="text-primary">
                      {suggestions.suggestions.reduce((count, category) => count + category.suggestions.length, 0)} 条
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // 如果没有部分结果或者没有建议，则显示简化的进度指示器
    return (
      <Card className="health-card h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-base">
            <Brain className="mr-2 h-4 w-4 text-primary" />
            {t('title')}
            <div className="ml-auto">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            </div>
          </CardTitle>
          <Progress
            value={getProgressValue(progress.status)}
            className="h-0.5 mt-2"
          />
        </CardHeader>
        <CardContent className="pt-0 flex-1">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground text-center">
              {progress.message || t('generatingProgress')}
              {progress.status === 'partial' && suggestions?.currentCategory && (
                <span className="ml-1 text-primary">
                  {getCategoryDisplayName(suggestions.currentCategory)}
                </span>
              )}
            </p>

            {/* 简化的类别状态列表 */}
            <div className="space-y-1">
              {Object.entries(progress.categories).map(([key, status]) => (
                <div key={key} className="flex items-center justify-between py-1 border-b border-muted/30">
                  <div className="flex items-center">
                    {status.status === 'generating' ? (
                      <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    ) : status.status === 'success' ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 mr-2" />
                    ) : (
                      <span className="w-1.5 h-1.5 bg-muted rounded-full mr-2"></span>
                    )}
                    <span className="text-xs">{getCategoryDisplayName(key)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 简化的部分结果预览 */}
            {progress.status === 'partial' && suggestions?.recentSuggestion && (
              <div className="border-l-2 border-primary pl-2 py-1">
                <div className="text-xs text-primary mb-1">
                  最新添加:
                </div>
                <div className="text-xs">
                  <span className="font-medium">{suggestions.recentSuggestion.title}</span>
                  <p className="mt-0.5 text-muted-foreground line-clamp-2">
                    {suggestions.recentSuggestion.description}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 常规加载状态
  if (isLoading) {
    return (
      <Card className="health-card h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-base">
            <Brain className="mr-2 h-4 w-4 text-primary" />
            {t('title')}
            <div className="ml-auto">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">{t('loading')}</p>
        </CardContent>
      </Card>
    )
  }

  if (!suggestions || !suggestions.suggestions.length) {
    return (
      <Card className="health-card h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-xl md:text-2xl font-semibold">
            <div className="flex items-center">
              <Brain className="mr-2 h-4 w-4 text-primary" />
              {t('title')}
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <div className="space-y-2">
                    <p className="font-medium text-sm px-2">订阅专家建议</p>
                    <p className="text-xs text-muted-foreground px-2">选择最多3位专家</p>
                    {expertOptions.map((expert) => (
                      <div
                        key={expert.id}
                        className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                        onClick={() => handleExpertSelection(expert.id)}
                      >
                        <Checkbox
                          id={`expert-${expert.id}`}
                          checked={selectedExperts.includes(expert.id)}
                          disabled={selectedExperts.length >= 3 && !selectedExperts.includes(expert.id)}
                        />
                        <expert.icon className="h-4 w-4" />
                        <label
                          htmlFor={`expert-${expert.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {expert.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  className="h-6 w-6 p-0"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex flex-col items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-2xl bg-muted/50">
              <Sparkles className="h-8 w-8 md:h-10 md:w-10" />
            </div>
            <p className="text-lg md:text-xl font-medium mb-2 md:mb-3">{t('noSuggestions')}</p>
            <p className="text-sm md:text-lg opacity-75">{t('generatePrompt')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="health-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xl md:text-2xl font-semibold">
          <div className="flex items-center">
            <Brain className="mr-2 h-4 w-4 text-primary" />
            {t('title')}
            {suggestions?.isPartial && (
              <span className="ml-2 text-xs text-primary">
                {t('partialResults')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="space-y-2">
                  <p className="font-medium text-sm px-2">订阅专家建议</p>
                  <p className="text-xs text-muted-foreground px-2">选择最多3位专家</p>
                  {expertOptions.map((expert) => (
                    <div
                      key={expert.id}
                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => handleExpertSelection(expert.id)}
                    >
                      <Checkbox
                        id={`expert-${expert.id}-2`}
                        checked={selectedExperts.includes(expert.id)}
                        disabled={selectedExperts.length >= 3 && !selectedExperts.includes(expert.id)}
                      />
                      <expert.icon className="h-4 w-4" />
                      <label
                        htmlFor={`expert-${expert.id}-2`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {expert.name}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="ml-auto h-6 w-6 p-0"
                disabled={isLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </CardTitle>
        {currentDate && (
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(currentDate).toLocaleDateString('zh-CN')}
          </p>
        )}

        {/* 极简进度显示 */}
        {suggestions?.isPartial && progress.status !== 'idle' && suggestions?.currentCategory && (
          <div className="mt-1 flex items-center text-xs">
            <span className="text-primary mr-1">•</span>
            <span className="text-muted-foreground">
              正在生成: {getCategoryDisplayName(suggestions.currentCategory)}
            </span>
          </div>
        )}
        {suggestions?.isPartial && (
          <Progress
            value={getProgressValue(progress.status)}
            className="h-0.5 mt-2"
          />
        )}
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        {renderSuggestions()}

        {suggestions && suggestions.generatedAt && (
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>
                {new Date(suggestions.generatedAt).toLocaleString()}
              </span>

              {/* 极简建议计数器 */}
              {suggestions.isPartial && suggestions.suggestions && (
                <span className="text-primary">
                  {suggestions.suggestions.reduce((count, category) => count + category.suggestions.length, 0)} 条
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
