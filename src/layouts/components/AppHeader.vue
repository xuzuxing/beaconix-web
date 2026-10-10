<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import defaultIcon from '@/assets/logo/icon.png'
import defaultLogo from '@/assets/logo/default.png'
import whiteLogo from '@/assets/logo/white-logo.png'
import whiteIcon from '@/assets/logo/wihte-icon.png'
import AppIcon from '@/components/AppIcon.vue'
import GuideDialog from '@/components/guide/GuideDialog.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { APP_TITLE } from '@/config'
import { envList, type EnvItem } from '@/config/env'
import { userAccountRows, userMenuGroups } from '@/config/user'
import {
  BookOpen01Icon,
  ComputerIcon,
  Copy01Icon,
  FlashIcon,
  HelpCircleIcon,
  Invoice01Icon,
  Archive02Icon,
  Moon01Icon,
  Notification03Icon,
  PlusSignIcon,
  Settings01Icon,
  Search01Icon,
  Sun01Icon,
  UserIcon,
  VerticalScrollPointIcon,
} from '@/icons'
import { useAppStore, useEnvStore } from '@/stores'
import type { ThemeMode } from '@/types'

defineOptions({ name: 'AppHeader' })

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const envStore = useEnvStore()

const collapsed = computed(() => appStore.collapsed)

/** 品牌 logo：展开时用整标、折叠时用方形图标，并随明暗主题选深浅两版 */
const logoSrc = computed(() => {
  if (collapsed.value) return appStore.isDark ? whiteIcon : defaultIcon
  return appStore.isDark ? whiteLogo : defaultLogo
})

/** 「接入指引」弹窗开关 */
const guideVisible = ref(false)

/** 主题切换：浅色 / 深色 / 跟随系统 */
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

/** 环境列表为静态占位，接入环境接口后替换 */
// ---------- 个人信息 ----------
/** 头像 hover 展开的个人信息面板 */
const userVisible = ref(false)
const accountRows = userAccountRows
const userGroups = userMenuGroups
const appVersion = __APP_VERSION__

function handleUserMenu(key: string) {
  // 菜单项目前为占位：接入鉴权后，「切换账号」「退出登录」在此跳转
  void key
}

// ---------- 环境 ----------
/** 弹层：hover 显示信息卡，点击切到环境选择面板 */
const envVisible = ref(false)
const envMode = ref<'info' | 'list'>('info')
const envKeyword = ref('')

/** 当前环境来自全局 store：「选择环境」页切换后顶栏同步跟随 */
const currentEnv = computed(() => envStore.current)

interface EnvInfoRow {
  labelKey: string
  value: string
  copyable?: boolean
  status?: boolean
  plan?: boolean
}

/** 信息卡的字段行 */
const envInfoRows = computed<EnvInfoRow[]>(() => {
  const env = currentEnv.value
  return [
    { labelKey: 'layout.envName', value: env.name, copyable: true },
    { labelKey: 'layout.envId', value: env.id, copyable: true },
    { labelKey: 'layout.envStatus', value: '', status: true },
    { labelKey: 'layout.envCreatedAt', value: env.createdAt },
    { labelKey: 'layout.envExpiredAt', value: env.expiredAt },
    { labelKey: 'layout.envRegion', value: t(env.regionKey) },
    { labelKey: 'layout.envPlan', value: '', plan: true },
  ]
})

const filteredEnvs = computed(() => {
  const keyword = envKeyword.value.trim().toLowerCase()
  if (!keyword) return envList
  return envList.filter(
    (env) => env.name.toLowerCase().includes(keyword) || env.id.toLowerCase().includes(keyword),
  )
})

function selectEnv(env: EnvItem) {
  envStore.setCurrent(env.id)
  envMode.value = 'info'
  envVisible.value = false
}

/** 打开控制台之外的选择环境整页 */
function goManageEnv() {
  void router.push('/env')
}

/** 套餐用量页在主布局内 */
function goUsage() {
  void router.push('/usage')
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 剪贴板不可用时静默忽略
  }
}
</script>

<template>
  <header class="app-header">
    <!-- 品牌区：宽度与一级侧栏对齐 -->
    <div class="app-header__brand" :class="{ 'app-header__brand--collapsed': collapsed }">
      <img class="app-header__logo" :src="logoSrc" :alt="APP_TITLE" />
    </div>

    <!-- 左侧功能组 -->
    <div class="app-header__main">
      <!-- 环境：hover 看信息，点击切到选择面板 -->
      <t-popup v-model:visible="envVisible" trigger="hover" placement="bottom-left" :show-arrow="false"
        overlay-class-name="app-env-popup">
        <button type="button" class="app-header__env" @mouseenter="envMode = 'info'"
          @click="envMode = envMode === 'list' ? 'info' : 'list'">
          <AppIcon class="app-header__env-icon" :icon="Archive02Icon" />
          <span class="app-header__env-name">{{ currentEnv.name }}</span>
          <span v-if="currentEnv.tagKey" class="app-header__env-tag">
            {{ t(currentEnv.tagKey) }}
          </span>
          <AppIcon class="app-header__caret" :icon="VerticalScrollPointIcon" />
        </button>

        <template #content>
          <!-- 环境信息卡 -->
          <div v-if="envMode === 'info'" class="env-card">
            <div v-for="row in envInfoRows" :key="row.labelKey" class="env-card__row">
              <span class="env-card__label">{{ t(row.labelKey) }}</span>

              <span class="env-card__value">
                <template v-if="row.copyable">
                  {{ row.value }}
                  <button type="button" class="env-card__copy" :aria-label="t('guide.copy')"
                    @click="copyText(row.value)">
                    <AppIcon :icon="Copy01Icon" :size="14" />
                  </button>
                </template>

                <template v-else-if="row.status">
                  <i class="env-card__dot" />
                  {{ t(currentEnv.active ? 'layout.envStatusActive' : 'layout.envStatusInactive') }}
                </template>

                <template v-else-if="row.plan">
                  <span class="env-card__tag">{{ t(currentEnv.planKey) }}</span>
                  <a class="env-card__link" href="#">{{ t('layout.envViewUsage') }}</a>
                  <span class="env-card__tag env-card__tag--warning">
                    {{ t('badge.limited') }}
                  </span>
                </template>

                <template v-else>{{ row.value }}</template>
              </span>
            </div>
          </div>

          <!-- 环境选择面板 -->
          <div v-else class="env-list">
            <label class="env-list__search">
              <AppIcon class="env-list__search-icon" :icon="Search01Icon" :size="14" />
              <input v-model="envKeyword" :placeholder="t('layout.envSearch')" />
            </label>

            <ul class="env-list__items">
              <li v-for="env in filteredEnvs" :key="env.id">
                <button type="button" class="env-list__item" :class="{ 'is-active': env.id === currentEnv.id }"
                  @click="selectEnv(env)">
                  <span class="env-list__name">
                    {{ env.name }}
                    <span v-if="env.tagKey" class="env-list__tag">{{ t(env.tagKey) }}</span>
                  </span>
                  <span class="env-list__id">{{ env.id }}</span>
                </button>
              </li>
            </ul>

            <div class="env-list__actions">
              <button type="button" class="env-list__action" @click="goManageEnv">
                <AppIcon :icon="Settings01Icon" />
                {{ t('layout.envManage') }}
              </button>
              <button type="button" class="env-list__action" @click="goUsage">
                <AppIcon :icon="Invoice01Icon" />
                {{ t('layout.envUsage') }}
                <span class="env-list__badge">{{ t('badge.limited') }}</span>
              </button>
              <button type="button" class="env-list__action">
                <AppIcon :icon="PlusSignIcon" />
                {{ t('layout.envCreate') }}
              </button>
            </div>
          </div>
        </template>
      </t-popup>

      <button type="button" class="app-header__guide" @click="guideVisible = true">
        <AppIcon class="app-header__guide-icon" :icon="FlashIcon" :size="14" />
        {{ t('layout.guide') }}
        <span class="app-header__dot" />
      </button>
    </div>

    <!-- 右侧功能组 -->
    <div class="app-header__extra">
      <!-- 全局搜索：已就位，搜索逻辑待接入 -->
      <label class="app-header__search">
        <AppIcon class="app-header__search-icon" :icon="Search01Icon" />
        <input class="app-header__search-input" type="search" :placeholder="t('layout.searchPlaceholder')" />
        <span class="app-header__hotkey">/</span>
      </label>

      <button type="button" class="app-header__pending">
        <AppIcon class="app-header__pending-icon" :icon="Notification03Icon" />
        {{ t('layout.pending') }}
        <span class="app-header__dot" />
      </button>

      <t-tooltip :content="t('layout.docs')" placement="bottom">
        <button type="button" class="app-header__icon-btn" :aria-label="t('layout.docs')">
          <AppIcon :icon="BookOpen01Icon" />
        </button>
      </t-tooltip>

      <t-tooltip :content="t('layout.help')" placement="bottom">
        <button type="button" class="app-header__icon-btn" :aria-label="t('layout.help')">
          <AppIcon :icon="HelpCircleIcon" />
        </button>
      </t-tooltip>

      <t-dropdown trigger="click" :options="themeOptions" @click="handleThemeSelect">
        <button type="button" class="app-header__icon-btn" :aria-label="t('layout.theme')">
          <AppIcon :icon="themeIcon" />
        </button>
      </t-dropdown>

      <LanguageSwitcher />

      <!-- 个人信息：hover 展开 -->
      <t-popup v-model:visible="userVisible" trigger="hover" placement="bottom-right" :show-arrow="false"
        overlay-class-name="app-user-popup">
        <button type="button" class="app-header__user" :aria-label="t('layout.profile')">
          <t-avatar size="32px">
            <AppIcon :icon="UserIcon" />
          </t-avatar>
        </button>

        <template #content>
          <div class="user-panel">
            <div class="user-panel__ids">
              <div v-for="row in accountRows" :key="row.labelKey" class="user-panel__row">
                <span class="user-panel__label">{{ t(row.labelKey) }}</span>
                <span class="user-panel__value">{{ row.value }}</span>
                <button type="button" class="user-panel__copy" :aria-label="t('guide.copy')"
                  @click="copyText(row.value)">
                  <AppIcon :icon="Copy01Icon" :size="14" />
                </button>
              </div>
            </div>

            <div v-for="(group, index) in userGroups" :key="index" class="user-panel__group">
              <button v-for="item in group" :key="item.key" type="button" class="user-panel__item"
                :class="{ 'user-panel__item--danger': item.danger }" @click="handleUserMenu(item.key)">
                <AppIcon :icon="item.icon" :size="16" />
                {{ t(item.labelKey) }}
              </button>
            </div>

            <div class="user-panel__version">
              {{ t('layout.userVersion') }}：{{ appVersion }}
            </div>
          </div>
        </template>
      </t-popup>
    </div>

    <GuideDialog v-model="guideVisible" />
  </header>
</template>

<style lang="less">
/* 个人信息弹层（头像 hover），同样 teleport 到 body 故用非 scoped 样式 */
.app-user-popup {
  padding: 0;

  .user-panel {
    width: 260px;
    background-color: @beacon-bg-container;
  }

  .user-panel__ids {
    padding: 8px 0;
  }

  .user-panel__row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 0 16px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
  }

  .user-panel__label {
    flex: none;
    color: @beacon-text-tertiary;
  }

  .user-panel__value {
    color: @beacon-text-primary;
  }

  .user-panel__copy {
    flex: none;
    padding: 0;
    color: @beacon-text-tertiary;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      color: @beacon-brand;
    }
  }

  .user-panel__group {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    border-top: 1px solid @beacon-border;
  }

  .user-panel__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    font-family: inherit;
    font-size: @beacon-font-size-menu;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      background-color: @beacon-bg-hover;
    }

    &--danger {
      color: @beacon-error;
    }
  }

  .user-panel__version {
    padding: 8px 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-disabled;
    border-top: 1px solid @beacon-border;
  }
}

/* 环境弹层 teleport 到 body，样式需非 scoped，用 overlayClassName 限定作用域 */
.app-env-popup {
  padding: 0;

  // ---------- 环境信息卡（hover） ----------
  .env-card {
    width: 360px;
    padding: 12px 16px;
    background-color: @beacon-bg-container;
  }

  .env-card__row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 28px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
  }

  .env-card__label {
    flex: none;
    width: 64px;
    color: @beacon-text-tertiary;
  }

  .env-card__value {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: @beacon-text-primary;
    word-break: break-all;
  }

  .env-card__copy {
    flex: none;
    padding: 0;
    color: @beacon-text-tertiary;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      color: @beacon-brand;
    }
  }

  .env-card__dot {
    width: 8px;
    height: 8px;
    background-color: @beacon-success;
    border-radius: 50%;
  }

  .env-card__tag {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-tertiary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border-strong;
    border-radius: @beacon-radius-m;

    &--warning {
      color: var(--td-text-color-anti);
      background-color: var(--td-warning-color);
      border-color: var(--td-warning-color);
    }
  }

  .env-card__link {
    flex: none;
    color: @beacon-brand;

    &:hover {
      color: @beacon-brand-hover;
    }
  }

  // ---------- 环境选择面板（点击） ----------
  .env-list {
    width: 340px;
    background-color: @beacon-bg-container;
  }

  .env-list__search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 12px 0;
    padding: 4px 2px 8px;
    color: @beacon-text-tertiary;
    border-bottom: 1px solid @beacon-border;

    &:focus-within {
      border-bottom-color: @beacon-brand;
    }

    input {
      flex: 1;
      min-width: 0;
      font-family: inherit;
      font-size: @beacon-font-size-base;
      color: @beacon-text-primary;
      background-color: transparent;
      border: 0;
      outline: none;

      &::placeholder {
        color: @beacon-text-tertiary;
      }
    }
  }

  .env-list__items {
    max-height: 220px;
    padding: 4px 0;
    overflow-y: auto;
  }

  .env-list__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 12px;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    text-align: left;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      background-color: @beacon-bg-hover;
    }

    &.is-active {
      color: var(--td-text-color-anti);
      background-color: @beacon-brand;

      .env-list__id {
        color: var(--td-text-color-anti);
      }

      .env-list__tag {
        color: var(--td-text-color-anti);
        border-color: rgb(255 255 255 / 40%);
      }
    }
  }

  .env-list__name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: @beacon-font-size-menu;
  }

  .env-list__tag {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 16px;
    color: @beacon-text-tertiary;
    border: 1px solid @beacon-border-strong;
    border-radius: @beacon-radius-m;
  }

  .env-list__id {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  .env-list__actions {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    border-top: 1px solid @beacon-border;
  }

  .env-list__action {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-family: inherit;
    font-size: @beacon-font-size-menu;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      background-color: @beacon-bg-hover;
    }
  }

  .env-list__badge {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 16px;
    color: var(--td-text-color-anti);
    background-color: var(--td-warning-color);
    border-radius: @beacon-radius-m;
  }
}
</style>

<style scoped lang="less">
.app-header {
  display: flex;
  flex: none;
  align-items: center;
  height: @beacon-header-height;
  // 左侧内边距交给品牌区，使品牌区宽度与一级侧栏一致
  padding: 0 12px 0 0;
  background-color: @beacon-bg-container;
  border-bottom: 1px solid @beacon-border;

  // ---------- 品牌区：宽度与一级侧栏保持一致 ----------
  &__brand {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: @beacon-sider-width;
    height: 100%;
    overflow: hidden;
    color: @beacon-brand;

    // 折叠时与折叠后的侧栏同宽，只留方形图标
    &--collapsed {
      width: @beacon-sider-collapsed-width;
      padding-left: 12px;

      .app-header__logo {
        width: 24px;
        height: 24px;
      }
    }
  }

  &__logo {
    display: block;
    width: auto;
    height: 24px;
    max-width: 100%;
  }

  // ---------- 左侧功能组 ----------
  &__main {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    gap: @beacon-gap-l;
    padding-left: 20px;

    // 与品牌区之间的分隔竖线：1×20px，居中于 40px 间距内
    &::before {
      position: absolute;
      top: 50%;
      left: 0;
      width: 1px;
      height: 20px;
      background-color: @beacon-border;
      content: '';
      transform: translate(-50%, -50%);
    }
  }

  &__env {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 4px;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: 4px;

    &:hover {
      background-color: @beacon-bg-hover;
    }
  }

  &__env-name {
    max-width: 140px;
    overflow: hidden;
    line-height: 28px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__env-tag {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: 20px;
    padding: 0 7px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-tertiary;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border-strong;
    border-radius: @beacon-radius-m;
  }

  &__caret {
    color: @beacon-text-tertiary;
  }

  &__guide {
    position: relative;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    height: 30px;
    margin-left: 20px;
    padding: 0 12px;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;

    &:hover {
      color: @beacon-brand;
      border-color: @beacon-brand;
    }
  }

  &__guide-icon {
    color: @beacon-brand;
  }

  &__dot {
    position: absolute;
    top: 4px;
    right: 6px;
    width: 6px;
    height: 6px;
    background-color: @beacon-error;
    border-radius: 50%;
  }

  // ---------- 右侧功能组 ----------
  &__extra {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    padding-right: 8px;
  }

  &__search {
    position: relative;
    display: flex;
    align-items: center;
    width: 360px;
    height: 30px;
    margin: 0 8px;
    padding: 0 12px 0 36px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;

    &:hover {
      border-color: @beacon-brand-hover;
    }
  }

  &__search-icon {
    position: absolute;
    left: 12px;
    color: @beacon-text-tertiary;
  }

  &__search-input {
    flex: 1;
    min-width: 0;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    background-color: transparent;
    border: 0;
    outline: none;

    &::placeholder {
      color: @beacon-text-tertiary;
    }

    &::-webkit-search-cancel-button {
      display: none;
    }
  }

  &__hotkey {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: 20px;
    padding: 0 7px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-tertiary;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border-strong;
    border-radius: @beacon-radius-m;
  }

  &__pending {
    position: relative;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    height: 30px;
    padding: 0 16px;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    line-height: 28px;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;

    &:hover {
      color: @beacon-brand;
      border-color: @beacon-brand;
    }
  }

  &__pending-icon {
    color: @beacon-text-secondary;
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
    margin-right: -12px;
    padding: 0 16px;
    cursor: pointer;
    background-color: transparent;
    border: 0;
  }
}
</style>
