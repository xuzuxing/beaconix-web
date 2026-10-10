<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import defaultIcon from '@/assets/logo/icon.png'
import defaultLogo from '@/assets/logo/default.png'
import whiteLogo from '@/assets/logo/white-logo.png'
import whiteIcon from '@/assets/logo/wihte-icon.png'
import AppIcon from '@/components/AppIcon.vue'
import GuideDialog from '@/components/guide/GuideDialog.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import type { Organization, Project } from '@/api/types'
import { APP_TITLE } from '@/config'
import { userMenuGroups } from '@/config/user'
import {
  BookOpen01Icon,
  ComputerIcon,
  Copy01Icon,
  FlashIcon,
  Folder01Icon,
  HelpCircleIcon,
  Moon01Icon,
  Notification03Icon,
  PlusSignIcon,
  Search01Icon,
  Settings01Icon,
  Sun01Icon,
  TeamWorkIcon,
  VerticalScrollPointIcon,
} from '@/icons'
import { useAppStore, useOrganizationStore, useUserStore } from '@/stores'
import type { ThemeMode } from '@/types'

defineOptions({ name: 'AppHeader' })

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const orgStore = useOrganizationStore()

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

// ---------- 团队（组织） ----------
/** 弹层：hover 显示团队信息卡，点击切到团队切换面板 */
const teamVisible = ref(false)
const teamMode = ref<'info' | 'list'>('info')
const teamKeyword = ref('')

const currentOrg = computed(() => orgStore.currentOrganization)

const filteredOrgs = computed(() => {
  const keyword = teamKeyword.value.trim().toLowerCase()
  if (!keyword) return orgStore.organizations
  return orgStore.organizations.filter(
    (org) => org.name.toLowerCase().includes(keyword) || org.slug.toLowerCase().includes(keyword),
  )
})

interface InfoRow {
  labelKey: string
  value: string
  copyable?: boolean
}

/** 团队信息卡的字段行 */
const teamInfoRows = computed<InfoRow[]>(() => {
  const org = currentOrg.value
  if (!org) return []
  return [
    { labelKey: 'layout.teamName', value: org.name, copyable: true },
    { labelKey: 'layout.teamSlug', value: org.slug, copyable: true },
    { labelKey: 'layout.teamId', value: org.id, copyable: true },
    { labelKey: 'layout.teamCreatedAt', value: org.createdAt },
  ]
})

async function selectOrg(org: Organization) {
  await orgStore.switchOrganization(org.id)
  teamMode.value = 'info'
  teamVisible.value = false
}

/** 团队管理页（阶段 4 落地，先复用现有入口） */
function goTeams() {
  void router.push('/env')
}

// ---------- 项目 ----------
const projectVisible = ref(false)
const projectKeyword = ref('')

const currentProject = computed(() => orgStore.currentProject)

const filteredProjects = computed(() => {
  const keyword = projectKeyword.value.trim().toLowerCase()
  if (!keyword) return orgStore.projects
  return orgStore.projects.filter(
    (project) =>
      project.name.toLowerCase().includes(keyword) || project.key.toLowerCase().includes(keyword),
  )
})

function selectProject(project: Project) {
  orgStore.switchProject(project.id)
  projectVisible.value = false
}

// ---------- 个人信息 ----------
/** 头像 hover 展开的个人信息面板 */
const userVisible = ref(false)
const userGroups = userMenuGroups
const appVersion = __APP_VERSION__

const displayName = computed(() => userStore.user?.name ?? '')

/** 头像用姓名首字母 */
const avatarText = computed(() => displayName.value.trim().slice(0, 1).toUpperCase())

const accountRows = computed<InfoRow[]>(() => {
  const user = userStore.user
  if (!user) return []
  return [
    { labelKey: 'layout.userName', value: user.name },
    { labelKey: 'layout.userEmail', value: user.email },
  ]
})

async function handleUserMenu(key: string) {
  if (key === 'logout') {
    await userStore.logout()
    orgStore.reset()
    MessagePlugin.success(t('layout.userLogoutDone'))
    await router.replace('/login')
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 剪贴板不可用时静默忽略
  }
}

/** 顶栏挂载即拉取团队与项目，保证选择器可用 */
async function loadWorkspace() {
  try {
    await orgStore.loadOrganizations()
    await orgStore.loadProjects()
  } catch {
    // 请求层已统一提示
  }
}

onMounted(() => {
  void loadWorkspace()
})
</script>

<template>
  <header class="app-header">
    <!-- 品牌区：宽度与一级侧栏对齐 -->
    <div class="app-header__brand" :class="{ 'app-header__brand--collapsed': collapsed }">
      <img class="app-header__logo" :src="logoSrc" :alt="APP_TITLE" />
    </div>

    <!-- 左侧功能组 -->
    <div class="app-header__main">
      <!-- 团队：hover 看信息，点击切到团队列表 -->
      <t-popup v-model:visible="teamVisible" trigger="hover" placement="bottom-left" :show-arrow="false"
        overlay-class-name="app-team-popup">
        <button type="button" class="app-header__team" @mouseenter="teamMode = 'info'"
          @click="teamMode = teamMode === 'list' ? 'info' : 'list'">
          <AppIcon class="app-header__team-icon" :icon="TeamWorkIcon" />
          <span class="app-header__team-name">{{ currentOrg?.name ?? t('layout.teamEmpty') }}</span>
          <AppIcon class="app-header__caret" :icon="VerticalScrollPointIcon" />
        </button>

        <template #content>
          <!-- 团队信息卡 -->
          <div v-if="teamMode === 'info'" class="team-card">
            <div v-for="row in teamInfoRows" :key="row.labelKey" class="team-card__row">
              <span class="team-card__label">{{ t(row.labelKey) }}</span>
              <span class="team-card__value">
                {{ row.value }}
                <button v-if="row.copyable" type="button" class="team-card__copy"
                  :aria-label="t('guide.copy')" @click="copyText(row.value)">
                  <AppIcon :icon="Copy01Icon" :size="14" />
                </button>
              </span>
            </div>
          </div>

          <!-- 团队切换面板 -->
          <div v-else class="team-list">
            <label class="team-list__search">
              <AppIcon class="team-list__search-icon" :icon="Search01Icon" :size="14" />
              <input v-model="teamKeyword" :placeholder="t('layout.teamSearch')" />
            </label>

            <ul class="team-list__items">
              <li v-for="org in filteredOrgs" :key="org.id">
                <button type="button" class="team-list__item"
                  :class="{ 'is-active': org.id === orgStore.currentOrganizationId }" @click="selectOrg(org)">
                  <span class="team-list__name">{{ org.name }}</span>
                  <span class="team-list__meta">{{ org.slug }}</span>
                </button>
              </li>
            </ul>

            <p v-if="!filteredOrgs.length" class="team-list__empty">{{ t('layout.teamEmpty') }}</p>

            <div class="team-list__actions">
              <button type="button" class="team-list__action" @click="goTeams">
                <AppIcon :icon="Settings01Icon" />
                {{ t('layout.teamManage') }}
              </button>
              <button type="button" class="team-list__action">
                <AppIcon :icon="PlusSignIcon" />
                {{ t('layout.teamCreate') }}
              </button>
            </div>
          </div>
        </template>
      </t-popup>

      <!-- 项目：点击切换当前项目 -->
      <t-popup v-model:visible="projectVisible" trigger="click" placement="bottom-left" :show-arrow="false"
        overlay-class-name="app-project-popup">
        <button type="button" class="app-header__project">
          <AppIcon class="app-header__project-icon" :icon="Folder01Icon" />
          <span class="app-header__project-name">
            {{ currentProject?.name ?? t('layout.projectEmpty') }}
          </span>
          <AppIcon class="app-header__caret" :icon="VerticalScrollPointIcon" />
        </button>

        <template #content>
          <div class="project-list">
            <label class="project-list__search">
              <AppIcon class="project-list__search-icon" :icon="Search01Icon" :size="14" />
              <input v-model="projectKeyword" :placeholder="t('layout.projectSearch')" />
            </label>

            <ul class="project-list__items">
              <li v-for="project in filteredProjects" :key="project.id">
                <button type="button" class="project-list__item"
                  :class="{ 'is-active': project.id === orgStore.currentProjectId }"
                  @click="selectProject(project)">
                  <span class="project-list__name">{{ project.name }}</span>
                  <span class="project-list__key">{{ project.key }}</span>
                </button>
              </li>
            </ul>

            <p v-if="!filteredProjects.length" class="project-list__empty">
              {{ t('layout.projectEmpty') }}
            </p>
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
          <t-avatar size="32px">{{ avatarText }}</t-avatar>
        </button>

        <template #content>
          <div class="user-panel">
            <div class="user-panel__profile">
              <t-avatar size="40px">{{ avatarText }}</t-avatar>
              <div class="user-panel__identity">
                <span class="user-panel__name">{{ displayName }}</span>
                <span class="user-panel__email">{{ userStore.user?.email }}</span>
              </div>
            </div>

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

  .user-panel__profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  .user-panel__identity {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .user-panel__name {
    overflow: hidden;
    font-size: @beacon-font-size-menu;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-panel__email {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
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

/* 团队弹层 teleport 到 body，样式需非 scoped，用 overlayClassName 限定作用域 */
.app-team-popup {
  padding: 0;

  // ---------- 团队信息卡（hover） ----------
  .team-card {
    width: 360px;
    padding: 12px 16px;
    background-color: @beacon-bg-container;
  }

  .team-card__row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 28px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
  }

  .team-card__label {
    flex: none;
    width: 64px;
    color: @beacon-text-tertiary;
  }

  .team-card__value {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: @beacon-text-primary;
    word-break: break-all;
  }

  .team-card__copy {
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

  // ---------- 团队切换面板（点击） ----------
  .team-list {
    width: 340px;
    background-color: @beacon-bg-container;
  }

  .team-list__search {
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

  .team-list__items {
    max-height: 220px;
    padding: 4px 0;
    overflow-y: auto;
  }

  .team-list__item {
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

      .team-list__meta {
        color: var(--td-text-color-anti);
      }
    }
  }

  .team-list__name {
    font-size: @beacon-font-size-menu;
  }

  .team-list__meta {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  .team-list__empty {
    margin: 0;
    padding: 16px 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-align: center;
  }

  .team-list__actions {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    border-top: 1px solid @beacon-border;
  }

  .team-list__action {
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
}

/* 项目弹层：只有搜索 + 列表 */
.app-project-popup {
  padding: 0;

  .project-list {
    width: 300px;
    background-color: @beacon-bg-container;
  }

  .project-list__search {
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

  .project-list__items {
    max-height: 240px;
    padding: 4px 0;
    overflow-y: auto;
  }

  .project-list__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
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

      .project-list__key {
        color: var(--td-text-color-anti);
      }
    }
  }

  .project-list__name {
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-menu;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-list__key {
    flex: none;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  .project-list__empty {
    margin: 0;
    padding: 16px 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-align: center;
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

  // 团队与项目选择器：外观一致，只有图标与数据不同
  &__team,
  &__project {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 4px 6px;
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

  &__team-icon {
    color: @beacon-brand;
  }

  &__project-icon {
    color: @beacon-text-secondary;
  }

  &__team-name,
  &__project-name {
    max-width: 140px;
    overflow: hidden;
    line-height: 28px;
    text-overflow: ellipsis;
    white-space: nowrap;
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
