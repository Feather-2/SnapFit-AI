import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "../globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { MainNav } from "@/components/main-nav"
import { locales, type Locale } from '@/i18n';

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SnapFit AI",
  description: "AI-based Personal Health Management Tool. Your personal cyber coach and nutritionist.",
  generator: 'Feather-2'
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: Locale };
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = params;

  // 验证语言是否支持
  if (!locales.includes(locale)) {
    notFound();
  }

  // 获取翻译消息
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div className="min-h-screen bg-background">
          <MainNav locale={locale} />
          <main>{children}</main>
        </div>
        <Toaster />
      </ThemeProvider>
    </NextIntlClientProvider>
  )
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
