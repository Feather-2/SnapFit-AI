"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Shield, Star, Crown, User } from "lucide-react"

interface UserBadgeProps {
  user: {
    id: string
    username: string
    displayName?: string
    avatarUrl?: string
    trustLevel?: number
  }
  showTrustLevel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function UserBadge({
  user,
  showTrustLevel = true,
  size = 'md',
  className = ''
}: UserBadgeProps) {
  const getTrustLevelInfo = (trustLevel?: number) => {
    if (!trustLevel || trustLevel < 1) {
      return {
        icon: <User className="h-3 w-3 text-gray-400" />,
        label: "新用户",
        color: "bg-gray-100 text-gray-600"
      }
    }

    switch (trustLevel) {
      case 1:
        return {
          icon: <Shield className="h-3 w-3 text-blue-500" />,
          label: "LV1",
          color: "bg-blue-100 text-blue-700"
        }
      case 2:
        return {
          icon: <Star className="h-3 w-3 text-purple-500" />,
          label: "LV2",
          color: "bg-purple-100 text-purple-700"
        }
      case 3:
        return {
          icon: <Crown className="h-3 w-3 text-yellow-500" />,
          label: "LV3",
          color: "bg-yellow-100 text-yellow-700"
        }
      case 4:
        return {
          icon: <Crown className="h-3 w-3 text-orange-500" />,
          label: "LV4",
          color: "bg-orange-100 text-orange-700"
        }
      default:
        return {
          icon: <User className="h-3 w-3 text-red-500" />,
          label: `LV${trustLevel}`,
          color: "bg-red-100 text-red-700"
        }
    }
  }

  const sizeClasses = {
    sm: {
      avatar: "h-6 w-6",
      text: "text-xs",
      badge: "text-xs px-1.5 py-0.5"
    },
    md: {
      avatar: "h-8 w-8",
      text: "text-sm",
      badge: "text-xs px-2 py-1"
    },
    lg: {
      avatar: "h-10 w-10",
      text: "text-base",
      badge: "text-sm px-2.5 py-1"
    }
  }

  const trustInfo = getTrustLevelInfo(user.trustLevel)
  const sizes = sizeClasses[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Avatar className={sizes.avatar}>
        <AvatarImage src={user.avatarUrl} />
        <AvatarFallback className={sizes.text}>
          {(user.displayName || user.username).charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${sizes.text}`}>
            {user.displayName || user.username}
          </span>
          {showTrustLevel && (
            <Badge
              variant="outline"
              className={`${sizes.badge} ${trustInfo.color} border-current`}
            >
              <span className="flex items-center gap-1">
                {trustInfo.icon}
                {trustInfo.label}
              </span>
            </Badge>
          )}
        </div>
        {user.displayName && user.displayName !== user.username && (
          <p className={`text-muted-foreground truncate ${sizes.text}`}>
            @{user.username}
          </p>
        )}
      </div>
    </div>
  )
}

// 简化版本，只显示头像和名称
export function SimpleUserBadge({
  user,
  size = 'sm',
  className = ''
}: Omit<UserBadgeProps, 'showTrustLevel'>) {
  const sizeClasses = {
    sm: { avatar: "h-5 w-5", text: "text-xs" },
    md: { avatar: "h-6 w-6", text: "text-sm" },
    lg: { avatar: "h-8 w-8", text: "text-base" }
  }

  const sizes = sizeClasses[size]

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Avatar className={sizes.avatar}>
        <AvatarImage src={user.avatarUrl} />
        <AvatarFallback className="text-xs">
          {(user.displayName || user.username).charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className={`font-medium truncate ${sizes.text}`}>
        {user.displayName || user.username}
      </span>
    </div>
  )
}

// 信任等级徽章组件
export function TrustLevelBadge({
  trustLevel,
  showLabel = false,
  size = 'sm'
}: {
  trustLevel?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const trustInfo = {
    0: { icon: User, label: "新用户", color: "text-gray-400" },
    1: { icon: Shield, label: "LV1", color: "text-blue-500" },
    2: { icon: Star, label: "LV2", color: "text-purple-500" },
    3: { icon: Crown, label: "LV3", color: "text-yellow-500" },
    4: { icon: Crown, label: "LV4", color: "text-orange-500" }
  }

  const level = Math.min(trustLevel || 0, 4)
  const info = trustInfo[level as keyof typeof trustInfo]
  const Icon = info.icon

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  }

  if (!showLabel) {
    return (
      <Icon
        className={`${iconSize[size]} ${info.color}`}
        title={info.label}
      />
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Icon className={`${iconSize[size]} ${info.color}`} />
      <span className="text-xs text-muted-foreground">{info.label}</span>
    </div>
  )
}
