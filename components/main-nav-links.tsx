"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, MessageSquare, Settings } from "lucide-react"
import { useTranslation } from "@/hooks/use-i18n"
import type { Locale } from "@/i18n"

export function MainNavLinks({ locale }: { locale: Locale }) {
  const pathname = usePathname()
  const t = useTranslation('navigation')

  const navItems = [
    {
      name: t('home'),
      href: `/${locale}`,
      icon: Home,
    },
    {
      name: t('chat'),
      href: `/${locale}/chat`,
      icon: MessageSquare,
    },
    {
      name: t('settings'),
      href: `/${locale}/settings`,
      icon: Settings,
    },
  ]

  return (
    <nav className="flex items-center space-x-2 lg:space-x-3 mx-8">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 hover:bg-green-50 dark:hover:bg-slate-700/50 hover:scale-105",
            pathname === item.href
              ? "bg-gradient-to-r from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 text-white dark:text-slate-900 shadow-lg shadow-green-500/25 dark:shadow-green-400/20"
              : "text-slate-600 dark:text-slate-200 hover:text-green-600 dark:hover:text-green-300",
          )}
        >
          <item.icon className="h-4 w-4 mr-2.5" />
          <span className="hidden sm:inline">{item.name}</span>
        </Link>
      ))}
    </nav>
  )
}