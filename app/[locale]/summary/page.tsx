"use client";

import { useState, useEffect, use, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTranslation } from "@/hooks/use-i18n";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useDailyLogCache } from "@/hooks/use-daily-log-cache";
import { useToast } from "@/hooks/use-toast";
import type {
  DailyLog,
  UserProfile,
  SmartSuggestionsResponse,
} from "@/lib/types";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
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
  Sparkles,
  Brain,
  Camera,
  Download,
} from "lucide-react";
import Link from "next/link";
import { FoodEntryCard } from "@/components/food-entry-card";
import { ExerciseEntryCard } from "@/components/exercise-entry-card";

const defaultUserProfile: UserProfile = {
  weight: 70,
  height: 170,
  age: 25,
  gender: "male",
  activityLevel: "sedentary",
  goal: "maintain",
  bmrFormula: "mifflin-st-jeor",
  bmrCalculationBasis: "totalWeight",
};

// 内部组件，处理 useSearchParams
function SummaryPageContent({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = useTranslation("summary");
  const tDashboard = useTranslation("dashboard");
  const { toast } = useToast();
  const { theme } = useTheme();
  const [userProfile] = useLocalStorage("userProfile", defaultUserProfile);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [smartSuggestions, setSmartSuggestions] =
    useState<SmartSuggestionsResponse | null>(null);
  const [isSmartSuggestionsOpen, setIsSmartSuggestionsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const summaryContentRef = useRef<HTMLDivElement>(null);

  const { getDailyLog } = useDailyLogCache();
  const searchParams = useSearchParams();

  // 解包params Promise
  const resolvedParams = use(params);

  // 获取当前语言环境
  const currentLocale = resolvedParams.locale === "en" ? enUS : zhCN;

  // 处理URL中的日期参数
  useEffect(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      // 使用本地时间解析日期，避免时区问题
      const [year, month, day] = dateParam.split("-").map(Number);
      if (year && month && day) {
        const parsedDate = new Date(year, month - 1, day); // month是0-based
        if (!isNaN(parsedDate.getTime())) {
          setSelectedDate(parsedDate);
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const loadDailyLog = async () => {
      const dateKey = format(selectedDate, "yyyy-MM-dd");
      try {
        const log = await getDailyLog(dateKey);
        setDailyLog(log);
      } catch (error) {
        console.error("加载汇总页面日志数据失败：", error);
        setDailyLog(null);
      }
    };
    loadDailyLog();
  }, [selectedDate, getDailyLog]);

  useEffect(() => {
    // 加载智能建议 - 使用与主页面相同的存储格式
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const allSuggestions = localStorage.getItem("smartSuggestions");
    if (allSuggestions) {
      try {
        const suggestionsData = JSON.parse(allSuggestions);
        const dateSuggestions = suggestionsData[dateKey];
        setSmartSuggestions(dateSuggestions || null);
      } catch (error) {
        console.warn("Failed to parse smart suggestions:", error);
        setSmartSuggestions(null);
      }
    } else {
      setSmartSuggestions(null);
    }
  }, [selectedDate]);

  // Badge修复函数
  const fixBadgeElements = async (container: HTMLElement) => {
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    // 查找所有可能的Badge元素
    const badgeSelectors = [
      ".inline-flex",
      ".badge",
      '[class*="badge"]',
      'span[class*="bg-"]',
      'span[class*="px-"]',
      'span[class*="py-"]',
      'span[class*="text-xs"]',
      'span[class*="rounded-full"]',
      'span[class*="items-center"]',
    ];

    badgeSelectors.forEach((selector) => {
      try {
        const elements = container.querySelectorAll(selector);
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const className = htmlEl.className || "";

          // 检查是否是Badge类型的元素
          if (
            htmlEl.tagName === "SPAN" &&
            (className.includes("inline-flex") ||
              className.includes("bg-") ||
              className.includes("px-") ||
              className.includes("py-") ||
              className.includes("rounded-full") ||
              className.includes("items-center"))
          ) {
            // 回到最简单的方法 - 只修复关键样式
            console.log(
              "修复Badge元素:",
              htmlEl,
              "原始文本:",
              htmlEl.textContent
            );

            // 只设置最关键的样式，不要过度修改
            htmlEl.style.display = "inline-flex";
            htmlEl.style.alignItems = "center";
            htmlEl.style.justifyContent = "center";
            htmlEl.style.borderRadius = "9999px";
            htmlEl.style.padding = "1px 8px";
            htmlEl.style.fontSize = "0.75rem";
            htmlEl.style.fontWeight = "500";
            htmlEl.style.lineHeight = "1";
            htmlEl.style.whiteSpace = "nowrap";
            htmlEl.style.verticalAlign = "middle";
            htmlEl.style.boxSizing = "border-box";
            htmlEl.style.height = "18px";
            htmlEl.style.minHeight = "18px";
            // 增加偏移量，确保能看到变化
            htmlEl.style.transform = "translateY(-2px)";

            // 强制应用样式
            htmlEl.style.setProperty(
              "transform",
              "translateY(-2px)",
              "important"
            );
            htmlEl.style.setProperty("padding-top", "0px", "important");
            htmlEl.style.setProperty("padding-bottom", "2px", "important");

            // 已经重新创建了Badge结构，不需要额外处理

            // 设置背景色
            if (className.includes("bg-primary")) {
              htmlEl.style.backgroundColor = isDark
                ? "rgba(5, 150, 105, 0.2)"
                : "rgba(5, 150, 105, 0.1)";
              htmlEl.style.color = "#059669";
            } else if (className.includes("bg-green")) {
              htmlEl.style.backgroundColor = isDark
                ? "rgba(34, 197, 94, 0.2)"
                : "#dcfce7";
              htmlEl.style.color = isDark ? "#4ade80" : "#166534";
            } else if (className.includes("bg-red")) {
              htmlEl.style.backgroundColor = isDark
                ? "rgba(239, 68, 68, 0.2)"
                : "#fee2e2";
              htmlEl.style.color = isDark ? "#f87171" : "#991b1b";
            } else if (className.includes("bg-yellow")) {
              htmlEl.style.backgroundColor = isDark
                ? "rgba(245, 158, 11, 0.2)"
                : "#fef3c7";
              htmlEl.style.color = isDark ? "#fbbf24" : "#92400e";
            } else if (className.includes("bg-gray")) {
              htmlEl.style.backgroundColor = isDark
                ? "rgba(156, 163, 175, 0.2)"
                : "#f3f4f6";
              htmlEl.style.color = isDark ? "#d1d5db" : "#374151";
            }

            console.log(
              "Fixed badge element:",
              htmlEl,
              "className:",
              className
            );
          }
        });
      } catch (error) {
        console.warn("Error fixing badges with selector:", selector, error);
      }
    });

    // 等待样式应用
    await new Promise((resolve) => setTimeout(resolve, 100));
  };

  // 展开所有可折叠内容的函数 - 但排除Smart Suggestions
  const expandAllCollapsibleContent = async (container: HTMLElement) => {
    try {
      // Smart Suggestions不需要展开，保持原始状态
      console.log("Smart Suggestions保持原始状态，不包含在截图中");

      // 查找所有Radix UI Collapsible相关元素
      const collapsibleTriggers = container.querySelectorAll(
        "[data-radix-collection-item]"
      );
      const collapsibleRoots = container.querySelectorAll("[data-state]");
      const collapsibleContents = container.querySelectorAll(
        "[data-radix-collapsible-content]"
      );

      console.log("找到可折叠元素:", {
        triggers: collapsibleTriggers.length,
        roots: collapsibleRoots.length,
        contents: collapsibleContents.length,
      });

      // 强制展开所有Radix UI Collapsible
      collapsibleRoots.forEach((el) => {
        const htmlEl = el as HTMLElement;
        console.log(
          "处理可折叠根元素:",
          htmlEl,
          "当前状态:",
          htmlEl.getAttribute("data-state")
        );

        if (htmlEl.hasAttribute("data-state")) {
          htmlEl.setAttribute("data-state", "open");
        }
        if (htmlEl.hasAttribute("aria-expanded")) {
          htmlEl.setAttribute("aria-expanded", "true");
        }
      });

      // 强制显示所有CollapsibleContent
      collapsibleContents.forEach((el) => {
        const htmlEl = el as HTMLElement;
        console.log("处理可折叠内容:", htmlEl);

        htmlEl.style.display = "block";
        htmlEl.style.visibility = "visible";
        htmlEl.style.opacity = "1";
        htmlEl.style.height = "auto";
        htmlEl.style.maxHeight = "none";
        htmlEl.style.overflow = "visible";
        htmlEl.setAttribute("data-state", "open");
      });

      // 查找所有可能的可折叠元素
      const allCollapsibleElements = container.querySelectorAll(
        '[data-state="closed"], .collapsed, [aria-expanded="false"], [style*="display: none"], [style*="height: 0"]'
      );

      allCollapsibleElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        console.log("处理其他可折叠元素:", htmlEl);

        // 展开所有状态
        if (htmlEl.hasAttribute("data-state")) {
          htmlEl.setAttribute("data-state", "open");
        }
        if (htmlEl.hasAttribute("aria-expanded")) {
          htmlEl.setAttribute("aria-expanded", "true");
        }

        // 强制显示
        htmlEl.style.display = "block";
        htmlEl.style.visibility = "visible";
        htmlEl.style.opacity = "1";
        htmlEl.style.height = "auto";
        htmlEl.style.maxHeight = "none";
        htmlEl.style.overflow = "visible";
      });

      console.log("展开了", allCollapsibleElements.length, "个可折叠元素");

      // 等待内容完全展开
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (error) {
      console.warn("展开可折叠内容时出错:", error);
    }
  };

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
      };

      // 保存所有卡片的原始样式
      const cards = container.querySelectorAll(".card, .health-card");
      const originalCardStyles = Array.from(cards).map((card) => {
        const cardEl = card as HTMLElement;
        return {
          element: cardEl,
          width: cardEl.style.width,
          maxWidth: cardEl.style.maxWidth,
          height: cardEl.style.height,
          maxHeight: cardEl.style.maxHeight,
          overflow: cardEl.style.overflow,
        };
      });

      // 临时设置容器为适合内容的宽度和高度
      container.style.width = "fit-content";
      container.style.maxWidth = "800px";
      container.style.minWidth = "600px";
      container.style.height = "auto";
      container.style.maxHeight = "none";
      container.style.minHeight = "auto";

      // 确保所有子元素也适应内容尺寸
      cards.forEach((card) => {
        const cardEl = card as HTMLElement;
        cardEl.style.width = "100%";
        cardEl.style.maxWidth = "none";
        cardEl.style.height = "auto";
        cardEl.style.maxHeight = "none";
        cardEl.style.overflow = "visible";
      });

      // 强制重新计算布局
      container.offsetWidth;
      container.offsetHeight;

      console.log("优化后的容器尺寸:", {
        width: container.offsetWidth,
        height: container.offsetHeight,
        scrollHeight: container.scrollHeight,
      });

      // 等待布局稳定
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 返回恢复函数
      return () => {
        try {
          // 恢复容器样式
          Object.assign(container.style, originalContainerStyles);

          // 恢复所有卡片样式
          originalCardStyles.forEach(({ element, ...styles }) => {
            Object.assign(element.style, styles);
          });

          console.log("已恢复容器和卡片的原始样式");
        } catch (error) {
          console.warn("恢复容器样式时出错:", error);
        }
      };
    } catch (error) {
      console.warn("优化容器尺寸时出错:", error);
      // 返回空的恢复函数
      return () => {};
    }
  };

  // 确保所有内容都可见的函数
  const ensureAllContentVisible = async (container: HTMLElement) => {
    try {
      // 查找所有可能被隐藏或截断的元素
      const allElements = container.querySelectorAll("*");

      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style) {
          // 移除可能导致内容隐藏的样式
          htmlEl.style.overflow = "visible";
          htmlEl.style.maxHeight = "none";
          htmlEl.style.height = "auto";

          // 确保元素可见
          if (htmlEl.style.display === "none") {
            htmlEl.style.display = "block";
          }
          if (htmlEl.style.visibility === "hidden") {
            htmlEl.style.visibility = "visible";
          }
        }
      });

      // 特别处理可能的底部元素
      const bottomElements = container.querySelectorAll(
        '.mt-8, .mb-8, .space-y-8 > *:last-child, [class*="margin"], [class*="padding"]'
      );
      bottomElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.marginBottom = "0";
        htmlEl.style.paddingBottom = "20px"; // 确保底部有足够空间
      });

      // 强制展开所有可能的懒加载内容
      const lazyElements = container.querySelectorAll(
        '[data-lazy], [loading="lazy"], .lazy'
      );
      lazyElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = "block";
        htmlEl.style.visibility = "visible";
        htmlEl.style.opacity = "1";
      });

      // 滚动到底部确保所有内容都被渲染
      const maxScroll = Math.max(
        container.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );

      window.scrollTo(0, maxScroll);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 再次滚动到顶部
      window.scrollTo(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 300));

      console.log("确保所有内容可见完成，最大滚动高度:", maxScroll);
    } catch (error) {
      console.warn("确保内容可见时出错:", error);
    }
  };

  // 截图功能 - 只使用html2canvas
  const handleCapture = async () => {
    if (!summaryContentRef.current) return;

    setIsCapturing(true);
    try {
      // 使用html2canvas进行完整长图截图
      await captureFullPageWithHtml2Canvas();
    } catch (error) {
      console.error("html2canvas截图失败:", error);
      // 直接显示错误，不使用其他降级方案
      toast({
        title: t("screenshot.failed"),
        description: "html2canvas截图失败，请刷新页面后重试",
        variant: "destructive",
      });
    } finally {
      setIsCapturing(false);
    }
  };

  // 完整页面截图方案 - 优化版
  const captureFullPageWithHtml2Canvas = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const element = summaryContentRef.current!;

      // 根据当前主题确定背景颜色
      const isDark =
        theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      const backgroundColor = isDark ? "#0f172a" : "#ffffff"; // slate-900 : white

      // 保存原始样式 - 包括宽度相关样式
      const originalStyles = {
        height: element.style.height,
        overflow: element.style.overflow,
        position: element.style.position,
        transform: element.style.transform,
        width: element.style.width,
        maxWidth: element.style.maxWidth,
        minWidth: element.style.minWidth,
      };
      const originalScrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const originalScrollLeft =
        window.pageXOffset || document.documentElement.scrollLeft;

      // 显示滚动提示
      toast({
        title: "准备截图中...",
        description: "正在自动滚动页面以确保完整内容",
        duration: 2000,
      });

      // 临时调整样式以确保完整内容可见
      element.style.height = "auto";
      element.style.minHeight = "auto";
      element.style.maxHeight = "none";
      element.style.overflow = "visible";
      element.style.position = "static";
      element.style.transform = "none";

      // 确保父容器也能显示完整内容
      const body = document.body;
      const html = document.documentElement;
      const originalBodyStyles = {
        height: body.style.height,
        overflow: body.style.overflow,
        minHeight: body.style.minHeight,
      };
      const originalHtmlStyles = {
        height: html.style.height,
        overflow: html.style.overflow,
        minHeight: html.style.minHeight,
      };

      body.style.height = "auto";
      body.style.overflow = "visible";
      body.style.minHeight = "auto";
      html.style.height = "auto";
      html.style.overflow = "visible";
      html.style.minHeight = "auto";

      // 强制重新布局
      element.offsetHeight;
      body.offsetHeight;
      html.offsetHeight;

      // 自动滚动到底部，然后回到顶部
      const maxScroll = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );

      // 平滑滚动到底部
      window.scrollTo({ top: maxScroll, behavior: "smooth" });
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 平滑滚动回到顶部
      window.scrollTo({ top: 0, behavior: "smooth" });
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 等待布局稳定
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 在截图前强制修复所有Badge元素
      await fixBadgeElements(element);

      // 强制展开所有可折叠内容
      await expandAllCollapsibleContent(element);

      // 调整容器宽度，避免右侧空白
      const restoreContainerStyles = await optimizeContainerWidth(element);

      // 确保所有内容都可见并计算在高度内
      await ensureAllContentVisible(element);

      // 获取完整尺寸 - 更准确的高度计算
      const bodyHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.body.clientHeight
      );

      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
      );

      const elementHeight = Math.max(
        element.scrollHeight,
        element.offsetHeight,
        element.clientHeight
      );

      // 使用最大的高度值，并添加更大的安全边距
      const calculatedHeight = Math.max(
        bodyHeight,
        documentHeight,
        elementHeight
      );
      const fullHeight = calculatedHeight + 300; // 增加到300px安全边距，确保底部内容不被截断

      // 更精确的宽度计算 - 避免右侧空白
      const elementWidth = Math.max(
        element.scrollWidth,
        element.offsetWidth,
        element.clientWidth
      );

      // 使用容器的实际内容宽度，而不是窗口宽度
      const fullWidth = Math.min(elementWidth, 800); // 限制最大宽度为800px

      console.log("完整页面尺寸:", {
        width: fullWidth,
        height: fullHeight,
        bodyHeight,
        documentHeight,
        elementHeight,
        windowHeight: window.innerHeight,
        // 添加更多调试信息
        elementScrollHeight: element.scrollHeight,
        elementOffsetHeight: element.offsetHeight,
        elementClientHeight: element.clientHeight,
        bodyScrollHeight: document.body.scrollHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
      });

      // 执行高分辨率紧凑截图
      const canvas = await html2canvas(element, {
        backgroundColor: backgroundColor,
        scale: 2, // 提高到2倍分辨率
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: fullWidth, // 使用精确计算的宽度
        windowHeight: fullHeight,
        width: fullWidth,
        height: fullHeight,
        logging: false, // 关闭日志
        foreignObjectRendering: false,
        removeContainer: false,
        imageTimeout: 30000,
        x: 0,
        y: 0,
        // 确保捕获完整内容但不包含多余空白
        canvas: null,
        letterRendering: false,
        ignoreElements: (el) => {
          // 排除不需要截图的元素
          return (
            el.classList.contains("no-screenshot") ||
            el.tagName === "BUTTON" ||
            el.classList.contains("smart-suggestions-card")
          );
        },
        // 优化截图质量
        allowTaint: true,
        useCORS: true,
        proxy: undefined,
        onclone: (clonedDoc, clonedElement) => {
          // 首先添加Tailwind CSS基础样式
          const tailwindStyle = clonedDoc.createElement("style");
          tailwindStyle.textContent = `
            /* Tailwind CSS 基础重置和工具类 */
            .flex { display: flex !important; }
            .inline-flex { display: inline-flex !important; }
            .items-center { align-items: center !important; }
            .items-start { align-items: flex-start !important; }
            .justify-between { justify-content: space-between !important; }
            .justify-center { justify-content: center !important; }
            .space-x-1 > * + * { margin-left: 0.25rem !important; }
            .space-x-2 > * + * { margin-left: 0.5rem !important; }
            .space-x-3 > * + * { margin-left: 0.75rem !important; }
            .space-x-4 > * + * { margin-left: 1rem !important; }
            .space-y-2 > * + * { margin-top: 0.5rem !important; }
            .space-y-4 > * + * { margin-top: 1rem !important; }
            .space-y-8 > * + * { margin-top: 2rem !important; }
            .text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
            .text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
            .text-base { font-size: 1rem !important; line-height: 1.5rem !important; }
            .text-lg { font-size: 1.125rem !important; line-height: 1.75rem !important; }
            .text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
            .text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
            .text-3xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }
            .font-medium { font-weight: 500 !important; }
            .font-semibold { font-weight: 600 !important; }
            .font-bold { font-weight: 700 !important; }
            .rounded { border-radius: 0.25rem !important; }
            .rounded-lg { border-radius: 0.5rem !important; }
            .rounded-xl { border-radius: 0.75rem !important; }
            .rounded-full { border-radius: 9999px !important; }
            .border { border-width: 1px !important; }
            .border-l-2 { border-left-width: 2px !important; }
            .border-t { border-top-width: 1px !important; }
            .p-2 { padding: 0.5rem !important; }
            .p-3 { padding: 0.75rem !important; }
            .p-4 { padding: 1rem !important; }
            .px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
            .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
            .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
            .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
            .pl-3 { padding-left: 0.75rem !important; }
            .pt-0 { padding-top: 0 !important; }
            .mt-1 { margin-top: 0.25rem !important; }
            .mt-2 { margin-top: 0.5rem !important; }
            .mt-3 { margin-top: 0.75rem !important; }
            .mb-2 { margin-bottom: 0.5rem !important; }
            .mb-3 { margin-bottom: 0.75rem !important; }
            .mb-4 { margin-bottom: 1rem !important; }
            .ml-2 { margin-left: 0.5rem !important; }
            .mr-2 { margin-right: 0.5rem !important; }
            .w-8 { width: 2rem !important; }
            .h-4 { height: 1rem !important; }
            .h-5 { height: 1.25rem !important; }
            .h-8 { height: 2rem !important; }
            .flex-1 { flex: 1 1 0% !important; }
            .flex-shrink-0 { flex-shrink: 0 !important; }
            .leading-relaxed { line-height: 1.625 !important; }
            .whitespace-nowrap { white-space: nowrap !important; }
            .whitespace-pre-wrap { white-space: pre-wrap !important; }
          `;
          clonedDoc.head.appendChild(tailwindStyle);

          // 优化克隆文档的样式
          const style = clonedDoc.createElement("style");
          style.textContent = `
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              height: auto !important;
              background: ${backgroundColor} !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            }
            .no-screenshot, button {
              display: none !important;
            }

            /* 美化标题区域 */
            h1 {
              background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%) !important;
              -webkit-background-clip: text !important;
              background-clip: text !important;
              -webkit-text-fill-color: transparent !important;
              font-weight: 800 !important;
              font-size: 2.5rem !important;
              line-height: 1.2 !important;
              margin-bottom: 0.5rem !important;
              text-shadow: 0 2px 4px rgba(5, 150, 105, 0.1) !important;
            }

            /* 主题适配的卡片样式 */
            .card, .health-card {
              background: ${isDark ? "#1e293b !important" : "white !important"};
              border: 1px solid ${
                isDark ? "#334155 !important" : "#e5e7eb !important"
              };
              box-shadow: ${
                isDark
                  ? "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2) !important"
                  : "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06) !important"
              };
              border-radius: 12px !important;
              padding: 1.5rem !important;
              margin-bottom: 1.5rem !important;
              position: relative !important;
              overflow: visible !important;
            }

            /* 简单的Badge修复 - 增强微调版本 */
            .badge, [class*="badge"], .inline-flex, span[class*="bg-"], span[class*="text-"] {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              border-radius: 9999px !important;
              padding: 1px 8px !important;
              padding-top: 0px !important;
              padding-bottom: 2px !important;
              font-size: 0.75rem !important;
              font-weight: 500 !important;
              line-height: 1 !important;
              white-space: nowrap !important;
              vertical-align: middle !important;
              box-sizing: border-box !important;
              height: 18px !important;
              min-height: 18px !important;
              transform: translateY(-2px) !important;
            }

            /* 简化其他Badge样式 - 增强微调版本 */
            span.inline-flex, span.rounded-full, span[class*="px-"], span[class*="py-"] {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              border-radius: 9999px !important;
              padding: 1px 8px !important;
              padding-top: 0px !important;
              padding-bottom: 2px !important;
              font-size: 0.75rem !important;
              font-weight: 500 !important;
              line-height: 1 !important;
              white-space: nowrap !important;
              vertical-align: middle !important;
              box-sizing: border-box !important;
              height: 18px !important;
              min-height: 18px !important;
              transform: translateY(-2px) !important;
            }

            /* 主要Badge样式 */
            .bg-primary\\/10, .bg-primary\\/20 {
              background-color: ${
                isDark
                  ? "rgba(5, 150, 105, 0.2) !important"
                  : "rgba(5, 150, 105, 0.1) !important"
              };
              color: #059669 !important;
            }

            .bg-green-100 {
              background-color: ${
                isDark
                  ? "rgba(34, 197, 94, 0.2) !important"
                  : "#dcfce7 !important"
              };
              color: ${isDark ? "#4ade80 !important" : "#166534 !important"};
            }

            .bg-red-100 {
              background-color: ${
                isDark
                  ? "rgba(239, 68, 68, 0.2) !important"
                  : "#fee2e2 !important"
              };
              color: ${isDark ? "#f87171 !important" : "#991b1b !important"};
            }

            .bg-yellow-100 {
              background-color: ${
                isDark
                  ? "rgba(245, 158, 11, 0.2) !important"
                  : "#fef3c7 !important"
              };
              color: ${isDark ? "#fbbf24 !important" : "#92400e !important"};
            }

            .bg-gray-100 {
              background-color: ${
                isDark
                  ? "rgba(156, 163, 175, 0.2) !important"
                  : "#f3f4f6 !important"
              };
              color: ${isDark ? "#d1d5db !important" : "#374151 !important"};
            }

            /* 修复Flex布局 */
            .flex {
              display: flex !important;
            }
            .items-center {
              align-items: center !important;
            }
            .justify-between {
              justify-content: space-between !important;
            }
            .justify-center {
              justify-content: center !important;
            }
            .space-x-2 > * + * {
              margin-left: 0.5rem !important;
            }
            .space-x-4 > * + * {
              margin-left: 1rem !important;
            }
            .space-y-4 > * + * {
              margin-top: 1rem !important;
            }
            .space-y-8 > * + * {
              margin-top: 2rem !important;
            }

            /* 主题适配的文字颜色 */
            .text-muted-foreground {
              color: ${isDark ? "#94a3b8 !important" : "#6b7280 !important"};
            }
            .text-primary {
              color: #059669 !important;
              font-weight: 600 !important;
            }

            /* 主题适配的主要文字 */
            h1, h2, h3, h4, h5, h6, p, span, div {
              color: ${isDark ? "#f1f5f9 !important" : "#1f2937 !important"};
            }

            /* 确保容器样式 */
            [data-screenshot="true"] {
              height: auto !important;
              overflow: visible !important;
              position: static !important;
              transform: none !important;
              background: ${backgroundColor} !important;
              padding: 2rem !important;
            }

            /* 美化描述文字 */
            .text-lg {
              font-size: 1.125rem !important;
              opacity: 0.8 !important;
            }

            /* 修复图标和小元素 */
            svg {
              display: inline-block !important;
              vertical-align: middle !important;
            }

            /* 强制修复所有可能错位的元素 */
            * {
              position: relative !important;
              box-sizing: border-box !important;
            }

            /* 但是保持某些元素的绝对定位 */
            .absolute {
              position: absolute !important;
            }

            /* 全局badge修复 - 最高优先级 */
            span, .badge, [class*="badge"] {
              display: inline !important;
              vertical-align: baseline !important;
            }

            span.inline-flex, span.rounded-full, span[class*="bg-"],
            span[class*="px-"], span[class*="py-"], span[class*="text-xs"] {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              vertical-align: middle !important;
              white-space: nowrap !important;
              border-radius: 9999px !important;
              padding: 0.25rem 0.75rem !important;
              font-size: 0.75rem !important;
              font-weight: 500 !important;
              line-height: 1 !important;
              position: relative !important;
              z-index: 1 !important;
              box-sizing: border-box !important;
            }

            /* 添加页面水印 */
            [data-screenshot="true"]::after {
              content: "Generated by SnapFit AI • ${new Date().toLocaleDateString(
                "zh-CN"
              )}" !important;
              position: absolute !important;
              bottom: 1rem !important;
              right: 2rem !important;
              font-size: 0.75rem !important;
              opacity: 0.5 !important;
              color: ${isDark ? "#64748b !important" : "#9ca3af !important"};
            }
          `;
          clonedDoc.head.appendChild(style);

          // 确保克隆元素有正确的尺寸和样式
          if (clonedElement) {
            const clonedHtmlElement = clonedElement as HTMLElement;
            clonedHtmlElement.style.height = "auto";
            clonedHtmlElement.style.overflow = "visible";
            clonedHtmlElement.style.position = "static";
            clonedHtmlElement.style.transform = "none";
          }

          // 特别处理克隆文档中的Radix UI Collapsible
          const clonedCollapsibles = clonedDoc.querySelectorAll(
            "[data-radix-collapsible-content], [data-state]"
          );
          clonedCollapsibles.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.hasAttribute("data-state")) {
              htmlEl.setAttribute("data-state", "open");
            }
            htmlEl.style.display = "block";
            htmlEl.style.visibility = "visible";
            htmlEl.style.opacity = "1";
            htmlEl.style.height = "auto";
            htmlEl.style.maxHeight = "none";
            htmlEl.style.overflow = "visible";
          });

          console.log(
            "克隆文档中处理了",
            clonedCollapsibles.length,
            "个Radix UI元素"
          );

          // 简化的布局修复 - Badge已经在截图前修复了
          const allElements = clonedDoc.querySelectorAll("*");
          allElements.forEach((el) => {
            try {
              const htmlEl = el as HTMLElement;

              // 确保元素有style属性
              if (!htmlEl.style) return;

              // 移除可能影响布局的样式
              htmlEl.style.transform = "";
              htmlEl.style.animation = "";
              htmlEl.style.transition = "";

              // 安全地检查classList
              if (
                htmlEl.classList &&
                typeof htmlEl.classList.contains === "function"
              ) {
                // 确保flex容器正确显示
                if (htmlEl.classList.contains("flex")) {
                  htmlEl.style.display = "flex";
                }

                // 确保卡片内容正确布局
                if (
                  htmlEl.classList.contains("card") ||
                  htmlEl.classList.contains("health-card")
                ) {
                  htmlEl.style.position = "relative";
                  htmlEl.style.overflow = "visible";
                  htmlEl.style.display = "block";
                }
              }
            } catch (error) {
              // 忽略单个元素的错误，继续处理其他元素
              console.warn("处理元素时出错:", error, el);
            }
          });
        },
      });

      // 恢复原始样式
      Object.assign(element.style, originalStyles);
      Object.assign(body.style, originalBodyStyles);
      Object.assign(html.style, originalHtmlStyles);

      // 恢复容器和卡片的样式
      if (restoreContainerStyles) {
        restoreContainerStyles();
      }

      console.log("生成的Canvas尺寸:", {
        width: canvas.width,
        height: canvas.height,
      });

      // 创建并下载图片
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("无法创建图片文件"));
          },
          "image/png",
          0.9
        );
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = format(selectedDate, "yyyy-MM-dd");
      const time = format(new Date(), "HHmm");
      link.href = url;
      link.download = `SnapFit健康汇总-${timestamp}-${time}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast({
        title: t("screenshot.success"),
        description: t("screenshot.successDescription"),
      });
    } catch (error) {
      console.error("完整页面截图失败:", error);

      // 即使出错也要恢复容器样式
      if (typeof restoreContainerStyles === "function") {
        restoreContainerStyles();
      }

      throw error;
    }
  };

  if (!dailyLog) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("backToHome")}
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("noDataForDate")}</p>
        </div>
      </div>
    );
  }

  const {
    summary,
    calculatedBMR,
    calculatedTDEE,
    foodEntries,
    exerciseEntries,
  } = dailyLog;
  const { totalCaloriesConsumed, totalCaloriesBurned } = summary;
  const netCalories = totalCaloriesConsumed - totalCaloriesBurned;

  // 计算与TDEE的差额
  const calorieDifference = calculatedTDEE
    ? calculatedTDEE - netCalories
    : null;
  let calorieStatusText = "";
  let calorieStatusColor = "text-muted-foreground";

  if (calorieDifference !== null) {
    if (calorieDifference > 0) {
      calorieStatusText = t("deficit", {
        amount: calorieDifference.toFixed(0),
      });
      calorieStatusColor = "text-green-600 dark:text-green-500";
    } else if (calorieDifference < 0) {
      calorieStatusText = t("surplus", {
        amount: Math.abs(calorieDifference).toFixed(0),
      });
      calorieStatusColor = "text-orange-500 dark:text-orange-400";
    } else {
      calorieStatusText = t("balanced");
      calorieStatusColor = "text-blue-500 dark:text-blue-400";
    }
  }

  return (
    <div
      ref={summaryContentRef}
      className="container mx-auto px-4 py-8 max-w-4xl"
      data-screenshot="true"
    >
      {/* 页面头部 */}
      <div className="mb-8">
        {/* 第一行：返回按钮和标题 */}
        {/* 第一行：返回按钮 */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="no-screenshot">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("backToHome")}
            </Button>
          </Link>
        </div>

        {/* 第二行：标题区域 - 居中 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground text-lg">{t("description")}</p>
        </div>

        {/* 第三行：日期和操作按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">{t("date")}:</p>
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
                <span>{t("screenshot.capturing")}</span>
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                <span>{t("screenshot.capture")}</span>
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
              {t("calorieBalance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 卡路里摄入 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Utensils className="mr-2 h-5 w-5 text-green-500" />
                  <span className="text-lg font-medium">{t("caloriesIn")}</span>
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
                      onEdit={() => {}}
                      onDelete={() => {}}
                      showActions={false}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  {t("noFoodEntries")}
                </p>
              )}
            </div>

            {/* 运动消耗 */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Flame className="mr-2 h-5 w-5 text-red-500" />
                  <span className="text-lg font-medium">
                    {t("exerciseBurn")}
                  </span>
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
                      onEdit={() => {}}
                      onDelete={() => {}}
                      showActions={false}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  {t("noExerciseEntries")}
                </p>
              )}
            </div>

            {/* 净卡路里 */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {netCalories > 0 ? (
                    <TrendingUp className="mr-2 h-5 w-5 text-orange-500" />
                  ) : (
                    <TrendingDown className="mr-2 h-5 w-5 text-blue-500" />
                  )}
                  <span className="text-lg font-medium">
                    {t("netCalories")}
                  </span>
                </div>
                <span
                  className={`text-2xl font-bold ${
                    netCalories > 0 ? "text-orange-500" : "text-blue-500"
                  }`}
                >
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
              {t("estimatedDailyNeeds")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* BMR */}
            {calculatedBMR && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <BedDouble className="mr-2 h-5 w-5 text-purple-500" />
                  <div>
                    <span className="text-lg font-medium">{t("bmr")}</span>
                    <p className="text-sm text-muted-foreground">
                      {t("bmrDescription")}
                    </p>
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
                    <span className="text-lg font-medium">{t("tdee")}</span>
                    <p className="text-sm text-muted-foreground">
                      {t("tdeeDescription")}
                    </p>
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
                    {calorieDifference === 0 ? (
                      <Minus className="mr-2 h-5 w-5 text-blue-500" />
                    ) : calorieDifference > 0 ? (
                      <TrendingDown className="mr-2 h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingUp className="mr-2 h-5 w-5 text-orange-500" />
                    )}
                    <div>
                      <span className="text-lg font-medium">
                        {t("calorieDeficitSurplus")}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {t("deficitSurplusDescription")}
                      </p>
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
                <span>{t("estimationNote")}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 智能建议 */}
        {smartSuggestions &&
          smartSuggestions.suggestions &&
          smartSuggestions.suggestions.length > 0 && (
            <Card className="no-screenshot smart-suggestions-card">
              <Collapsible
                open={isSmartSuggestionsOpen}
                onOpenChange={setIsSmartSuggestionsOpen}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Brain className="mr-2 h-5 w-5 text-primary" />
                        {t("smartSuggestions")}
                        <span className="ml-2 text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                          {smartSuggestions.suggestions.reduce(
                            (total, category) =>
                              total + category.suggestions.length,
                            0
                          )}
                        </span>
                      </div>
                      {isSmartSuggestionsOpen ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* 显示生成时间 */}
                      <div className="text-xs text-muted-foreground mb-4">
                        生成时间:{" "}
                        {format(
                          new Date(smartSuggestions.generatedAt),
                          "yyyy-MM-dd HH:mm"
                        )}
                      </div>

                      {/* 按类别显示建议 */}
                      {smartSuggestions.suggestions.map(
                        (category, categoryIndex) => (
                          <div
                            key={categoryIndex}
                            className="border rounded-lg p-4"
                          >
                            <div className="mb-3">
                              <h4 className="font-medium text-base flex items-center">
                                <span className="mr-2">
                                  {category.suggestions[0]?.icon || "💡"}
                                </span>
                                {category.category}
                                <span
                                  className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                    category.priority === "high"
                                      ? "bg-red-100 text-red-700"
                                      : category.priority === "medium"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {category.priority === "high"
                                    ? "高优先级"
                                    : category.priority === "medium"
                                    ? "中优先级"
                                    : "低优先级"}
                                </span>
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {category.summary}
                              </p>
                            </div>

                            {/* 具体建议 */}
                            <div className="space-y-2">
                              {category.suggestions.map(
                                (suggestion, suggestionIndex) => (
                                  <div
                                    key={suggestionIndex}
                                    className="border-l-2 border-primary/20 pl-3 py-2 bg-muted/30 rounded-r"
                                  >
                                    <div className="flex items-start space-x-2">
                                      <span className="text-sm flex-shrink-0">
                                        {suggestion.icon}
                                      </span>
                                      <div className="flex-1">
                                        <h5 className="font-medium text-sm">
                                          {suggestion.title}
                                        </h5>
                                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                          {suggestion.description}
                                        </p>
                                        {suggestion.actionable && (
                                          <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                            可执行建议
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}
      </div>
    </div>
  );
}

// 主导出组件，用 Suspense 包装
export default function SummaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      }
    >
      <SummaryPageContent params={params} />
    </Suspense>
  );
}
