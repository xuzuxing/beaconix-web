<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import defaultIcon from '@/assets/logo/icon.png'
import defaultLogo from '@/assets/logo/default.png'
import whiteLogo from '@/assets/logo/white-logo.png'
import whiteIcon from '@/assets/logo/wihte-icon.png'
import AppIcon from '@/components/AppIcon.vue'
import GuideDialog from '@/components/guide/GuideDialog.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import NotificationDrawer from '@/components/notifications/NotificationDrawer.vue'
import ProjectCreateDialog from '@/components/project/ProjectCreateDialog.vue'
import GlobalSearch from '@/components/search/GlobalSearch.vue'
import type { Organization, Project } from '@/api/types'
import type { Plan } from '@/api/types/billing'
import { useTeamPlans } from '@/composables/useTeamPlans'
import { usePermissionsStore } from '@/stores/modules/permissions'
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
  ResourcesAddIcon,
  Search01Icon,
  Settings01Icon,
  Sun01Icon,
  UserIcon,
  VerticalScrollPointIcon,
} from '@/icons'
import { useAppStore, useNotificationStore, useOrganizationStore, useUserStore } from '@/stores'
import type { ThemeMode } from '@/types'
import { planTagTheme, planTier } from '@/utils/billing'

defineOptions({ name: 'AppHeader' })

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const orgStore = useOrganizationStore()
const notificationStore = useNotificationStore()
const permissions = usePermissionsStore()

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

/** 当前团队套餐标签：无生效订阅时回退为免费版文案 */
const planLabel = computed(() => orgStore.currentPlan?.name ?? t('usage.package.freePlan'))

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
  if (router.currentRoute.value.name === 'monitor-detail') await router.replace('/monitor')
  else
    await router.replace({
      path: router.currentRoute.value.path,
      query: router.currentRoute.value.query,
    })
}

/** 团队管理不进侧边栏，入口只放在这个下拉里；跳转到控制台之外的「选择团队」整页 */
function goTeams() {
  teamVisible.value = false
  void router.push('/team')
}

/** 各团队的套餐：当前团队复用 store，其余按需加载（与选择团队页共用同一实现） */
const { planOf, loadTeamPlans } = useTeamPlans()

/** 套餐标签文案：无生效订阅时回退为免费版 */
function planLabelOf(plan: Plan | null) {
  return plan?.name ?? t('usage.package.freePlan')
}

// 打开团队切换面板时补齐套餐标签
watch([teamVisible, teamMode], ([visible, mode]) => {
  if (visible && mode === 'list') void loadTeamPlans()
})

/** 进入某团队的成员页 / 团队管理页：先切到该团队，再跳转 */
async function openTeamPage(org: Organization, path: string) {
  teamVisible.value = false
  await orgStore.switchOrganization(org.id)
  await router.push(path)
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

async function selectProject(project: Project) {
  await orgStore.switchProject(project.id)
  projectVisible.value = false
  if (router.currentRoute.value.name === 'monitor-detail') await router.replace('/monitor')
}

/** 新建项目弹窗：只有组织管理员能创建（接口要求 ADMIN+） */
const projectCreateVisible = ref(false)

const canCreateProject = computed(
  () =>
    !!orgStore.currentOrganizationId && permissions.canOrganization(orgStore.currentOrganizationId),
)

function openProjectCreate() {
  projectVisible.value = false
  projectCreateVisible.value = true
}

/** store 已在创建成功后切到新项目，这里只补路由收尾（与 selectProject 一致） */
async function onProjectCreated() {
  if (router.currentRoute.value.name === 'monitor-detail') await router.replace('/monitor')
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
    return
  }

  // 其余入口按 config/user.ts 里配置的路由跳转（没有 path 的表示暂未接入）
  const target = userGroups.flat().find((item) => item.key === key)
  if (target?.path) {
    userVisible.value = false
    await router.push(target.path)
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
    if (orgStore.workspaceState !== 'ready') await orgStore.loadWorkspace()
  } catch {
    // 请求层已统一提示
  }
}

onMounted(() => {
  void loadWorkspace()
  // 顶栏事项入口的角标：未读数与事项抽屉共用同一份状态
  void notificationStore.refreshUnreadCount()
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
      <t-popup
        v-model:visible="teamVisible"
        trigger="hover"
        placement="bottom-left"
        :show-arrow="false"
        overlay-class-name="app-team-popup"
      >
        <button
          type="button"
          class="app-header__team"
          @mouseenter="teamMode = 'info'"
          @click="teamMode = teamMode === 'list' ? 'info' : 'list'"
        >
          <AppIcon class="app-header__team-icon" :icon="ResourcesAddIcon" />
          <span class="app-header__team-name">{{ currentOrg?.name ?? t('layout.teamEmpty') }}</span>
          <t-tag
            v-if="orgStore.subscription"
            class="app-header__team-tag beacon-plan-badge"
            :class="`beacon-plan--${planTier(orgStore.currentPlan)}`"
            :theme="planTagTheme(orgStore.currentPlan)"
            variant="light"
            size="small"
          >
            {{ planLabel }}
          </t-tag>
          <AppIcon class="app-header__caret" :icon="VerticalScrollPointIcon" />
        </button>

        <template #content>
          <!-- 团队信息卡 -->
          <div v-if="teamMode === 'info'" class="team-card">
            <div v-for="row in teamInfoRows" :key="row.labelKey" class="team-card__row">
              <span class="team-card__label">{{ t(row.labelKey) }}</span>
              <span class="team-card__value">
                {{ row.value }}
                <button
                  v-if="row.copyable"
                  type="button"
                  class="team-card__copy"
                  :aria-label="t('guide.copy')"
                  @click="copyText(row.value)"
                >
                  <AppIcon :icon="Copy01Icon" :size="14" />
                </button>
              </span>
            </div>

            <!-- 当前团队套餐标签 -->
            <div v-if="orgStore.subscription" class="team-card__row">
              <span class="team-card__label">{{ t('layout.teamPlan') }}</span>
              <span class="team-card__value">
                <t-tag
                  class="beacon-plan-badge"
                  :class="`beacon-plan--${planTier(orgStore.currentPlan)}`"
                  :theme="planTagTheme(orgStore.currentPlan)"
                  variant="light"
                  size="small"
                >
                  {{ planLabel }}
                </t-tag>
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
                <div
                  class="team-list__item"
                  :class="{ 'is-active': org.id === orgStore.currentOrganizationId }"
                >
                  <button type="button" class="team-list__main" @click="selectOrg(org)">
                    <span class="team-list__name">{{ org.name }}</span>
                    <t-tag
                      v-if="planOf(org)"
                      class="team-list__plan beacon-plan-badge"
                      :class="`beacon-plan--${planTier(planOf(org))}`"
                      :theme="planTagTheme(planOf(org))"
                      variant="light"
                      size="small"
                    >
                      {{ planLabelOf(planOf(org)) }}
                    </t-tag>
                  </button>

                  <!-- 两个入口：该团队的成员页 / 团队管理页（都会先切到该团队） -->
                  <div v-if="permissions.canOrganization(org.id)" class="team-list__entries">
                    <button
                      type="button"
                      class="team-list__entry"
                      :title="t('submenu.team.members')"
                      :aria-label="t('submenu.team.members')"
                      @click="openTeamPage(org, '/teams/members')"
                    >
                      <AppIcon :icon="UserIcon" :size="14" />
                    </button>
                    <button
                      type="button"
                      class="team-list__entry"
                      :title="t('menu.team')"
                      :aria-label="t('menu.team')"
                      @click="openTeamPage(org, '/teams')"
                    >
                      <AppIcon :icon="Settings01Icon" :size="14" />
                    </button>
                  </div>
                </div>
              </li>
            </ul>

            <p v-if="!filteredOrgs.length" class="team-list__empty">{{ t('layout.teamEmpty') }}</p>

            <div class="team-list__actions">
              <button type="button" class="team-list__action" @click="goTeams">
                <AppIcon :icon="Settings01Icon" />
                {{ t('menu.team') }}
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
      <t-popup
        v-model:visible="projectVisible"
        trigger="click"
        placement="bottom-left"
        :show-arrow="false"
        overlay-class-name="app-project-popup"
      >
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
                <button
                  type="button"
                  class="project-list__item"
                  :class="{ 'is-active': project.id === orgStore.currentProjectId }"
                  @click="selectProject(project)"
                >
                  <span class="project-list__name">{{ project.name }}</span>
                  <span class="project-list__key">{{ project.key }}</span>
                </button>
              </li>
            </ul>

            <p v-if="!filteredProjects.length" class="project-list__empty">
              {{ t('layout.projectEmpty') }}
            </p>

            <div v-if="canCreateProject" class="project-list__actions">
              <button type="button" class="project-list__action" @click="openProjectCreate">
                <AppIcon :icon="PlusSignIcon" />
                {{ t('layout.projectCreate') }}
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
      <!-- 全局搜索：输入框触发，结果面板在下方弹出 -->
      <GlobalSearch />

      <button type="button" class="app-header__pending" @click="notificationStore.toggleDrawer()">
        <AppIcon class="app-header__pending-icon" :icon="Notification03Icon" />
        {{
          notificationStore.hasUnread
            ? t('layout.pending', { count: notificationStore.unreadCount })
            : t('layout.pendingEmpty')
        }}
        <span v-if="notificationStore.hasUnread" class="app-header__dot" />
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
      <t-popup
        v-model:visible="userVisible"
        trigger="hover"
        placement="bottom-right"
        :show-arrow="false"
        overlay-class-name="app-user-popup"
      >
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
                <button
                  type="button"
                  class="user-panel__copy"
                  :aria-label="t('guide.copy')"
                  @click="copyText(row.value)"
                >
                  <AppIcon :icon="Copy01Icon" :size="14" />
                </button>
              </div>
            </div>

            <div v-for="(group, index) in userGroups" :key="index" class="user-panel__group">
              <button
                v-for="item in group"
                :key="item.key"
                type="button"
                class="user-panel__item"
                :class="{ 'user-panel__item--danger': item.danger }"
                @click="handleUserMenu(item.key)"
              >
                <AppIcon :icon="item.icon" :size="16" />
                {{ t(item.labelKey) }}
              </button>
            </div>

            <div class="user-panel__version">{{ t('layout.userVersion') }}：{{ appVersion }}</div>
          </div>
        </template>
      </t-popup>
    </div>

    <GuideDialog v-model="guideVisible" />
    <ProjectCreateDialog v-model:visible="projectCreateVisible" @created="onProjectCreated" />
    <NotificationDrawer />
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
    width: 380px;
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
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 8px 4px 12px;

    &:hover {
      background-color: @beacon-bg-hover;
    }

    &.is-active {
      background-color: @beacon-brand;

      .team-list__name {
        color: var(--td-text-color-anti);
      }

      // 高亮底色上入口图标要反色，悬停底色同理，避免看不清
      .team-list__entry {
        color: var(--td-text-color-anti);

        &:hover {
          color: var(--td-text-color-anti);
          background-color: rgb(255 255 255 / 16%);
        }
      }
    }
  }

  // 名称 + 套餐标签：点击切换当前团队
  .team-list__main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 0;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    text-align: left;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
  }

  .team-list__name {
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-menu;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .team-list__plan {
    flex: none;
  }

  // 右侧两个入口：团队成员 / 团队管理
  .team-list__entries {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 2px;
  }

  .team-list__entry {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius-m;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
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

  // 底部操作区：新建项目
  .project-list__actions {
    padding: 4px 0;
    border-top: 1px solid @beacon-border;
  }

  .project-list__action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
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
    color: @beacon-text-secondary;
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

  // 团队名右侧的套餐标签，不参与收缩
  &__team-tag {
    flex: none;
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
