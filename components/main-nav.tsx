import Link from "next/link"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/language-switcher"
import { GitHubStar } from "@/components/github-star"
import type { Locale } from "@/i18n"
import Image from "next/image"
import { auth } from "@/lib/auth"
import { MainNavLinks } from "./main-nav-links"
import { UserNav } from "./user-nav"
import { ThemeToggle } from "./theme-toggle"

export async function MainNav({ locale }: { locale: Locale }) {
  const session = await auth()

  return (
    <div className="sticky top-0 z-50 w-full border-b border-slate-200/20 dark:border-slate-600/30 bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl shadow-sm">
      <div className="flex h-20 items-center px-8 lg:px-16">
        <div className="mr-8 hidden md:flex">
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

        <div className="ml-auto flex items-center space-x-3">
          <UserNav session={session} />
          <LanguageSwitcher />
          <ThemeToggle />
          <GitHubStar repo="Feather-2/SnapFit-AI" />
        </div>
      </div>
    </div>
  )
}
