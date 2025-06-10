import type { FoodEntry, TEFAnalysis } from './types';

/**
 * TEF分析缓存管理器
 * 用于避免重复计算相同食物组合的TEF
 * 支持本地存储持久化
 */
export class TEFCacheManager {
  private cache = new Map<string, { analysis: TEFAnalysis; timestamp: number }>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时
  private readonly STORAGE_KEY = 'tef-analysis-cache';
  private isInitialized = false;
  private listeners = new Set<() => void>();

  /**
   * 订阅缓存变化。
   * 当缓存通过 setCachedAnalysis 或 clearCache 等方法更改时，将通知侦听器。
   * @param listener - 当缓存发生变化时调用的回调函数。
   * @returns 返回一个函数，调用该函数可取消订阅。
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    // 返回一个取消订阅的函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有监听器缓存已发生变化
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * 生成食物条目的稳定哈希
   * 排除易变字段如时间戳、log_id等
   */
  generateFoodEntriesHash(foodEntries: FoodEntry[]): string {
    if (!Array.isArray(foodEntries) || foodEntries.length === 0) {
      return '[]'; // 返回一个代表空的稳定哈希
    }
    const stableData = foodEntries
      .map(entry => ({
        name: entry.food_name.trim().toLowerCase(),
        grams: Math.round(entry.consumed_grams * 100) / 100, // 保留2位小数
        mealType: entry.meal_type,
        // 只包含营养信息的关键字段
        nutrition: {
          calories: Math.round((entry.total_nutritional_info_consumed?.calories || 0) * 100) / 100,
          protein: Math.round((entry.total_nutritional_info_consumed?.protein || 0) * 100) / 100,
          carbohydrates: Math.round((entry.total_nutritional_info_consumed?.carbohydrates || 0) * 100) / 100,
          fat: Math.round((entry.total_nutritional_info_consumed?.fat || 0) * 100) / 100,
        }
      }))
      .sort((a, b) => {
        // 先按食物名称排序，再按重量排序
        const nameCompare = a.name.localeCompare(b.name);
        return nameCompare !== 0 ? nameCompare : a.grams - b.grams;
      });

    return JSON.stringify(stableData);
  }

  /**
   * 初始化缓存（从本地存储加载）
   */
  private initializeCache(): void {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();

        // 只加载未过期的缓存
        for (const [hash, cached] of Object.entries(data)) {
          const cacheData = cached as { analysis: TEFAnalysis; timestamp: number };
          if (now - cacheData.timestamp < this.CACHE_DURATION) {
            this.cache.set(hash, cacheData);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load TEF cache from localStorage:', error);
    }

    this.isInitialized = true;
  }

  /**
   * 保存缓存到本地存储
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = Object.fromEntries(this.cache.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save TEF cache to localStorage:', error);
    }
  }

  /**
   * 获取缓存的TEF分析结果
   */
  getCachedAnalysis(foodEntries: FoodEntry[]): TEFAnalysis | null {
    this.initializeCache();

    if (!Array.isArray(foodEntries) || foodEntries.length === 0) {
      return null;
    }

    const hash = this.generateFoodEntriesHash(foodEntries);
    const cached = this.cache.get(hash);

    if (!cached) return null;

    const cacheAge = Date.now() - cached.timestamp;
    if (cacheAge > this.CACHE_DURATION) {
      // 清除过期缓存
      this.cache.delete(hash);
      this.saveToStorage();
      this.notifyListeners();
      return null;
    }

    return cached.analysis;
  }

  /**
   * 缓存TEF分析结果
   */
  setCachedAnalysis(foodEntries: FoodEntry[], analysis: TEFAnalysis): void {
    this.initializeCache();

    if (foodEntries.length === 0) return;

    const hash = this.generateFoodEntriesHash(foodEntries);
    this.cache.set(hash, {
      analysis,
      timestamp: Date.now()
    });

    // 清理过期缓存（每次设置时检查）
    this.cleanExpiredCache();

    // 保存到本地存储
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * 检查是否需要重新分析TEF
   */
  shouldAnalyzeTEF(foodEntries: FoodEntry[], previousHash: string): boolean {
    this.initializeCache();

    if (!Array.isArray(foodEntries) || foodEntries.length === 0) {
      return false;
    }

    const currentHash = this.generateFoodEntriesHash(foodEntries);

    // 如果哈希相同，不需要重新分析
    if (currentHash === previousHash) return false;

    // 检查是否有有效缓存
    const cached = this.getCachedAnalysis(foodEntries);
    return cached === null;
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    let hasChanges = false;

    for (const [hash, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_DURATION) {
        this.cache.delete(hash);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * 强制刷新缓存，例如在从云端同步数据后调用。
   * 这将清除所有本地缓存的TEF分析结果，以确保使用最新的数据重新计算。
   */
  forceRefresh(): void {
    this.clearCache();
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    const needsNotification = this.cache.size > 0;
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    if (needsNotification) {
      this.notifyListeners();
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; oldestEntry: number | null } {
    let oldestTimestamp: number | null = null;

    for (const cached of this.cache.values()) {
      if (oldestTimestamp === null || cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
      }
    }

    return {
      size: this.cache.size,
      oldestEntry: oldestTimestamp
    };
  }
}

// 导出单例实例
export const tefCacheManager = new TEFCacheManager();
