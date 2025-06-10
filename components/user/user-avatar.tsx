"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Shield, Star, Crown, User } from "lucide-react"

interface UserAvatarProps {
  user: {
    id?: string
    username?: string
    displayName?: string
    avatarUrl?: string
    trustLevel?: number
  }
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showTrustLevel?: boolean
  className?: string
}

export function UserAvatar({ 
  user, 
  size = 'md', 
  showTrustLevel = true,
  className = '' 
}: UserAvatarProps) {
  const getTrustLevelBadge = (trustLevel?: number) => {
    if (!trustLevel || trustLevel < 1 || trustLevel > 4) return null
    
    switch (trustLevel) {
      case 1:
        return <Shield className="h-2.5 w-2.5 text-blue-500" title="LV1" />
      case 2:
        return <Star className="h-2.5 w-2.5 text-purple-500" title="LV2" />
      case 3:
        return <Crown className="h-2.5 w-2.5 text-yellow-500" title="LV3" />
      case 4:
        return <Crown className="h-2.5 w-2.5 text-orange-500" title="LV4" />
      default:
        return null
    }
  }

  const sizeClasses = {
    xs: {
      avatar: "h-5 w-5",
      fallback: "text-xs",
      badge: "w-3 h-3 -top-0.5 -right-0.5"
    },
    sm: {
      avatar: "h-6 w-6", 
      fallback: "text-xs",
      badge: "w-3.5 h-3.5 -top-0.5 -right-0.5"
    },
    md: {
      avatar: "h-8 w-8",
      fallback: "text-xs", 
      badge: "w-4 h-4 -top-1 -right-1"
    },
    lg: {
      avatar: "h-10 w-10",
      fallback: "text-sm",
      badge: "w-5 h-5 -top-1 -right-1"
    },
    xl: {
      avatar: "h-12 w-12",
      fallback: "text-base",
      badge: "w-6 h-6 -top-1.5 -right-1.5"
    }
  }

  const sizes = sizeClasses[size]
  const displayName = user.displayName || user.username || 'User'
  const fallbackText = displayName.charAt(0).toUpperCase()

  if (!showTrustLevel || !user.trustLevel || user.trustLevel < 1 || user.trustLevel > 4) {
    // 简单头像，无等级角标
    return (
      <Avatar className={`${sizes.avatar} ${className}`}>
        <AvatarImage src={user.avatarUrl} />
        <AvatarFallback className={sizes.fallback}>
          {fallbackText}
        </AvatarFallback>
      </Avatar>
    )
  }

  // 带等级角标的头像
  return (
    <div className={`relative ${className}`}>
      <Avatar className={sizes.avatar}>
        <AvatarImage src={user.avatarUrl} />
        <AvatarFallback className={sizes.fallback}>
          {fallbackText}
        </AvatarFallback>
      </Avatar>
      
      {/* 信任等级角标 */}
      <div className={`absolute ${sizes.badge} rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm`}>
        {getTrustLevelBadge(user.trustLevel)}
      </div>
    </div>
  )
}

// 简化版本，只显示头像
export function SimpleUserAvatar({ 
  user, 
  size = 'md',
  className = '' 
}: Omit<UserAvatarProps, 'showTrustLevel'>) {
  return (
    <UserAvatar 
      user={user} 
      size={size} 
      showTrustLevel={false}
      className={className}
    />
  )
}

// 带等级的头像（强制显示等级）
export function TrustLevelAvatar({ 
  user, 
  size = 'md',
  className = '' 
}: Omit<UserAvatarProps, 'showTrustLevel'>) {
  return (
    <UserAvatar 
      user={user} 
      size={size} 
      showTrustLevel={true}
      className={className}
    />
  )
}

// 头像组合组件（头像 + 用户名 + 等级）
export function UserAvatarWithName({ 
  user, 
  size = 'md',
  showTrustLevel = true,
  layout = 'horizontal',
  className = ''
}: UserAvatarProps & { 
  layout?: 'horizontal' | 'vertical' 
}) {
  const isHorizontal = layout === 'horizontal'
  
  return (
    <div className={`flex ${isHorizontal ? 'items-center gap-2' : 'flex-col items-center gap-1'} ${className}`}>
      <UserAvatar 
        user={user} 
        size={size} 
        showTrustLevel={showTrustLevel}
      />
      
      <div className={`${isHorizontal ? 'flex-1 min-w-0' : 'text-center'}`}>
        <p className={`font-medium truncate ${
          size === 'xs' ? 'text-xs' : 
          size === 'sm' ? 'text-sm' : 
          size === 'lg' ? 'text-base' : 
          size === 'xl' ? 'text-lg' : 'text-sm'
        }`}>
          {user.displayName || user.username}
        </p>
        
        {user.displayName && user.username && user.displayName !== user.username && (
          <p className={`text-muted-foreground truncate ${
            size === 'xs' ? 'text-xs' : 
            size === 'sm' ? 'text-xs' : 
            size === 'lg' ? 'text-sm' : 
            size === 'xl' ? 'text-base' : 'text-xs'
          }`}>
            @{user.username}
          </p>
        )}
      </div>
    </div>
  )
}

// 用于排行榜的用户头像组件
export function LeaderboardUserAvatar({ 
  user, 
  rank,
  className = ''
}: {
  user: UserAvatarProps['user']
  rank?: number
  className?: string
}) {
  const getRankBadge = (rank?: number) => {
    if (!rank || rank > 3) return null
    
    const colors = {
      1: 'bg-yellow-500 text-white',
      2: 'bg-gray-400 text-white', 
      3: 'bg-amber-600 text-white'
    }
    
    return (
      <div className={`absolute -top-1 -left-1 w-4 h-4 rounded-full ${colors[rank as keyof typeof colors]} flex items-center justify-center text-xs font-bold`}>
        {rank}
      </div>
    )
  }
  
  return (
    <div className={`relative ${className}`}>
      <UserAvatar user={user} size="md" showTrustLevel={true} />
      {getRankBadge(rank)}
    </div>
  )
}
