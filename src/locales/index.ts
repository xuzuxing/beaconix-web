import dayjs from 'dayjs'
import { watch, type App } from 'vue'
import { createI18n } from 'vue-i18n'

import { useAppStore } from '@/stores'
import enUS from './en-US'
import zhCN from './zh-CN'

import 'dayjs/locale/zh-cn'

export const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

/**
 * 创建并安装 i18n。
 * 初始语言来自 app store（已持久化），因此必须在 pinia 安装之后调用。
 * 语言变化时同步 vue-i18n、dayjs 与 <html lang>。
 */
export function setupI18n(app: App) {
  const appStore = useAppStore()

  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: appStore.locale,
    fallbackLocale: 'zh-CN',
    messages,
  })

  watch(
    () => appStore.locale,
    (locale) => {
      i18n.global.locale.value = locale
      document.documentElement.lang = locale
      dayjs.locale(locale === 'zh-CN' ? 'zh-cn' : 'en')
    },
    { immediate: true },
  )

  app.use(i18n)

  return i18n
}
