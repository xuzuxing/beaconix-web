<script setup lang="ts">
import { computed } from 'vue'

/**
 * 行内迷你条：用相对长度表达一个数值在同类中的位置。
 * 纯 CSS 实现（列表里每行一个，不引入图表实例），右侧给出实际数值。
 */
defineOptions({ name: 'PublicMonitorMetricBar' })

const props = withDefaults(
  defineProps<{
    /** 相对比例（0-1），超出范围会被收窄 */
    ratio: number
    /** 右侧展示的数值文案 */
    text: string
    tone?: 'brand' | 'success' | 'warning'
  }>(),
  { tone: 'brand' },
)

const width = computed(() => `${Math.round(Math.min(1, Math.max(0, props.ratio)) * 100)}%`)
</script>

<template>
  <span class="metric-bar" :class="`metric-bar--${tone}`">
    <span class="metric-bar__track">
      <span class="metric-bar__fill" :style="{ width }" />
    </span>
    <span class="metric-bar__value">{{ text }}</span>
  </span>
</template>

<style scoped lang="less">
.metric-bar {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &--brand {
    --metric-bar-color: var(--td-brand-color);
  }

  &--success {
    --metric-bar-color: var(--td-success-color);
  }

  &--warning {
    --metric-bar-color: var(--td-warning-color);
  }

  &__track {
    display: block;
    width: 64px;
    height: 6px;
    border-radius: 3px;
    background: @beacon-bg-page;
    overflow: hidden;
  }

  &__fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--metric-bar-color);
  }

  &__value {
    font-variant-numeric: tabular-nums;
    color: @beacon-text-primary;
  }
}
</style>
