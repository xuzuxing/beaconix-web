<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { Copy01Icon } from '@/icons'

/**
 * 恢复码「仅展示一次」弹窗：重置恢复码成功后展示新码并支持整组复制。
 */
defineOptions({ name: 'RecoveryCodesDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ codes: string[] }>()
const { t } = useI18n()

async function copyAll() {
  try {
    await navigator.clipboard.writeText(props.codes.join('\n'))
    MessagePlugin.success(t('workspace.security.copied'))
  } catch {
    MessagePlugin.warning(t('workspace.security.copyFailed'))
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.security.recoveryTitle')"
    width="min(520px, calc(100vw - 32px))"
    :confirm-btn="t('workspace.security.savedConfirm')"
    @confirm="visible = false"
  >
    <p class="recovery-codes__intro">
      {{ t('workspace.security.recoveryIntro') }}
    </p>

    <ul class="recovery-codes__list">
      <li
        v-for="code in codes"
        :key="code"
        class="recovery-codes__item"
      >
        <code>{{ code }}</code>
      </li>
    </ul>

    <div class="recovery-codes__actions">
      <t-button
        variant="outline"
        size="small"
        @click="copyAll"
      >
        <template #icon><AppIcon :icon="Copy01Icon" /></template>
        {{ t('workspace.security.copyAll') }}
      </t-button>
    </div>

    <t-alert
      theme="warning"
      :message="t('workspace.security.recoveryOnce')"
      class="recovery-codes__warning"
    />
  </t-dialog>
</template>

<style scoped lang="less">
.recovery-codes {
  &__intro {
    margin: 0 0 16px;
    color: @beacon-text-secondary;
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
    padding: 12px;
    margin: 0 0 12px;
    list-style: none;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }

  &__item code {
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  &__warning {
    margin: 0;
  }
}
</style>
