<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import enConfig from 'tdesign-vue-next/es/locale/en_US'
import zhConfig from 'tdesign-vue-next/es/locale/zh_CN'

import { useBrand } from '@/composables/useBrand'
import { usePublicSettings } from '@/composables/usePublicSettings'
import { useAppStore } from '@/stores'
import type { LocaleType } from '@/types'

const appStore = useAppStore()
const route = useRoute()
const { t } = useI18n()

const { load } = usePublicSettings()
const { siteName, faviconUrl } = useBrand()

/** 首屏拉一次公开配置（站点名 / Logo / favicon），全应用共享这份缓存 */
void load()

/** TDesign 组件内置文案随应用语言切换 */
const TDESIGN_LOCALES: Record<LocaleType, unknown> = {
  'zh-CN': zhConfig,
  'en-US': enConfig,
}

const globalConfig = computed(() => TDESIGN_LOCALES[appStore.locale])

// 写到 <html theme-mode>，TDesign 的 [theme-mode='dark'] 作用域据此生效
watchEffect(() => {
  document.documentElement.setAttribute(
    'theme-mode',
    appStore.isDark ? 'dark' : 'light',
  )
})

// 页面标题随路由、语言与平台配置的站点名变化
watchEffect(() => {
  const titleKey = route.meta.titleKey
  const brand = siteName.value
  document.title = titleKey ? `${t(titleKey)} · ${brand}` : brand
})

// favicon：平台配置了就用它，否则保留 index.html 里打包的那份
watchEffect(() => {
  const href = faviconUrl.value
  if (!href) return

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
})
</script>

<template>
  <t-config-provider :global-config="globalConfig">
    <router-view />
  </t-config-provider>
</template>
