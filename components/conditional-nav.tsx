"use client"

import { usePathname } from "next/navigation"
import { MainNav } from "@/components/main-nav"

export function ConditionalNav() {
  const pathname = usePathname()
  
  // 检查是否是认证页面
  const isAuthPage = pathname.includes('/auth/')
  
  // 如果是认证页面，不显示导航栏
  if (isAuthPage) {
    return null
  }
  
  return <MainNav />
}
