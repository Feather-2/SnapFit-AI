"use client"

import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "next-auth/react"
import { NextIntlClientProvider, AbstractIntlMessages } from "next-intl"
import type { Session } from "next-auth"

interface ProvidersProps {
  children: React.ReactNode
  locale: string
  messages: AbstractIntlMessages
  timeZone: string
  initialSession?: Session | null
}

export function Providers({ children, locale, messages, timeZone, initialSession }: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <SessionProvider session={initialSession}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </SessionProvider>
    </NextIntlClientProvider>
  )
}