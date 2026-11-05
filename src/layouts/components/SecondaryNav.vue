<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { RUM_APP_NAV, normalizeRumAppSection, type RumAppSection } from '@/config/rum-app-nav'
import { buildMenu } from '@/router/menu'
import { layoutChildren } from '@/router/routes'
import { useUserStore } from '@/stores'
import type { MenuItem } from '@/types'

/**
 * 二级菜单：展示当前一级模块的子页面。
 * 只有带子路由的模块才会渲染，宽度与样式对齐参考实现的 180px 侧栏。
 * 进入 RUM 应用工作台（/rum/:projectId/:appId/*）后，切换成该应用的页内导航。
 */
defineOptions({ name: 'SecondaryNav' })

const route = useRoute()
const userStore = useUserStore()
const { t } = useI18n()

/**
 * 与侧边菜单同一份数据（按当前角色过滤），额外包含 meta.hidden 的模块：
 * 团队管理这类只从顶栏下拉进入的模块，也要在左侧渲染它的子页导航。
 */
const menu = computed(() =>
  buildMenu(layoutChildren, {
    roles: userStore.user ? [userStore.user.globalRole] : [],
    includeHidden: true,
  }),
)

/** 当前路由所属的一级菜单项（按路径前缀匹配，取最长者） */
const current = computed(() => {
  let matched: MenuItem | undefined
  menu.value.forEach((item) => {
    if (!item.submenu) return
    const isSelf = route.path === item.path
    const isChild = route.path.startsWith(`${item.path}/`)
    if (!isSelf && !isChild) return
    if (!matched || item.path.length > matched.path.length) {
      matched = item
    }
  })
  return matched
})

const activePath = computed(() =>
  route.query.returnTo === 'project-errors' && route.path.startsWith('/rum/')
    ? '/rum/errors'
    : (route.meta.activeMenu ?? route.path),
)

/**
 * RUM 应用工作台的应用内导航：路由 meta 标记 rumAppScoped 时渲染，
 * 页面地址带 projectId/appId，无法由路由表静态生成，因此在这里按当前参数拼装。
 */
const appNav = computed(() => {
  const scoped =
    route.meta.rumAppScoped ||
    route.name === 'rum-error-detail' ||
    route.name === 'rum-replay-detail'
  const projectId = typeof route.params.projectId === 'string' ? route.params.projectId : ''
  const appId = typeof route.params.appId === 'string' ? route.params.appId : ''
  if (!scoped || !projectId || !appId) return null
  const base = `/rum/${encodeURIComponent(projectId)}/${encodeURIComponent(appId)}`
  return {
    items: RUM_APP_NAV.map((item) => ({
      ...item,
      path: `${base}/${item.section}`,
    })),
    appsPath: '/rum',
  }
})

/** 当前高亮的应用内页面：详情页（错误/回放）归属到它所属的列表页 */
const activeSection = computed<RumAppSection | ''>(() => {
  if (!appNav.value) return ''
  if (route.name === 'rum-error-detail') return 'errors'
  if (route.name === 'rum-replay-detail') return 'replays'
  return normalizeRumAppSection(route.params.section)
})

function renderTitle(item: MenuItem) {
  return item.titleKey ? t(item.titleKey) : item.path
}
</script>

<template>
  <aside
    v-if="appNav || current?.submenu"
    class="secondary-nav"
  >
    <div class="secondary-nav__header">
      <h2 class="secondary-nav__title">
        {{ appNav ? t('rumProject.appDetail') : current ? renderTitle(current) : '' }}
      </h2>
    </div>

    <nav class="secondary-nav__body">
      <ul class="secondary-nav__list">
        <template v-if="appNav">
          <li class="secondary-nav__cell">
            <router-link
              class="secondary-nav__link"
              :to="appNav.appsPath"
            >
              {{ t('rum.backToApps') }}
            </router-link>
          </li>
          <template
            v-for="item in appNav.items"
            :key="item.section"
          >
            <li
              v-if="item.groupKey"
              class="secondary-nav__group"
            >
              {{ t(item.groupKey) }}
            </li>
            <li class="secondary-nav__cell">
              <router-link
                class="secondary-nav__link"
                :class="{
                  'secondary-nav__link--active': activeSection === item.section,
                }"
                :to="item.path"
              >
                {{ t(item.titleKey) }}
              </router-link>
            </li>
          </template>
        </template>
        <template v-else>
          <template
            v-for="item in current?.submenu"
            :key="item.path"
          >
            <li
              v-if="item.type === 'group'"
              class="secondary-nav__group"
            >
              {{ renderTitle(item) }}
            </li>
            <li
              v-else
              class="secondary-nav__cell"
            >
              <router-link
                class="secondary-nav__link"
                :class="{
                  'secondary-nav__link--active': activePath === item.path,
                }"
                :to="item.path"
              >
                {{ renderTitle(item) }}
              </router-link>
            </li>
          </template>
        </template>
      </ul>
    </nav>
  </aside>
</template>

<style scoped lang="less">
.secondary-nav {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 180px;
  height: 100%;
  background-color: @beacon-bg-container;
  border-right: 1px solid @beacon-sider-secondary-border;

  &__header {
    flex: none;
    padding: 0 8px;
  }

  &__title {
    margin: 0;
    padding: 12px 8px;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
  }

  &__body {
    flex: 1;
    min-height: 0;
    padding: 12px 0 8px;
    overflow-y: auto;
  }

  &__list {
    padding: 0 8px;
  }

  // 分组标签：文字 + 右侧延伸的横线
  &__group {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    font-size: @beacon-font-size-base;
    line-height: 32px;
    color: rgba(0, 0, 0, 0.4);

    &::after {
      flex: 1;
      height: 1px;
      background-color: @beacon-bg-active;
      content: '';
    }
  }

  &__cell {
    height: 32px;
  }

  &__link {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 6px 0 6px 8px;
    font-size: 14px;
    line-height: 20px;
    color: @beacon-text-primary;
    border-radius: @beacon-radius-m;

    // 子项前的圆点，颜色跟随文字（选中时即品牌蓝）
    &::before {
      flex: none;
      width: 4px;
      height: 4px;
      margin-right: 8px;
      background-color: currentcolor;
      border-radius: 50%;
      content: '';
    }

    &:hover {
      color: @beacon-brand;
    }

    &--active {
      color: @beacon-brand;
    }
  }
}
</style>
