"use client"

import { useState, useEffect, useCallback } from "react"
import { useServerStorage } from "./use-server-storage"
import type { UserProfile } from "@/lib/types"

interface UserProfileServerHook {
  userProfile: UserProfile | null
  saveUserProfile: (profile: UserProfile) => Promise<void>
  deleteUserProfile: () => Promise<void>
  loadUserProfile: () => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function useUserProfileServer(): UserProfileServerHook {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const { getData, saveData, deleteData, isLoading, error } = useServerStorage()

  // 加载用户配置
  const loadUserProfile = useCallback(async () => {
    try {
      const response = await getData('/api/db/user-profile')
      setUserProfile(response.profile)
    } catch (err) {
      console.error('Load user profile error:', err)
      // 如果是404错误，说明用户还没有配置，这是正常的
      if (err instanceof Error && err.message.includes('404')) {
        setUserProfile(null)
      } else {
        throw err
      }
    }
  }, [getData])

  // 保存用户配置
  const saveUserProfile = useCallback(
    async (profile: UserProfile): Promise<void> => {
      try {
        const response = await saveData('/api/db/user-profile', profile)
        setUserProfile(response.profile)
      } catch (err) {
        console.error('Save user profile error:', err)
        throw err
      }
    },
    [saveData]
  )

  // 删除用户配置
  const deleteUserProfile = useCallback(
    async (): Promise<void> => {
      try {
        await deleteData('/api/db/user-profile')
        setUserProfile(null)
      } catch (err) {
        console.error('Delete user profile error:', err)
        throw err
      }
    },
    [deleteData]
  )

  // 初始加载
  useEffect(() => {
    loadUserProfile().catch(console.error)
  }, [loadUserProfile])

  return {
    userProfile,
    saveUserProfile,
    deleteUserProfile,
    loadUserProfile,
    isLoading,
    error,
  }
}
