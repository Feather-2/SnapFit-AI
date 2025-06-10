/**
 * 信任等级限额配置
 * 根据用户的信任等级设置不同的使用限额
 */

export interface TrustLevelLimits {
  // 每日对话次数限额
  dailyConversations: number
  // 每日API调用次数限额（如果需要）
  dailyApiCalls?: number
  // 每月上传文件数量限额（如果需要）
  monthlyUploads?: number
  // 其他限额...
}

export interface TrustLevelConfig {
  level: number
  name: string
  description: string
  limits: TrustLevelLimits
  // 权限配置
  permissions: {
    canUseSharedService: boolean
    canShareKeys: boolean
    canManageKeys: boolean
    canUploadFiles?: boolean
    canCreateGroups?: boolean
  }
}

/**
 * 信任等级配置表
 * 可以根据需要调整各等级的限额和权限
 */
export const TRUST_LEVEL_CONFIGS: Record<number, TrustLevelConfig> = {
  0: {
    level: 0,
    name: "新用户",
    description: "刚注册的新用户，功能受限",
    limits: {
      dailyConversations: 0, // 新用户无法使用对话功能
      dailyApiCalls: 0,
      monthlyUploads: 0
    },
    permissions: {
      canUseSharedService: false,
      canShareKeys: false,
      canManageKeys: false,
      canUploadFiles: false,
      canCreateGroups: false
    }
  },
  1: {
    level: 1,
    name: "信任用户",
    description: "获得基础信任的用户",
    limits: {
      dailyConversations: 40, // 一级：每天40次
      dailyApiCalls: 100,
      monthlyUploads: 10
    },
    permissions: {
      canUseSharedService: true,
      canShareKeys: true,
      canManageKeys: true,
      canUploadFiles: true,
      canCreateGroups: false
    }
  },
  2: {
    level: 2,
    name: "高级用户",
    description: "活跃且可靠的社区成员",
    limits: {
      dailyConversations: 80, // 二级：每天80次
      dailyApiCalls: 200,
      monthlyUploads: 25
    },
    permissions: {
      canUseSharedService: true,
      canShareKeys: true,
      canManageKeys: true,
      canUploadFiles: true,
      canCreateGroups: true
    }
  },
  3: {
    level: 3,
    name: "VIP用户",
    description: "社区的重要贡献者",
    limits: {
      dailyConversations: 150, // 三级：每天150次
      dailyApiCalls: 500,
      monthlyUploads: 50
    },
    permissions: {
      canUseSharedService: true,
      canShareKeys: true,
      canManageKeys: true,
      canUploadFiles: true,
      canCreateGroups: true
    }
  },
  4: {
    level: 4,
    name: "超级VIP",
    description: "社区的核心成员和领导者",
    limits: {
      dailyConversations: 150, // 四级：每天150次
      dailyApiCalls: 1000,
      monthlyUploads: 100
    },
    permissions: {
      canUseSharedService: true,
      canShareKeys: true,
      canManageKeys: true,
      canUploadFiles: true,
      canCreateGroups: true
    }
  }
}

/**
 * 获取指定信任等级的配置
 */
export function getTrustLevelConfig(trustLevel: number): TrustLevelConfig {
  return TRUST_LEVEL_CONFIGS[trustLevel] || TRUST_LEVEL_CONFIGS[0]
}

/**
 * 获取用户的每日对话限额
 */
export function getDailyConversationLimit(trustLevel: number): number {
  const config = getTrustLevelConfig(trustLevel)
  return config.limits.dailyConversations
}

/**
 * 检查用户是否有权限使用某个功能
 */
export function hasPermission(trustLevel: number, permission: keyof TrustLevelConfig['permissions']): boolean {
  const config = getTrustLevelConfig(trustLevel)
  return config.permissions[permission] || false
}

/**
 * 获取用户的所有限额信息
 */
export function getUserLimits(trustLevel: number): TrustLevelLimits {
  const config = getTrustLevelConfig(trustLevel)
  return config.limits
}

/**
 * 获取所有信任等级的配置（用于管理界面）
 */
export function getAllTrustLevelConfigs(): TrustLevelConfig[] {
  return Object.values(TRUST_LEVEL_CONFIGS).sort((a, b) => a.level - b.level)
}

/**
 * 验证信任等级是否有效
 */
export function isValidTrustLevel(trustLevel: number): boolean {
  return trustLevel >= 0 && trustLevel <= 4 && TRUST_LEVEL_CONFIGS[trustLevel] !== undefined
}

/**
 * 获取下一个等级的信息（用于升级提示）
 */
export function getNextLevelInfo(currentLevel: number): TrustLevelConfig | null {
  const nextLevel = currentLevel + 1
  return TRUST_LEVEL_CONFIGS[nextLevel] || null
}

/**
 * 计算等级提升后的收益
 */
export function getLevelUpBenefits(currentLevel: number): {
  conversationIncrease: number
  newPermissions: string[]
} | null {
  const current = getTrustLevelConfig(currentLevel)
  const next = getNextLevelInfo(currentLevel)
  
  if (!next) return null
  
  const conversationIncrease = next.limits.dailyConversations - current.limits.dailyConversations
  const newPermissions: string[] = []
  
  // 检查新增的权限
  Object.entries(next.permissions).forEach(([key, value]) => {
    if (value && !current.permissions[key as keyof typeof current.permissions]) {
      newPermissions.push(key)
    }
  })
  
  return {
    conversationIncrease,
    newPermissions
  }
}
