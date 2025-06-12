import Link from "next/link"
import { LanguageSwitcher } from "@/components/language-switcher"
import { GitHubStar } from "@/components/github-star"
import type { Locale } from "@/i18n"
import Image from "next/image"
import { auth } from "@/lib/auth"
import { MainNavLinks } from "./main-nav-links"
import { MobileNav } from "./mobile-nav"
import { UserNav } from "./user-nav"
import { ThemeToggle } from "./theme-toggle"
import { UsageBadge } from "@/components/usage/usage-indicator"

export async function MainNav({ locale }: { locale: Locale }) {
  const session = await auth()

  return (
    <div className="sticky top-0 z-50 w-full border-b border-slate-200/20 dark:border-slate-600/30 bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl shadow-sm">
      <div className="flex h-14 md:h-20 items-center px-4 md:px-8 lg:px-16">
        {/* 桌面端Logo：使用带文字的snapifit.svg，简化布局 */}
        <div className="mr-4 md:mr-8 hidden md:flex">
          <Link href={`/${locale}`} className="flex items-center group">
            <img
              src="/snapifit.svg"
              alt="Snapifit AI Logo"
              className="h-18 md:h-24 w-auto select-none group-hover:scale-105 transition-transform duration-300"
              style={{ filter: 'invert(34%) sepia(61%) saturate(504%) hue-rotate(90deg) brightness(95%) contrast(92%)' }}
            />
          </Link>
        </div>

        <MainNavLinks locale={locale} />

        <div className="ml-auto flex items-center space-x-2 md:space-x-3">
          {/* 紧凑的使用量显示 - 只在登录且有权限时显示 */}
          {session?.user && session.user.trustLevel && session.user.trustLevel >= 1 && session.user.trustLevel <= 4 && (
            <div className="hidden sm:block">
              <UsageBadge className="text-xs" />
            </div>
          )}
          <UserNav session={session} />
          {/* 桌面端显示完整按钮组 */}
          <div className="hidden md:flex items-center space-x-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <GitHubStar repo="Feather-2/SnapFit-AI" />
          </div>
          {/* 移动端使用汉堡菜单 */}
          <MobileNav locale={locale} />
        </div>
      </div>
    </div>
  )
}
