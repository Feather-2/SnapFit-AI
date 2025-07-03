"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  MessageSquare,
  Settings,
  Moon,
  Sun,
  User,
  LogOut,
  Database,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { GitHubStar } from "@/components/github-star";
import { useTranslation } from "@/hooks/use-i18n";
import { locales, type Locale } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";

export function MainNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();
  const t = useTranslation("navigation");

  // 直接从路径中提取当前语言，确保准确性
  const getCurrentLocale = (): Locale => {
    for (const loc of locales) {
      if (pathname.startsWith(`/${loc}`)) {
        return loc;
      }
    }
    return "zh"; // 默认语言
  };

  const locale = getCurrentLocale();

  const navItems = [
    {
      name: t("home"),
      href: `/${locale}`,
      icon: Home,
    },
    {
      name: t("chat"),
      href: `/${locale}/chat`,
      icon: MessageSquare,
    },
    {
      name: "数据管理",
      href: `/${locale}/data-migration`,
      icon: Database,
    },
    {
      name: t("settings"),
      href: `/${locale}/settings`,
      icon: Settings,
    },
  ];

  return (
    <div className="sticky top-0 z-50 w-full border-b border-slate-200/20 dark:border-slate-600/30 bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl shadow-sm">
      <div className="flex h-20 items-center px-4 sm:px-8 lg:px-16">
        <div className="mr-8 hidden md:flex">
          <Link
            href={`/${locale}`}
            className="flex items-center space-x-4 group"
          >
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

        <nav className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3 mx-4 sm:mx-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-2 sm:px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 hover:bg-green-50 dark:hover:bg-slate-700/50 hover:scale-105",
                pathname === item.href
                  ? "bg-gradient-to-r from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 text-white dark:text-slate-900 shadow-lg shadow-green-500/25 dark:shadow-green-400/20"
                  : "text-slate-600 dark:text-slate-200 hover:text-green-600 dark:hover:text-green-300"
              )}
            >
              <item.icon className="h-4 w-4 lg:mr-2.5" />
              <span className="hidden lg:inline">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center space-x-2 sm:space-x-3">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="h-10 w-10 rounded-xl hover:bg-green-50 dark:hover:bg-slate-700/50 hover:scale-105 transition-all duration-300 border border-transparent hover:border-green-200 dark:hover:border-slate-600"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-green-600 dark:text-green-400" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-green-500 dark:text-green-300" />
            <span className="sr-only">切换主题</span>
          </Button>
          <GitHubStar repo="Feather-2/SnapFit-AI" />

          {/* 用户菜单 */}
          {isAuthenticated && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 px-3 rounded-xl hover:bg-green-50 dark:hover:bg-slate-700/50 hover:scale-105 transition-all duration-300 border border-transparent hover:border-green-200 dark:hover:border-slate-600"
                >
                  <User className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {user.username}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  disabled
                  className="text-xs text-muted-foreground"
                >
                  {user.username}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-red-600 dark:text-red-400"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
