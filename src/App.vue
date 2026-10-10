<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import enConfig from 'tdesign-vue-next/es/locale/en_US'
import zhConfig from 'tdesign-vue-next/es/locale/zh_CN'

import { APP_TITLE } from '@/config'
import { useAppStore } from '@/stores'
import type { LocaleType } from '@/types'

const appStore = useAppStore()
const route = useRoute()
const { t } = useI18n()

/** TDesign 组件内置文案随应用语言切换 */
const TDESIGN_LOCALES: Record<LocaleType, unknown> = {
  'zh-CN': zhConfig,
  'en-US': enConfig,
}

const globalConfig = computed(() => TDESIGN_LOCALES[appStore.locale])

// 写到 <html theme-mode>，TDesign 的 [theme-mode='dark'] 作用域据此生效
watchEffect(() => {
  document.documentElement.setAttribute('theme-mode', appStore.isDark ? 'dark' : 'light')
})

// 页面标题随路由与语言变化，布局与路由由 src/layouts 承载
watchEffect(() => {
  const titleKey = route.meta.titleKey
  document.title = titleKey ? `${t(titleKey)} · ${APP_TITLE}` : APP_TITLE
})
</script>

<template>
  <t-config-provider :global-config="globalConfig">
    <router-view />
  </t-config-provider>
</template>
