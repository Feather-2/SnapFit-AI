'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InputLimitIndicator, FIELD_LIMITS } from './input-limit-indicator';
import { cn } from '@/lib/utils';
import { Send, Image, Loader2 } from 'lucide-react';

interface ChatInputWithLimitProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  showImageButton?: boolean;
  onImageClick?: () => void;
  imageCount?: number;
  maxImages?: number;
  className?: string;
  isMobile?: boolean;
}

export function ChatInputWithLimit({
  value,
  onChange,
  onSubmit,
  placeholder = "输入您的消息...",
  disabled = false,
  isLoading = false,
  showImageButton = false,
  onImageClick,
  imageCount = 0,
  maxImages = 5,
  className,
  isMobile = false
}: ChatInputWithLimitProps) {
  const currentLength = value.length;
  const maxLength = FIELD_LIMITS.chatMessage;
  const isOverLimit = currentLength > maxLength;
  const canSendImages = showImageButton && imageCount < maxImages;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverLimit || disabled || isLoading || (!value.trim() && imageCount === 0)) {
      return;
    }
    onSubmit(e);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex space-x-2">
          <div className="flex-1 space-y-1">
            <Input
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                'flex-1',
                isMobile ? 'text-base h-9' : '',
                isOverLimit && 'border-red-500 focus:ring-red-500 focus:border-red-500'
              )}
            />
            
            {/* 字符计数指示器 */}
            {currentLength > maxLength * 0.8 && (
              <InputLimitIndicator
                currentLength={currentLength}
                maxLength={maxLength}
                className="text-xs"
                showCount={true}
              />
            )}
          </div>
          
          {/* 图片上传按钮 */}
          {showImageButton && (
            <Button
              type="button"
              variant="outline"
              size={isMobile ? "sm" : "default"}
              disabled={disabled || isLoading || !canSendImages}
              onClick={onImageClick}
              className="shrink-0"
            >
              <Image className="h-4 w-4" />
              {imageCount > 0 && (
                <span className="ml-1 text-xs">
                  {imageCount}/{maxImages}
                </span>
              )}
            </Button>
          )}
          
          {/* 发送按钮 */}
          <Button
            type="submit"
            disabled={disabled || isLoading || isOverLimit || (!value.trim() && imageCount === 0)}
            size={isMobile ? "sm" : "default"}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* 错误提示 */}
        {isOverLimit && (
          <p className="text-xs text-red-500 dark:text-red-400">
            消息超出最大长度限制 {maxLength.toLocaleString()} 字符
          </p>
        )}
        
        {/* 图片数量提示 */}
        {showImageButton && imageCount >= maxImages && (
          <p className="text-xs text-amber-500 dark:text-amber-400">
            最多只能上传 {maxImages} 张图片
          </p>
        )}
      </form>
    </div>
  );
}

// 带限制的数值输入组件
interface NumberInputWithLimitProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  min: number;
  max: number;
  unit?: string;
  helperText?: string;
}

export function NumberInputWithLimit({
  label,
  min,
  max,
  unit,
  helperText,
  className,
  value,
  onChange,
  ...props
}: NumberInputWithLimitProps) {
  const numValue = typeof value === 'string' ? parseFloat(value) || 0 : (value as number) || 0;
  const isOverLimit = numValue > max;
  const isUnderLimit = numValue < min && numValue !== 0; // 0值不算违规

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label} {unit && <span className="text-gray-500">({unit})</span>}
        </label>
      )}
      
      <div className="relative">
        <Input
          {...props}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          className={cn(
            (isOverLimit || isUnderLimit) && 'border-red-500 focus:ring-red-500 focus:border-red-500',
            className
          )}
        />
        
        {unit && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-gray-500 text-sm">{unit}</span>
          </div>
        )}
      </div>
      
      {helperText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
      
      {(isOverLimit || isUnderLimit) && (
        <p className="text-xs text-red-500 dark:text-red-400">
          {isOverLimit 
            ? `值不能超过 ${max} ${unit || ''}`
            : `值不能小于 ${min} ${unit || ''}`
          }
        </p>
      )}
      
      <div className="text-xs text-gray-400">
        范围: {min} - {max} {unit}
      </div>
    </div>
  );
}

// 预设的数值输入组件
export function WeightInput(props: Omit<NumberInputWithLimitProps, 'min' | 'max' | 'unit'>) {
  return (
    <NumberInputWithLimit
      {...props}
      min={FIELD_LIMITS.weight.min}
      max={FIELD_LIMITS.weight.max}
      unit="kg"
      helperText="请输入您的体重"
    />
  );
}

export function HeightInput(props: Omit<NumberInputWithLimitProps, 'min' | 'max' | 'unit'>) {
  return (
    <NumberInputWithLimit
      {...props}
      min={FIELD_LIMITS.height.min}
      max={FIELD_LIMITS.height.max}
      unit="cm"
      helperText="请输入您的身高"
    />
  );
}

export function CaloriesInput(props: Omit<NumberInputWithLimitProps, 'min' | 'max' | 'unit'>) {
  return (
    <NumberInputWithLimit
      {...props}
      min={FIELD_LIMITS.calories.min}
      max={FIELD_LIMITS.calories.max}
      unit="kcal"
      helperText="请输入卡路里数量"
    />
  );
}

export function DurationInput(props: Omit<NumberInputWithLimitProps, 'min' | 'max' | 'unit'>) {
  return (
    <NumberInputWithLimit
      {...props}
      min={FIELD_LIMITS.duration.min}
      max={FIELD_LIMITS.duration.max}
      unit="分钟"
      helperText="请输入持续时间"
    />
  );
}

export function GramsInput(props: Omit<NumberInputWithLimitProps, 'min' | 'max' | 'unit'>) {
  return (
    <NumberInputWithLimit
      {...props}
      min={FIELD_LIMITS.grams.min}
      max={FIELD_LIMITS.grams.max}
      unit="g"
      helperText="请输入重量（克）"
    />
  );
}
