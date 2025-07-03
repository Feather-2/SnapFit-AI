import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ConditionalNav } from "@/components/conditional-nav";
import { AuthProvider } from "@/components/auth-provider";
import { VersionChecker } from "@/components/version-checker";
import { locales } from "@/i18n";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SnapFit AI",
  description:
    "AI-based Personal Health Management Tool. Your personal cyber coach and nutritionist.",
  generator: "Feather-2",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  // 验证语言是否支持
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // 获取翻译消息
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider messages={messages}>
      <AuthProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-background">
            <ConditionalNav />
            <main>{children}</main>
          </div>
          <Toaster />
          <VersionChecker />
        </ThemeProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
