"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* 弥散绿色背景效果 - 带动画 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-40 top-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -right-40 top-40 w-80 h-80 bg-emerald-400/25 rounded-full blur-3xl animate-bounce-slow"></div>
        <div className="absolute left-20 bottom-20 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl animate-breathing"></div>
        <div className="absolute right-32 bottom-40 w-64 h-64 bg-emerald-500/25 rounded-full blur-3xl animate-float"></div>
        <div className="absolute left-1/2 top-1/3 w-56 h-56 bg-emerald-400/20 rounded-full blur-3xl transform -translate-x-1/2 animate-glow"></div>
      </div>

      <Card className="w-full max-w-md relative z-10 bg-slate-800/95 border-slate-600/30 backdrop-blur-xl shadow-2xl shadow-black/20">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex items-center justify-center mb-6">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/25">
              <span className="text-white font-bold text-xl">S</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-white">
            登录
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            输入您的用户名和密码来访问您的账户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300 font-medium">
                用户名
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isSubmitting}
                placeholder="请输入用户名"
                className="bg-slate-700/60 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-green-500/20 h-12 rounded-lg transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 font-medium">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                placeholder="请输入密码"
                className="bg-slate-700/60 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-green-500/20 h-12 rounded-lg transition-all duration-200"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold h-12 rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-green-500/30 hover:shadow-green-500/40"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              登录
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-400">还没有账户？</span>{" "}
            <Link
              href="/auth/register"
              className="text-green-400 hover:text-green-300 font-medium transition-colors hover:underline"
            >
              立即注册
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
