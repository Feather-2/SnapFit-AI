"use client"

import type React from "react"

import { useState } from "react"
import { Edit2, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { FoodEntry } from "@/lib/types"
import { useTranslation } from "@/hooks/use-i18n"
import { formatNumber } from "@/lib/number-utils"

interface FoodEntryCardProps {
  entry: FoodEntry
  onDelete: () => void
  onUpdate: (updatedEntry: FoodEntry) => void
}

export function FoodEntryCard({ entry, onDelete, onUpdate }: FoodEntryCardProps) {
  const t = useTranslation('dashboard.foodCard')
  const [isEditing, setIsEditing] = useState(false)
  const [editedEntry, setEditedEntry] = useState<FoodEntry>({ ...entry })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    if (name === "food_name") {
      setEditedEntry({ ...editedEntry, food_name: value })
    } else if (name === "consumed_grams") {
      const grams = Number.parseFloat(value) || 0

      // 重新计算总营养成分
      const updatedEntry = { ...editedEntry, consumed_grams: grams }

      if (editedEntry.nutritional_info_per_100g) {
        const ratio = grams / 100
        updatedEntry.total_nutritional_info_consumed = Object.entries(editedEntry.nutritional_info_per_100g).reduce(
          (acc, [key, value]) => {
            if (typeof value === "number") {
              acc[key] = value * ratio
            }
            return acc
          },
          {} as any,
        )
      }

      setEditedEntry(updatedEntry)
    }
  }

  const handleMealTypeChange = (value: string) => {
    setEditedEntry({ ...editedEntry, meal_type: value })
  }

  const handleTimePeriodChange = (value: string) => {
    setEditedEntry({ ...editedEntry, time_period: value })
  }

  const handleSave = () => {
    onUpdate(editedEntry)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedEntry({ ...entry })
    setIsEditing(false)
  }

  const getTimePeriodLabel = (period?: string) => {
    if (!period) return ""
    return t(`timePeriods.${period}`) || period
  }

  const getMealTypeLabel = (type: string | null | undefined) => {
    if (!type) return t('unknown') || '未知'
    return t(`mealTypes.${type}`) || type
  }

  // 🔄 如果是占位条目，渲染骨架屏
  if (entry.is_pending) {
    return (
      <Card className="rounded-xl border p-4 md:p-6 animate-pulse bg-card/50">
        <CardContent className="p-0 space-y-2">
          <div className="h-4 w-2/3 bg-muted/40 rounded" />
          <div className="h-3 w-1/2 bg-muted/20 rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn(
      "bg-card rounded-lg border transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:translate-y-[-1px] hover:shadow-emerald-100/30 dark:hover:shadow-emerald-900/20",
      entry.is_estimated && "border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10"
    )}>
      <div className="p-3 md:p-4">
        {isEditing ? (
          <div className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="food_name" className="text-sm">{t('foodName')}</Label>
                <Input
                  id="food_name"
                  name="food_name"
                  value={editedEntry.food_name}
                  onChange={handleInputChange}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="consumed_grams" className="text-sm">{t('portion')}</Label>
                <Input
                  id="consumed_grams"
                  name="consumed_grams"
                  type="number"
                  value={editedEntry.consumed_grams}
                  onChange={handleInputChange}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="meal_type" className="text-sm">{t('mealType')}</Label>
                <Select value={editedEntry.meal_type} onValueChange={handleMealTypeChange}>
                  <SelectTrigger id="meal_type" className="h-10 text-sm">
                    <SelectValue placeholder={t('selectMealType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">{t('mealTypes.breakfast')}</SelectItem>
                    <SelectItem value="lunch">{t('mealTypes.lunch')}</SelectItem>
                    <SelectItem value="dinner">{t('mealTypes.dinner')}</SelectItem>
                    <SelectItem value="snack">{t('mealTypes.snack')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="time_period" className="text-sm">{t('timePeriod')}</Label>
                <Select value={editedEntry.time_period || ""} onValueChange={handleTimePeriodChange}>
                  <SelectTrigger id="time_period" className="h-10 text-sm">
                    <SelectValue placeholder={t('selectTimePeriod')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">{t('timePeriods.morning')}</SelectItem>
                    <SelectItem value="noon">{t('timePeriods.noon')}</SelectItem>
                    <SelectItem value="afternoon">{t('timePeriods.afternoon')}</SelectItem>
                    <SelectItem value="evening">{t('timePeriods.evening')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
                <X className="h-4 w-4 mr-1" /> {t('cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} className="w-full sm:w-auto">
                <Check className="h-4 w-4 mr-1" /> {t('save')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                <h4 className="font-medium text-sm md:text-base">{entry.food_name}</h4>
                {entry.is_estimated && (
                  <span className="ml-0 sm:ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded self-start">{t('estimated')}</span>
                )}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                {entry.consumed_grams}{t('grams')} · {getMealTypeLabel(entry.meal_type)}
                {entry.time_period && ` · ${getTimePeriodLabel(entry.time_period)}`}
              </p>
              <p className="text-sm md:text-base font-medium mt-1">
                {formatNumber(entry.total_nutritional_info_consumed?.calories, 0)} {t('calories')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('carbs')}: {formatNumber(entry.total_nutritional_info_consumed?.carbohydrates, 1)}g · {t('protein')}: {formatNumber(entry.total_nutritional_info_consumed?.protein, 1)}g · {t('fat')}: {formatNumber(entry.total_nutritional_info_consumed?.fat, 1)}g
              </p>
            </div>
            <div className="flex space-x-1 self-end sm:self-start">
              <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="h-8 w-8 touch-manipulation">
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-destructive hover:text-destructive touch-manipulation">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
