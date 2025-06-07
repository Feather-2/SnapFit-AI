"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/hooks/use-i18n"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const t = useTranslation('navigation')

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="h-10 w-10 rounded-xl hover:bg-green-50 dark:hover:bg-slate-700/50 hover:scale-105 transition-all duration-300 border border-transparent hover:border-green-200 dark:hover:border-slate-600"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-green-600 dark:text-green-400" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-green-500 dark:text-green-300" />
      <span className="sr-only">{t('toggleTheme', { ns: 'navigation' })}</span>
    </Button>
  )
}