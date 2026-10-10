<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import { SidebarLeft01Icon, SidebarRight01Icon } from '@/icons'
import { buildMenu } from '@/router/menu'
import { layoutChildren } from '@/router/routes'
import { useAppStore } from '@/stores'

import MenuContent from './MenuContent.vue'

defineOptions({ name: 'SideNav' })

const route = useRoute()
const appStore = useAppStore()
const { t } = useI18n()

const collapsed = computed(() => appStore.collapsed)
const collapseLabel = computed(() => t(collapsed.value ? 'layout.expand' : 'layout.collapse'))
/** 菜单由主布局的路由表生成，见 src/router/menu.ts */
const menu = buildMenu(layoutChildren)

/** 已展开的父级菜单，用于刷新后保持当前路由所在层级展开 */
const expanded = ref<string[]>([])

watch(
  () => route.path,
  (path) => {
    const segments = path.split('/').filter(Boolean)
    const parents = segments
      .slice(0, -1)
      .map((_, index, arr) => `/${arr.slice(0, index + 1).join('/')}`)
    expanded.value = Array.from(new Set([...expanded.value, ...parents]))
  },
  { immediate: true },
)

// 窄屏自动折叠侧边栏
const isNarrow = useMediaQuery('(max-width: 991px)')
watch(
  isNarrow,
  (value) => {
    if (value) {
      appStore.setCollapsed(true)
    }
  },
  { immediate: true },
)

function handleExpand(value: (string | number)[]) {
  expanded.value = value.map(String)
}
</script>

<template>
  <aside class="side-nav" :class="{ 'side-nav--collapsed': collapsed }">
    <t-menu
      class="side-nav__menu"
      theme="light"
      :value="route.path"
      :collapsed="collapsed"
      :width="['190px', '48px']"
      :expanded="expanded"
      :expand-mutex="true"
      @expand="handleExpand"
    >
      <MenuContent :items="menu" />
    </t-menu>

    <!-- 折叠按钮固定在侧边栏左下角 -->
    <div class="side-nav__footer">
      <t-tooltip :content="collapseLabel" placement="right">
        <button
          type="button"
          class="side-nav__collapse"
          :aria-label="collapseLabel"
          @click="appStore.toggleCollapsed()"
        >
          <AppIcon :icon="collapsed ? SidebarRight01Icon : SidebarLeft01Icon" />
        </button>
      </t-tooltip>
    </div>
  </aside>
</template>

<style scoped lang="less">
.side-nav {
  display: flex;
  flex: none;
  flex-direction: column;
  width: @beacon-sider-width;
  height: 100%;
  overflow: hidden;
  background-color: @beacon-bg-container;
  border-right: 1px solid @beacon-sider-border;
  transition: width 0.2s ease;

  &--collapsed {
    width: @beacon-sider-collapsed-width;

    .side-nav__footer {
      justify-content: center;
      padding-inline: 0;
    }
  }

  // 菜单容器即 TDesign 的根 ul：四周 8px（对齐参考的顶部 8px + 左右 8px）
  &__menu {
    flex: 1;
    min-height: 0;
    height: auto;
    padding: 8px !important;
    overflow-y: auto;
    border-right: 0;
    background-color: @beacon-bg-container;
  }

  // TDesign 内层 ul 自带 16px 8px 内边距，清掉，缩进统一由外层容器的 8px 决定
  :deep(ul.t-menu) {
    padding: 0 !important;
  }

  // 菜单项尺寸对齐参考：32px 高、上下 4px 间距、内边距 8px 6px 8px 8px、13px/20px
  :deep(.t-menu__item),
  :deep(.t-submenu__title) {
    height: 32px !important;
    min-height: 32px;
    margin: 4px 0 !important;
    padding: 8px 6px 8px 8px !important;
    font-size: @beacon-font-size-menu;
    line-height: 20px;
    color: @beacon-text-primary;
    border-radius: @beacon-radius;
  }

  :deep(.t-menu__item:not(.t-is-active):hover),
  :deep(.t-submenu__title:hover) {
    background-color: @beacon-bg-hover;
  }

  // 选中项：浅灰底 + 品牌色文字与图标
  :deep(.t-menu__item.t-is-active),
  :deep(.t-menu__item--active) {
    font-weight: 400;
    color: @beacon-brand;
    background-color: @beacon-bg-active;
  }

  // 图标与文字的间距（参考为 12px）
  :deep(.t-menu__item .app-icon),
  :deep(.t-submenu__title .app-icon) {
    margin-right: 12px;
  }

  :deep(.t-menu__sub) {
    padding: 0;
  }

  // 折叠态：图标居中、去掉右侧间距
  :deep(.t-is-collapsed) {
    .t-menu__item,
    .t-submenu__title {
      justify-content: center !important;
      margin: 4px 0 !important;
      padding: 0 !important;
    }

    .app-icon {
      margin-right: 0;
    }
  }

  &__footer {
    display: flex;
    flex: none;
    align-items: center;
    padding: 8px;
    border-top: 1px solid @beacon-border;
  }

  &__collapse {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
  }
}
</style>
