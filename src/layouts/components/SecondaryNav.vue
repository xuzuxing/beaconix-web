<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { buildMenu } from '@/router/menu'
import { layoutChildren } from '@/router/routes'
import { useUserStore } from '@/stores'
import type { MenuItem } from '@/types'

/**
 * 二级菜单：展示当前一级模块的子页面。
 * 只有带子路由的模块才会渲染，宽度与样式对齐参考实现的 180px 侧栏。
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

function renderTitle(item: MenuItem) {
  return item.titleKey ? t(item.titleKey) : item.path
}
</script>

<template>
  <aside
    v-if="current?.submenu"
    class="secondary-nav"
  >
    <div class="secondary-nav__header">
      <h2 class="secondary-nav__title">{{ renderTitle(current) }}</h2>
    </div>

    <nav class="secondary-nav__body">
      <ul class="secondary-nav__list">
        <template
          v-for="item in current.submenu"
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
                'secondary-nav__link--active':
                  (route.meta.activeMenu ?? route.path) === item.path,
              }"
              :to="item.path"
            >
              {{ renderTitle(item) }}
            </router-link>
          </li>
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
