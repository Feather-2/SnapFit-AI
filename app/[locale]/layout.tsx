import type React from "react"
import type { Metadata } from "next"
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "../globals.css"
import { Toaster } from "@/components/ui/toaster"
import { MainNav } from "@/components/main-nav"
import { locales, type Locale } from '@/i18n';
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "SnapFit AI",
  description: "AI-based Personal Health Management Tool. Your personal cyber coach and nutritionist.",
  generator: 'Feather-2'
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params;

  // 验证语言是否支持
  if (!locales.includes(locale)) {
    notFound();
  }

  // 获取翻译消息
  const messages = await getMessages({ locale });

  // 使用 next-auth 的 auth() 方法在服务器端获取会话
  const session = await auth();

  return (
    <Providers
      locale={locale}
      messages={messages}
      timeZone="Asia/Shanghai"
      initialSession={session}
    >
      <div className="min-h-screen bg-background">
        <MainNav locale={locale} />
        <main>{children}</main>
      </div>
      <Toaster />
    </Providers>
  )
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
