'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales, type Locale } from '../i18n';
import { useCallback } from 'react';

export function useI18n() {
  try {
    const t = useTranslations();
    const locale = useLocale() as Locale;
    const router = useRouter();
    const pathname = usePathname();

    const changeLocale = (newLocale: Locale) => {
      // 保存语言偏好到本地存储
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferred-locale', newLocale);
      }

      // 获取当前路径，移除语言前缀
      let pathWithoutLocale = pathname;

      // 移除所有可能的语言前缀
      for (const loc of locales) {
        if (pathWithoutLocale.startsWith(`/${loc}`)) {
          pathWithoutLocale = pathWithoutLocale.substring(`/${loc}`.length);
          break;
        }
      }

      // 确保路径以 / 开头，如果为空则设为 /
      if (!pathWithoutLocale || pathWithoutLocale === '') {
        pathWithoutLocale = '/';
      } else if (!pathWithoutLocale.startsWith('/')) {
        pathWithoutLocale = '/' + pathWithoutLocale;
      }

      // 构建新路径
      const newPath = pathWithoutLocale === '/' ? `/${newLocale}` : `/${newLocale}${pathWithoutLocale}`;

      // 导航到新语言的路径
      router.push(newPath);
    };

    return {
      t,
      locale,
      locales,
      changeLocale,
    };
  } catch (error) {
    // 如果上下文不可用，返回默认值
    const router = useRouter();
    const pathname = usePathname();

    // 从路径中提取当前语言
    const getCurrentLocaleFromPath = (): Locale => {
      for (const loc of locales) {
        if (pathname.startsWith(`/${loc}`)) {
          return loc;
        }
      }
      return 'zh'; // 默认语言
    };

    return {
      t: (key: string) => key, // 返回key作为默认值
      locale: getCurrentLocaleFromPath(),
      locales,
      changeLocale: (newLocale: Locale) => {
        // 简单的路径处理，移除可能的语言前缀
        let cleanPath = pathname;
        locales.forEach(loc => {
          if (pathname.startsWith(`/${loc}`)) {
            cleanPath = pathname.substring(`/${loc}`.length);
          }
        });

        if (!cleanPath.startsWith('/')) {
          cleanPath = '/' + cleanPath;
        }

        if (cleanPath === '/') {
          cleanPath = '';
        }

        router.push(`/${newLocale}${cleanPath}`);
      },
    };
  }
}

// 便捷的翻译钩子
type TFunction = (key: string, values?: Record<string, any>) => string;

export function useTranslation(namespace?: string): TFunction {
  try {
    const t = useTranslations(namespace);
    return useCallback((key: string, values?: Record<string, any>): string => {
      // next-intl的t函数可以返回React元素，我们这里强制转为字符串
      const message = t(key, values);
      return typeof message === 'string' ? message : key;
    }, [t]);
  } catch (error) {
    // 如果上下文不可用，返回一个默认函数
    return useCallback((key: string) => key, []);
  }
}
