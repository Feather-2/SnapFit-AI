"use client"

import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "next-auth/react"
import { NextIntlClientProvider, AbstractIntlMessages } from "next-intl"

interface ProvidersProps {
  children: React.ReactNode
  locale: string
  messages: AbstractIntlMessages
  timeZone: string
}

export function Providers({ children, locale, messages, timeZone }: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </SessionProvider>
    </NextIntlClientProvider>
  )
}