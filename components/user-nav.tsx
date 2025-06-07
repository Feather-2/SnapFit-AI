"use client"

import type { Session } from "next-auth"
import Link from "next/link"
import { signIn, signOut } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/language-switcher"
import { GitHubStar } from "@/components/github-star"
import { Moon, Sun, LogOut, LogIn } from "lucide-react"
import { useTheme } from "next-themes"

export function UserNav({ session }: { session: Session | null }) {
  const { theme, setTheme } = useTheme()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const handleSignIn = () => {
    signIn("linux-do")
  }

  return (
    <div className="flex items-center space-x-3">
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

      {session?.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={session.user.image ?? ""} alt={session.user.name ?? ""} />
                <AvatarFallback>{session.user.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuItem className="flex flex-col items-start">
              <div className="text-sm font-medium">{session.user.name}</div>
              <div className="text-xs text-muted-foreground">{session.user.email}</div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>登出</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={handleSignIn} variant="outline" className="rounded-xl">
          <LogIn className="mr-2 h-4 w-4" />
          登录
        </Button>
      )}
    </div>
  )
}