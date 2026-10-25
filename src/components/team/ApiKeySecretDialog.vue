<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { Copy01Icon } from '@/icons'

/**
 * 密钥「仅展示一次」弹窗：创建成功后展示完整密钥并支持复制。
 * 关闭后无法再次获取，只能重新创建。
 */
defineOptions({ name: 'ApiKeySecretDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ secret: string }>()
const { t } = useI18n()

const copied = ref(false)

watch(visible, () => {
  copied.value = false
})

async function copy() {
  try {
    await navigator.clipboard.writeText(props.secret)
    copied.value = true
    MessagePlugin.success(t('workspace.apiKey.copied'))
  } catch {
    MessagePlugin.warning(t('workspace.apiKey.copyFailed'))
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.apiKey.createdTitle')"
    width="min(520px, calc(100vw - 32px))"
    :confirm-btn="t('common.confirm')"
    @confirm="visible = false"
  >
    <t-alert
      theme="warning"
      :message="t('workspace.apiKey.createdHint')"
      class="secret__hint"
    />

    <div class="secret__value">
      <code class="secret__code">{{ secret }}</code>
      <t-button
        variant="outline"
        size="small"
        @click="copy"
      >
        <template #icon>
          <AppIcon :icon="Copy01Icon" />
        </template>
        {{ copied ? t('workspace.apiKey.copied') : t('workspace.apiKey.copy') }}
      </t-button>
    </div>
  </t-dialog>
</template>

<style scoped lang="less">
.secret {
  &__hint {
    margin-bottom: 16px;
  }

  &__value {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }

  &__code {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }
}
</style>
