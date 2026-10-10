<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/** 安全：登录密码与两步验证（接口接入前先给出说明与入口） */
defineOptions({ name: 'SecurityView' })

const { t } = useI18n()

const panels = computed(() => [
  {
    key: 'password',
    titleKey: 'workspace.security.password',
    hintKey: 'workspace.security.passwordHint',
    actionKey: 'workspace.security.passwordAction',
  },
  {
    key: 'twoFactor',
    titleKey: 'workspace.security.twoFactor',
    hintKey: 'workspace.security.twoFactorHint',
    actionKey: 'workspace.security.twoFactorAction',
  },
])
</script>

<template>
  <div class="security">
    <div v-for="panel in panels" :key="panel.key" class="security__panel">
      <div class="security__head">
        <h3 class="security__title">{{ t(panel.titleKey) }}</h3>
        <t-tag variant="light" size="small">{{ t('workspace.security.pending') }}</t-tag>
      </div>

      <p class="security__hint">{{ t(panel.hintKey) }}</p>

      <div>
        <t-button variant="outline" size="small" disabled>
          {{ t(panel.actionKey) }}
        </t-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.security {
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

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__hint {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
