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
import type { ExerciseEntry } from "@/lib/types"
import { useTranslation } from "@/hooks/use-i18n"
import { formatNumber } from "@/lib/number-utils"

interface ExerciseEntryCardProps {
  entry: ExerciseEntry
  onDelete: () => void
  onUpdate: (updatedEntry: ExerciseEntry) => void
}

export function ExerciseEntryCard({ entry, onDelete, onUpdate }: ExerciseEntryCardProps) {
  const t = useTranslation('dashboard.exerciseCard')
  const [isEditing, setIsEditing] = useState(false)
  const [editedEntry, setEditedEntry] = useState<ExerciseEntry>({ ...entry })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    if (name === "exercise_name") {
      setEditedEntry({ ...editedEntry, exercise_name: value })
    } else if (name === "duration_minutes") {
      const minutes = Number.parseFloat(value) || 0

      // 重新计算卡路里消耗
      // 公式: METs值 × 用户体重(kg) × 运动持续时间(小时)
      const hours = minutes / 60
      const caloriesBurned = (editedEntry.estimated_mets || 3) * (editedEntry.user_weight || 70) * hours

      setEditedEntry({
        ...editedEntry,
        duration_minutes: minutes,
        calories_burned_estimated: caloriesBurned,
      })
    } else if (name === "distance_km" && value) {
      setEditedEntry({ ...editedEntry, distance_km: Number.parseFloat(value) || undefined })
    } else if (name === "sets" && value) {
      setEditedEntry({ ...editedEntry, sets: Number.parseInt(value) || undefined })
    } else if (name === "reps" && value) {
      setEditedEntry({ ...editedEntry, reps: Number.parseInt(value) || undefined })
    } else if (name === "weight_kg" && value) {
      setEditedEntry({ ...editedEntry, weight_kg: Number.parseFloat(value) || undefined })
    }
  }

  const handleSave = () => {
    onUpdate(editedEntry)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedEntry({ ...entry })
    setIsEditing(false)
  }

  const handleTimePeriodChange = (value: string) => {
    setEditedEntry({ ...editedEntry, time_period: value })
  }

  const getTimePeriodLabel = (period?: string) => {
    if (!period) return ""
    return t(`timePeriods.${period}`) || period
  }

  // 🔄 占位条目骨架
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
      "bg-card rounded-lg border transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:translate-y-[-1px] hover:shadow-blue-100/30 dark:hover:shadow-blue-900/20",
      entry.is_estimated && "border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10"
    )}>
      <div className="p-3 md:p-4">
        {isEditing ? (
          <div className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="exercise_name" className="text-sm">{t('exerciseName')}</Label>
                <Input
                  id="exercise_name"
                  name="exercise_name"
                  value={editedEntry.exercise_name}
                  onChange={handleInputChange}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="duration_minutes" className="text-sm">{t('duration')}</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  value={editedEntry.duration_minutes}
                  onChange={handleInputChange}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <div></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entry.exercise_type === "cardio" && (
                <div>
                  <Label htmlFor="distance_km" className="text-sm">距离 ({t('distance')})</Label>
                  <Input
                    id="distance_km"
                    name="distance_km"
                    type="number"
                    value={editedEntry.distance_km || ""}
                    onChange={handleInputChange}
                    className="h-10 text-sm"
                  />
                </div>
              )}

              {entry.exercise_type === "strength" && (
                <>
                  <div>
                    <Label htmlFor="sets" className="text-sm">组数 ({t('sets')})</Label>
                    <Input
                      id="sets"
                      name="sets"
                      type="number"
                      value={editedEntry.sets || ""}
                      onChange={handleInputChange}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reps" className="text-sm">次数 ({t('reps')})</Label>
                    <Input
                      id="reps"
                      name="reps"
                      type="number"
                      value={editedEntry.reps || ""}
                      onChange={handleInputChange}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight_kg" className="text-sm">重量 ({t('weight')})</Label>
                    <Input
                      id="weight_kg"
                      name="weight_kg"
                      type="number"
                      value={editedEntry.weight_kg || ""}
                      onChange={handleInputChange}
                      className="h-10 text-sm"
                    />
                  </div>
                </>
              )}
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
                <h4 className="font-medium text-sm md:text-base">{entry.exercise_name}</h4>
                {entry.is_estimated && (
                  <span className="ml-0 sm:ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded self-start">{t('estimated')}</span>
                )}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                {entry.duration_minutes} {t('minutes')}
                {entry.time_period && ` · ${getTimePeriodLabel(entry.time_period)}`}
                {entry.distance_km && ` · ${entry.distance_km} ${t('distance')}`}
                {entry.sets && entry.reps && ` · ${entry.sets}${t('sets')} × ${entry.reps}${t('reps')}`}
                {entry.weight_kg && ` · ${entry.weight_kg}${t('weight')}`}
              </p>
              <p className="text-sm md:text-base font-medium mt-1">{formatNumber(entry.calories_burned_estimated, 0)} {t('calories')}</p>
              {entry.muscle_groups && (
                <p className="text-xs text-muted-foreground mt-1">{t('muscleGroups')}: {entry.muscle_groups.join(", ")}</p>
              )}
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
