<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import type { MenuItem } from '@/types'

/** 递归渲染菜单：分隔线、分组子菜单与普通菜单项（含徽标） */
defineOptions({ name: 'MenuContent' })

defineProps<{ items: MenuItem[] }>()

const { t } = useI18n()

function renderTitle(item: MenuItem) {
  return item.titleKey ? t(item.titleKey) : item.path
}

function renderBadgeText(item: MenuItem) {
  const badge = item.badge
  if (!badge) return ''
  return badge.textKey ? t(badge.textKey) : (badge.text ?? '')
}
</script>

<template>
  <template
    v-for="item in items"
    :key="item.path"
  >
    <div
      v-if="item.type === 'divider'"
      class="menu-divider"
    />

    <t-submenu
      v-else-if="item.children?.length"
      :value="item.path"
      :title="renderTitle(item)"
    >
      <template
        v-if="item.icon"
        #icon
      >
        <AppIcon :icon="item.icon" />
      </template>
      <MenuContent :items="item.children" />
    </t-submenu>

    <t-menu-item
      v-else
      :value="item.path"
      :to="item.path"
    >
      <template
        v-if="item.icon"
        #icon
      >
        <AppIcon :icon="item.icon" />
      </template>
      <span class="menu-label">{{ renderTitle(item) }}</span>
      <t-tag
        v-if="item.badge"
        class="menu-badge"
        size="small"
        :theme="item.badge.theme ?? 'default'"
        :variant="item.badge.theme === 'warning' ? 'dark' : 'light'"
      >
        {{ renderBadgeText(item) }}
      </t-tag>
    </t-menu-item>
  </template>
</template>

<style lang="less" scoped>
.menu-divider {
  height: 1px;
  margin: 6px 16px;
  background-color: @beacon-border;
}

.menu-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-badge {
  flex: none;
  height: 16px;
  margin-left: 6px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 16px;
  border-radius: @beacon-radius-m;
}
</style>
