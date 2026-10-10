<script setup lang="ts">
import { computed } from 'vue'

/** 轻量折线图：纯 SVG 绘制，按百分比坐标自适应容器宽度 */
defineOptions({ name: 'LineChart' })

const props = withDefaults(
  defineProps<{
    /** 折线数据点 */
    values: number[]
    /** X 轴标签 */
    labels: string[]
    /** Y 轴刻度数量（含 0） */
    tickCount?: number
  }>(),
  { tickCount: 6 },
)

const max = computed(() => Math.max(...props.values, 1))

/** 从最大值递减到 0 的刻度，y 为百分比位置 */
const ticks = computed(() =>
  Array.from({ length: props.tickCount }, (_, index) => ({
    y: (index * 100) / (props.tickCount - 1),
    value: max.value * (1 - index / (props.tickCount - 1)),
  })),
)

const linePath = computed(() => {
  const step = props.values.length > 1 ? 100 / (props.values.length - 1) : 0
  return props.values
    .map((value, index) => {
      const x = index * step
      const y = 100 - (value / max.value) * 100
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
})

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
</script>

<template>
  <div class="line-chart">
    <div class="line-chart__axis-y">
      <span v-for="tick in ticks" :key="tick.y">{{ formatValue(tick.value) }}</span>
    </div>

    <div class="line-chart__main">
      <div class="line-chart__plot">
        <svg class="line-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line
            v-for="tick in ticks"
            :key="tick.y"
            class="line-chart__grid"
            x1="0"
            :y1="tick.y"
            x2="100"
            :y2="tick.y"
          />
          <path class="line-chart__line" :d="linePath" />
        </svg>
      </div>

      <div class="line-chart__axis-x">
        <span v-for="label in labels" :key="label">{{ label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.line-chart {
  display: flex;
  gap: 6px;
  height: 100%;

  &__axis-y {
    display: flex;
    flex: none;
    flex-direction: column;
    justify-content: space-between;
    width: 28px;
    padding-bottom: 16px;
    font-size: 10px;
    line-height: 12px;
    color: @beacon-text-tertiary;
    text-align: right;
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__plot {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  &__svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  &__grid {
    stroke: var(--td-bg-color-secondarycontainer);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  &__line {
    fill: none;
    stroke: @beacon-brand;
    stroke-width: 1.5;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  &__axis-x {
    display: flex;
    flex: none;
    justify-content: space-between;
    height: 16px;
    padding-top: 4px;
    font-size: 10px;
    line-height: 12px;
    color: @beacon-text-tertiary;
  }
}
</style>
