<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * RUM 卡片内的加载 / 失败占位：与云监控各页的状态块保持同一形态
 * （居中、最小高度、失败时给出重试按钮）。
 */
defineProps<{ loading: boolean; error: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div
    v-if="error"
    class="rum-state"
    role="alert"
  >
    <t-alert
      theme="error"
      :message="t('rum.loadFailed')"
    />
    <t-button
      variant="outline"
      @click="emit('retry')"
      >{{ t('rum.retry') }}</t-button
    >
  </div>
  <div
    v-else-if="loading"
    class="rum-state"
  >
    <t-loading :text="t('common.loading')" />
  </div>
  <slot v-else />
</template>

<style scoped lang="less">
.rum-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: @beacon-gap-l;
  min-height: 160px;
}
</style>
