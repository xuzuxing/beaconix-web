<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { Copy01Icon } from '@/icons'

/**
 * 探针共享密钥：仅在创建响应里返回一次，关闭后无法再次查看。
 * 复制失败时（非安全上下文）退化为提示用户手动选择。
 */
defineOptions({ name: 'SystemProbeSecretDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ secret: string; probeName?: string }>()
const { t } = useI18n()

const header = computed(() =>
  props.probeName
    ? `${t('adminPage.probe.secretTitle')} · ${props.probeName}`
    : t('adminPage.probe.secretTitle'),
)

async function copy() {
  if (!props.secret) return
  try {
    await navigator.clipboard.writeText(props.secret)
    MessagePlugin.success(t('adminPage.probe.secretCopied'))
  } catch {
    MessagePlugin.warning(t('adminPage.probe.secret'))
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="header"
    width="min(560px, calc(100vw - 32px))"
  >
    <div class="probe-secret">
      <t-alert
        theme="warning"
        :message="t('adminPage.probe.secretDesc')"
      />

      <div class="probe-secret__value">
        <code class="probe-secret__code">{{ secret }}</code>
        <t-button
          variant="outline"
          size="small"
          @click="copy"
        >
          <template #icon><AppIcon :icon="Copy01Icon" /></template>
          {{ t('adminPage.probe.copy') }}
        </t-button>
      </div>
    </div>

    <template #footer>
      <t-button
        theme="primary"
        @click="visible = false"
      >
        {{ t('adminPage.common.close') }}
      </t-button>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.probe-secret {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__value {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  &__code {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    overflow-wrap: anywhere;
    font-family: monospace;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }
}
</style>
