import { usePreferredDark } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { DEFAULT_LOCALE } from '@/config'
import type { LocaleType, ThemeMode } from '@/types'

/** 应用级状态：语言、主题、布局等全局 UI 状态，持久化到 localStorage */
export const useAppStore = defineStore(
  'app',
  () => {
    /** 当前语言 */
    const locale = ref<LocaleType>(DEFAULT_LOCALE)
    /** 主题模式，auto 表示跟随系统 */
    const theme = ref<ThemeMode>('light')
    /** 侧边栏是否折叠 */
    const collapsed = ref(false)

    /** 当前实际是否暗色（auto 时跟随系统），供需要用主题选资源的场景使用 */
    const preferredDark = usePreferredDark()
    const isDark = computed(() =>
      theme.value === 'auto' ? preferredDark.value : theme.value === 'dark',
    )

    function setLocale(value: LocaleType) {
      locale.value = value
    }

    function setTheme(value: ThemeMode) {
      theme.value = value
    }

    function toggleCollapsed() {
      collapsed.value = !collapsed.value
    }

    function setCollapsed(value: boolean) {
      collapsed.value = value
    }

    return {
      locale,
      theme,
      collapsed,
      isDark,
      setLocale,
      setTheme,
      toggleCollapsed,
      setCollapsed,
    }
  },
  {
    persist: {
      key: 'beacon-vue3:app',
      pick: ['locale', 'theme', 'collapsed'],
    },
  },
)
