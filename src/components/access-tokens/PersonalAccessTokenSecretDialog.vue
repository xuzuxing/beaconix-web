<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { Copy01Icon } from '@/icons'

/**
 * 令牌「仅展示一次」弹窗：创建成功后展示完整令牌并支持复制。
 * 关闭后无法再次获取，只能重新创建。
 */
defineOptions({ name: 'PersonalAccessTokenSecretDialog' })

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
    MessagePlugin.success(t('workspace.pat.copied'))
  } catch {
    MessagePlugin.warning(t('workspace.pat.copyFailed'))
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.pat.createdTitle')"
    width="min(560px, calc(100vw - 32px))"
    :confirm-btn="t('common.confirm')"
    @confirm="visible = false"
  >
    <t-alert
      theme="warning"
      :message="t('workspace.pat.createdHint')"
      class="pat-secret__hint"
    />

    <div class="pat-secret__value">
      <code class="pat-secret__code">{{ secret }}</code>
      <t-button
        variant="outline"
        size="small"
        @click="copy"
      >
        <template #icon>
          <AppIcon :icon="Copy01Icon" />
        </template>
        {{ copied ? t('workspace.pat.copied') : t('workspace.pat.copy') }}
      </t-button>
    </div>
  </t-dialog>
</template>

<style scoped lang="less">
.pat-secret {
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
