<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/** 公开页上额外展示的字段标签（延迟 / 可用率），列表行与模板卡共用 */
const props = defineProps<{ showLatency: boolean; showUptime: boolean }>()
const { t } = useI18n()
const fields = computed(() => [
  ...(props.showUptime ? (['uptime'] as const) : []),
  ...(props.showLatency ? (['latency'] as const) : []),
])
</script>

<template>
  <span class="status-field-tags">
    <t-tag
      v-for="field in fields"
      :key="field"
      theme="primary"
      variant="light"
      size="small"
    >
      {{ t(`statusPage.field.${field}`) }}
    </t-tag>
    <span
      v-if="!fields.length"
      class="status-field-tags__empty"
    >
      {{ t('statusPage.field.statusOnly') }}
    </span>
  </span>
</template>

<style scoped lang="less">
.status-field-tags {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;

  &__empty {
    font-size: 12px;
    color: @beacon-text-tertiary;
  }
}
</style>
