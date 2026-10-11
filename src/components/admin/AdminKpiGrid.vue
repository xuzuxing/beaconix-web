<script setup lang="ts">
/**
 * 平台指标的关键数字卡片栅格：主数值 + 可选副标题。
 * 纯展示组件，文案与数值由页面组装（便于复用与单测）。
 */
defineOptions({ name: 'AdminKpiGrid' })

defineProps<{
  items: Array<{ key: string; label: string; value: string; hint?: string }>
}>()
</script>

<template>
  <div class="kpi-grid">
    <article v-for="item in items" :key="item.key" class="kpi">
      <p class="kpi__label">{{ item.label }}</p>
      <p class="kpi__value">{{ item.value }}</p>
      <p class="kpi__hint">{{ item.hint ?? '' }}</p>
    </article>
  </div>
</template>

<style scoped lang="less">
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.kpi {
  padding: 16px;
  background: @beacon-bg-page;
  border: 1px solid @beacon-border;

  &__label {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__value {
    margin: 6px 0 0;
    font-size: 24px;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__hint {
    min-height: @beacon-line-height;
    margin: 4px 0 0;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }
}
</style>
