<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import { userMenuGroups } from '@/config/user'
import { Copy01Icon } from '@/icons'
import { useOrganizationStore, useUserStore } from '@/stores'

/**
 * 个人信息入口：头像 hover 展开面板，展示账号信息（可复制）与 config/user.ts 里配置的菜单分组。
 * 主布局与整页布局（plain）共用同一实现；按钮的内边距与对齐由使用方布局决定。
 * inheritAttrs 关闭后把使用方传入的 class / aria 等属性直接绑到按钮上，
 * 避免落到 t-popup 的包裹节点导致布局样式失效。
 */
defineOptions({ name: 'UserMenu', inheritAttrs: false })

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const orgStore = useOrganizationStore()

const visible = ref(false)
const groups = userMenuGroups
const appVersion = __APP_VERSION__

const displayName = computed(() => userStore.user?.name ?? '')

/** 头像用姓名首字母 */
const avatarText = computed(() => displayName.value.trim().slice(0, 1).toUpperCase())

/** 用户设置过头像时优先显示图片，未设置则回退首字母 */
const avatarImage = computed(() => userStore.user?.avatarUrl || undefined)

interface InfoRow {
  labelKey: string
  value: string
}

const accountRows = computed<InfoRow[]>(() => {
  const user = userStore.user
  if (!user) return []
  return [
    { labelKey: 'layout.userName', value: user.name },
    { labelKey: 'layout.userEmail', value: user.email },
  ]
})

async function handleMenu(key: string) {
  if (key === 'logout') {
    await userStore.logout()
    orgStore.reset()
    MessagePlugin.success(t('layout.userLogoutDone'))
    await router.replace('/login')
    return
  }

  // 其余入口按 config/user.ts 里配置的路由跳转（没有 path 的表示暂未接入）
  const target = groups.flat().find((item) => item.key === key)
  if (target?.path) {
    visible.value = false
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
</script>

<template>
  <t-popup
    v-model:visible="visible"
    trigger="hover"
    placement="bottom-right"
    :show-arrow="false"
    overlay-class-name="user-menu-popup"
  >
    <button
      type="button"
      class="user-menu__trigger"
      :aria-label="t('layout.profile')"
      v-bind="$attrs"
    >
      <t-avatar size="32px" :image="avatarImage">{{ avatarText }}</t-avatar>
    </button>

    <template #content>
      <div class="user-panel">
        <div class="user-panel__profile">
          <t-avatar size="40px" :image="avatarImage">{{ avatarText }}</t-avatar>
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

        <div v-for="(group, index) in groups" :key="index" class="user-panel__group">
          <button
            v-for="item in group"
            :key="item.key"
            type="button"
            class="user-panel__item"
            :class="{ 'user-panel__item--danger': item.danger }"
            @click="handleMenu(item.key)"
          >
            <AppIcon :icon="item.icon" :size="16" />
            {{ t(item.labelKey) }}
          </button>
        </div>

        <div class="user-panel__version">{{ t('layout.userVersion') }}：{{ appVersion }}</div>
      </div>
    </template>
  </t-popup>
</template>

<style lang="less">
/* 面板 teleport 到 body，故用非 scoped 样式，用 overlayClassName 限定作用域 */
.user-menu-popup {
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
</style>

<style scoped lang="less">
/* 只做按钮重置：内边距与对齐由使用方布局决定 */
.user-menu__trigger {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: @beacon-header-height;
  cursor: pointer;
  background-color: transparent;
  border: 0;
}
</style>
