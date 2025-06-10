'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputLimitIndicatorProps {
  currentLength: number;
  maxLength: number;
  className?: string;
  showCount?: boolean;
  warningThreshold?: number; // 警告阈值（百分比）
  errorThreshold?: number;   // 错误阈值（百分比）
}

export function InputLimitIndicator({
  currentLength,
  maxLength,
  className,
  showCount = true,
  warningThreshold = 80,
  errorThreshold = 95
}: InputLimitIndicatorProps) {
  const percentage = (currentLength / maxLength) * 100;
  const isWarning = percentage >= warningThreshold && percentage < errorThreshold;
  const isError = percentage >= errorThreshold;
  const isOverLimit = currentLength > maxLength;

  const getStatusColor = () => {
    if (isOverLimit) return 'text-red-600 dark:text-red-400';
    if (isError) return 'text-red-500 dark:text-red-400';
    if (isWarning) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const getProgressColor = () => {
    if (isOverLimit) return 'bg-red-500';
    if (isError) return 'bg-red-400';
    if (isWarning) return 'bg-yellow-400';
    return 'bg-blue-400';
  };

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      {/* 进度条 */}
      <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-200', getProgressColor())}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* 计数显示 */}
      {showCount && (
        <span className={cn('font-mono whitespace-nowrap', getStatusColor())}>
          {currentLength.toLocaleString()}/{maxLength.toLocaleString()}
        </span>
      )}

      {/* 状态图标 */}
      {isOverLimit && (
        <span className="text-red-500" title="超出字符限制">
          ⚠️
        </span>
      )}
      {isError && !isOverLimit && (
        <span className="text-red-500" title="接近字符限制">
          🔴
        </span>
      )}
      {isWarning && (
        <span className="text-yellow-500" title="字符较多">
          🟡
        </span>
      )}
    </div>
  );
}

interface TextAreaWithLimitProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength: number;
  label?: string;
  helperText?: string;
  showLimitIndicator?: boolean;
}

export function TextAreaWithLimit({
  maxLength,
  label,
  helperText,
  showLimitIndicator = true,
  className,
  value = '',
  ...props
}: TextAreaWithLimitProps) {
  const currentLength = typeof value === 'string' ? value.length : 0;
  const isOverLimit = currentLength > maxLength;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div className="relative">
        <textarea
          {...props}
          value={value}
          className={cn(
            'w-full px-3 py-2 border rounded-md shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'dark:bg-gray-800 dark:border-gray-600 dark:text-white',
            isOverLimit && 'border-red-500 focus:ring-red-500 focus:border-red-500',
            className
          )}
        />

        {showLimitIndicator && (
          <div className="mt-1">
            <InputLimitIndicator
              currentLength={currentLength}
              maxLength={maxLength}
            />
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}

      {isOverLimit && (
        <p className="text-xs text-red-500 dark:text-red-400">
          内容超出最大长度限制 {maxLength.toLocaleString()} 字符
        </p>
      )}
    </div>
  );
}

interface InputWithLimitProps extends React.InputHTMLAttributes<HTMLInputElement> {
  maxLength: number;
  label?: string;
  helperText?: string;
  showLimitIndicator?: boolean;
}

export function InputWithLimit({
  maxLength,
  label,
  helperText,
  showLimitIndicator = true,
  className,
  value = '',
  ...props
}: InputWithLimitProps) {
  const currentLength = typeof value === 'string' ? value.length : 0;
  const isOverLimit = currentLength > maxLength;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          {...props}
          value={value}
          className={cn(
            'w-full px-3 py-2 border rounded-md shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'dark:bg-gray-800 dark:border-gray-600 dark:text-white',
            isOverLimit && 'border-red-500 focus:ring-red-500 focus:border-red-500',
            className
          )}
        />

        {showLimitIndicator && maxLength <= 1000 && (
          <div className="mt-1">
            <InputLimitIndicator
              currentLength={currentLength}
              maxLength={maxLength}
            />
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}

      {isOverLimit && (
        <p className="text-xs text-red-500 dark:text-red-400">
          内容超出最大长度限制 {maxLength.toLocaleString()} 字符
        </p>
      )}
    </div>
  );
}

// 预设的字段限制配置
export const FIELD_LIMITS = {
  // 设置页面字段
  notes: 2000,
  medicalHistory: 5000,
  lifestyle: 3000,
  description: 1000,
  goal: 100,
  tag: 50,
  apiKey: 200,
  reason: 500,

  // 主页字段
  chatMessage: 10000,        // 聊天消息
  foodEntry: 3000,          // 食物记录
  exerciseEntry: 3000,      // 运动记录
  foodName: 200,            // 食物名称
  exerciseName: 200,        // 运动名称
  dailyStatus: 1000,        // 每日状态

  // 数值范围
  weight: { min: 20, max: 500 },
  height: { min: 50, max: 300 },
  age: { min: 1, max: 150 },
  calories: { min: 0, max: 10000 },
  duration: { min: 0, max: 1440 }, // 最多24小时
  grams: { min: 0, max: 10000 }
} as const;

// 使用示例组件
export function FieldLimitExamples() {
  const [notes, setNotes] = React.useState('');
  const [description, setDescription] = React.useState('');

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">输入限制示例</h3>

      <TextAreaWithLimit
        label="备注"
        maxLength={FIELD_LIMITS.notes}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="输入您的备注..."
        helperText="记录您的想法和备注"
        rows={4}
      />

      <InputWithLimit
        label="描述"
        maxLength={FIELD_LIMITS.description}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="输入描述..."
        helperText="简短描述"
      />
    </div>
  );
}
