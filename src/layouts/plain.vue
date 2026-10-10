<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import defaultLogo from '@/assets/logo/default.png'
import whiteLogo from '@/assets/logo/white-logo.png'
import AppIcon from '@/components/AppIcon.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { APP_TITLE } from '@/config'
import { BookOpen01Icon, ComputerIcon, HelpCircleIcon, Moon01Icon, Sun01Icon, UserIcon } from '@/icons'
import { useAppStore } from '@/stores'
import type { ThemeMode } from '@/types'

/**
 * 整页布局：只有一条精简顶栏（品牌 + 文档/帮助/主题/语言/账号），
 * 没有侧边菜单与二级菜单，用于「选择环境」这类控制台之外的独立页面。
 */
defineOptions({ name: 'PlainLayout' })

const { t } = useI18n()
const appStore = useAppStore()

/** 品牌 logo 随明暗主题切换 */
const logoSrc = computed(() => (appStore.isDark ? whiteLogo : defaultLogo))

const themeOptions = computed(() => [
  { content: t('layout.themeLight'), value: 'light' },
  { content: t('layout.themeDark'), value: 'dark' },
  { content: t('layout.themeAuto'), value: 'auto' },
])

const themeIcon = computed(() => {
  if (appStore.theme === 'dark') return Moon01Icon
  if (appStore.theme === 'auto') return ComputerIcon
  return Sun01Icon
})

function handleThemeSelect(data: { value?: string | number }) {
  appStore.setTheme((data.value as ThemeMode) ?? 'light')
}
</script>

<template>
  <div class="plain-layout">
    <header class="plain-layout__header">
      <img class="plain-layout__logo" :src="logoSrc" :alt="APP_TITLE" />

      <div class="plain-layout__extra">
        <t-tooltip :content="t('layout.docs')" placement="bottom">
          <button type="button" class="plain-layout__icon-btn" :aria-label="t('layout.docs')">
            <AppIcon :icon="BookOpen01Icon" />
          </button>
        </t-tooltip>

        <t-tooltip :content="t('layout.help')" placement="bottom">
          <button type="button" class="plain-layout__icon-btn" :aria-label="t('layout.help')">
            <AppIcon :icon="HelpCircleIcon" />
          </button>
        </t-tooltip>

        <t-dropdown trigger="click" :options="themeOptions" @click="handleThemeSelect">
          <button type="button" class="plain-layout__icon-btn" :aria-label="t('layout.theme')">
            <AppIcon :icon="themeIcon" />
          </button>
        </t-dropdown>

        <LanguageSwitcher />

        <button type="button" class="plain-layout__user" :aria-label="t('layout.profile')">
          <t-avatar size="32px">
            <AppIcon :icon="UserIcon" />
          </t-avatar>
        </button>
      </div>
    </header>

    <main class="plain-layout__body">
      <router-view />
    </main>
  </div>
</template>

<style scoped lang="less">
.plain-layout {
  display: flex;
  flex-direction: column;
  min-width: @beacon-layout-min-width;
  height: 100vh;
  overflow: hidden;

  &__header {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    height: @beacon-header-height;
    padding: 0 16px;
    background-color: @beacon-bg-container;
    border-bottom: 1px solid @beacon-border;
  }

  &__logo {
    display: block;
    width: auto;
    height: 24px;
  }

  &__extra {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
  }

  &__icon-btn {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    height: @beacon-header-height;
    padding: 0 12px;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      color: @beacon-brand;
    }
  }

  &__user {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    height: @beacon-header-height;
    padding: 0 8px 0 12px;
    cursor: pointer;
    background-color: transparent;
    border: 0;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background-color: @beacon-bg-page;
  }
}
</style>
