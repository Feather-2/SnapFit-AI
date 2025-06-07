"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FaLinux } from 'react-icons/fa';

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">欢迎回来</CardTitle>
          <CardDescription>
            使用您的 Linux.do 账号登录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => signIn("linux-do", { callbackUrl: "/" })}
          >
            <FaLinux className="mr-2 h-5 w-5" />
            使用 Linux.do 登录
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}