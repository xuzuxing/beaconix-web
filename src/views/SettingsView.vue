<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useOrganizationStore, useUserStore } from '@/stores'

/** 设置：当前账号信息与退出登录（改密码 / 2FA 在后续阶段接入） */
defineOptions({ name: 'SettingsView' })

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const orgStore = useOrganizationStore()

const rows = computed(() => {
  const user = userStore.user
  if (!user) return []
  return [
    { labelKey: 'login.field.name', value: user.name },
    { labelKey: 'login.field.email', value: user.email },
    { labelKey: 'workspace.settings.role', value: user.globalRole },
    {
      labelKey: 'workspace.settings.emailVerified',
      value: user.emailVerified
        ? t('workspace.settings.verified')
        : t('workspace.settings.unverified'),
    },
  ]
})

async function logout() {
  await userStore.logout()
  orgStore.reset()
  MessagePlugin.success(t('layout.userLogoutDone'))
  await router.replace('/login')
}
</script>

<template>
  <div class="settings">
    <div class="settings__panel">
      <h3 class="settings__title">{{ t('workspace.settings.account') }}</h3>

      <div v-for="row in rows" :key="row.labelKey" class="settings__row">
        <span class="settings__label">{{ t(row.labelKey) }}</span>
        <span class="settings__value">{{ row.value }}</span>
      </div>
    </div>

    <div class="settings__panel">
      <h3 class="settings__title">{{ t('workspace.settings.security') }}</h3>
      <p class="settings__hint">{{ t('workspace.settings.securityPending') }}</p>

      <t-button variant="outline" size="small" @click="logout">
        {{ t('layout.userLogout') }}
      </t-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.settings {
  display: flex;
  flex-direction: column;
  gap: @beacon-gap-l;

  &__panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__row {
    display: flex;
    gap: 12px;
    min-height: 24px;
    font-size: @beacon-font-size-base;
    line-height: 24px;
  }

  &__label {
    flex: none;
    width: 96px;
    color: @beacon-text-tertiary;
  }

  &__value {
    min-width: 0;
    color: @beacon-text-primary;
    word-break: break-all;
  }

  &__hint {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
