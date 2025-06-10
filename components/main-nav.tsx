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
        {/* 桌面端显示Logo，移动端隐藏 */}
        <div className="mr-4 md:mr-8 hidden md:flex">
          <Link href={`/${locale}`} className="flex items-center space-x-4 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
              <Image
                src="/placeholder.svg"
                alt="SnapFit AI Logo"
                width={24}
                height={24}
                className="brightness-0 invert"
              />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-green-600 to-green-700 dark:from-green-300 dark:to-green-400 bg-clip-text text-transparent">
              SnapFit AI
            </span>
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
