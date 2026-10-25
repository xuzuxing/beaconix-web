<script setup lang="ts">
import { computed } from 'vue'
import { finiteSegments } from '@/utils/monitoring-adapter'

/**
 * 迷你趋势线：纯 SVG 绘制，颜色取 CSS 变量（随主题自动变化）。
 * 供 KPI 卡片等窄小场景使用，不含坐标轴与刻度。
 */
defineOptions({ name: 'MiniTrend' })

const props = withDefaults(
  defineProps<{
    values: (number | null)[]
    /** 语义色：影响线条与面积填充 */
    tone?: 'brand' | 'success' | 'warning' | 'error'
    /** 线条粗细（viewBox 单位） */
    strokeWidth?: number
    /** 是否填充面积 */
    filled?: boolean
  }>(),
  { tone: 'brand', strokeWidth: 2, filled: true },
)

const stroke = computed(() => `var(--mini-trend-color)`)

const finite = computed(() =>
  props.values.filter((v): v is number => v !== null && Number.isFinite(v)),
)
const segments = computed(() =>
  finiteSegments(
    props.values,
    Math.min(...finite.value, 0),
    Math.max(...finite.value, 1),
    88,
  ).map((segment) => segment.map((p) => ({ ...p, y: p.y + 6 }))),
)
const path = (points: Array<{ x: number; y: number }>) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
const linePath = computed(() => segments.value.map(path).join(' '))
const areaPath = computed(() =>
  segments.value
    .map((s) => `${path(s)} L${s[s.length - 1]!.x},100 L${s[0]!.x},100 Z`)
    .join(' '),
)
</script>

<template>
  <div
    class="mini-trend"
    :class="`mini-trend--${tone}`"
  >
    <svg
      v-if="finite.length"
      class="mini-trend__svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend"
    >
      <path
        v-if="filled"
        class="mini-trend__area"
        :d="areaPath"
      />
      <path
        class="mini-trend__line"
        :d="linePath"
        :style="{ stroke: stroke, strokeWidth }"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  </div>
</template>

<style scoped lang="less">
.mini-trend {
  width: 100%;
  height: 100%;

  &--brand {
    --mini-trend-color: var(--td-brand-color);
  }

  &--success {
    --mini-trend-color: var(--td-success-color);
  }

  &--warning {
    --mini-trend-color: var(--td-warning-color);
  }

  &--error {
    --mini-trend-color: var(--td-error-color);
  }

  &__svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  &__area {
    fill: currentColor;
    fill: var(--mini-trend-color);
    opacity: 0.12;
  }

  &__line {
    fill: none;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
}
</style>
