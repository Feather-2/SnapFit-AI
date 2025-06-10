"use client"

import type { Session } from "next-auth"
import { signIn, signOut } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user/user-avatar"
import { TrustLevelBadge } from "@/components/user/user-badge"
import { UsageProgress } from "@/components/usage/usage-indicator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut, LogIn, Settings, Shield } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "@/hooks/use-i18n"

export function UserNav({ session }: { session: Session | null }) {
  const t = useTranslation('navigation')
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const handleSignIn = () => {
    signIn("linux-do")
  }

  const canUseSharedService = (trustLevel?: number) => {
    return trustLevel && trustLevel >= 1 && trustLevel <= 4
  }

  return (
    <>
      {session?.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
              <UserAvatar
                user={{
                  username: session.user.name || 'User',
                  displayName: session.user.displayName || session.user.name || 'User',
                  avatarUrl: session.user.image || '',
                  trustLevel: session.user.trustLevel
                }}
                size="lg"
                showTrustLevel={true}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72" align="end" forceMount>
            {/* 用户信息头部 */}
            <div className="p-4 space-y-3">
              {/* 用户基本信息 */}
              <div className="flex items-start gap-3">
                <UserAvatar
                  user={{
                    username: session.user.name || 'User',
                    displayName: session.user.displayName || session.user.name || 'User',
                    avatarUrl: session.user.image || '',
                    trustLevel: session.user.trustLevel
                  }}
                  size="lg"
                  showTrustLevel={true}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {session.user.displayName || session.user.name}
                  </div>
                  {session.user.displayName && session.user.name && session.user.displayName !== session.user.name && (
                    <div className="text-xs text-muted-foreground truncate">
                      @{session.user.name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {session.user.email}
                  </div>
                </div>
              </div>

              {/* 信任等级信息 - 占用全宽 */}
              <div className="flex items-center justify-between">
                <TrustLevelBadge
                  trustLevel={session.user.trustLevel}
                  showLabel={true}
                  size="sm"
                />
                {canUseSharedService(session.user.trustLevel) ? (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    <Shield className="w-3 h-3 mr-1" />
                    {t('canUseSharedService')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                    {t('insufficientPermission')}
                  </Badge>
                )}
              </div>

              {/* 使用量信息 - 占用全宽 */}
              {canUseSharedService(session.user.trustLevel) && (
                <UsageProgress showRefresh={true} />
              )}
            </div>

            <DropdownMenuSeparator />

            {/* 菜单项 */}
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>{t('userMenu.settings')}</span>
              </Link>
            </DropdownMenuItem>

            {canUseSharedService(session.user.trustLevel) && (
              <DropdownMenuItem asChild>
                <Link href="/settings/keys" className="flex items-center">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>{t('userMenu.sharedServices')}</span>
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('userMenu.signOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={handleSignIn} variant="outline" className="rounded-xl">
          <LogIn className="mr-2 h-4 w-4" />
          {t('userMenu.signIn')}
        </Button>
      )}
    </>
  )
}