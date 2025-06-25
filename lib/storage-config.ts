/**
 * 存储配置工具
 * 根据环境变量决定使用哪种存储方式
 */

export type StorageMode = 'server' | 'browser'

/**
 * 获取当前存储模式
 */
export function getStorageMode(): StorageMode {
  // 从环境变量读取配置，默认使用browser模式
  const mode = process.env.NEXT_PUBLIC_STORAGE_MODE as StorageMode
  return mode === 'server' ? 'server' : 'browser'
}

/**
 * 检查是否使用服务端存储
 */
export function isServerStorage(): boolean {
  return getStorageMode() === 'server'
}

/**
 * 检查是否使用浏览器端存储
 */
export function isBrowserStorage(): boolean {
  return getStorageMode() === 'browser'
}

/**
 * 获取存储模式的描述信息
 */
export function getStorageModeInfo(): {
  mode: StorageMode
  description: string
  features: string[]
} {
  const mode = getStorageMode()
  
  if (mode === 'server') {
    return {
      mode: 'server',
      description: '服务端存储 (SQLite + Prisma)',
      features: [
        '数据持久化存储',
        '支持多设备同步',
        '支持数据分析',
        '需要数据库配置'
      ]
    }
  } else {
    return {
      mode: 'browser',
      description: '浏览器端存储 (IndexedDB)',
      features: [
        '本地离线存储',
        '无需服务端配置',
        '快速响应',
        '仅限单设备使用'
      ]
    }
  }
}

/**
 * 存储模式切换说明
 */
export const STORAGE_MODE_GUIDE = {
  envVariable: 'NEXT_PUBLIC_STORAGE_MODE',
  values: {
    server: 'server',
    browser: 'browser'
  },
  setup: {
    browser: [
      '设置环境变量: NEXT_PUBLIC_STORAGE_MODE=browser',
      '重启应用',
      '数据将存储在浏览器IndexedDB中'
    ],
    server: [
      '设置环境变量: NEXT_PUBLIC_STORAGE_MODE=server',
      '配置数据库: DATABASE_URL="file:./dev.db"',
      '运行数据库迁移: npx prisma db push',
      '重启应用',
      '数据将存储在SQLite数据库中'
    ]
  },
  migration: [
    '可以通过 /zh/migrate-data 页面进行数据迁移',
    '支持从IndexedDB迁移到服务端数据库',
    '迁移前建议先备份数据'
  ]
} 