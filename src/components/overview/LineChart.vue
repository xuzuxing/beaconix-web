<script setup lang="ts">
import { computed } from 'vue'
import { finiteSegments } from '@/utils/monitoring-adapter'
import { useI18n } from 'vue-i18n'

/** 轻量折线图：纯 SVG 绘制，按百分比坐标自适应容器宽度 */
defineOptions({ name: 'LineChart' })

const props = withDefaults(
  defineProps<{
    /** 折线数据点 */
    values: (number | null)[]
    /** X 轴标签 */
    labels: string[]
    /** Y 轴刻度数量（含基线） */
    tickCount?: number
    /** 以数据最小值附近的整刻度为基线，用于可用率这类高位窄幅波动的指标 */
    autoScale?: boolean
  }>(),
  { tickCount: 6, autoScale: false },
)

/** 刻度档位：把 Y 轴上限抬到其中一个档位，避免出现 192.8 这类刻度 */
const NICE_STEPS = [1, 1.2, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10]
const { t } = useI18n()
const finite = computed(() => props.values.filter((v): v is number => v !== null && Number.isFinite(v)))

function niceCeil(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = NICE_STEPS.find((item) => item >= normalized) ?? 10
  return Number((step * magnitude).toFixed(6))
}

/** 整齐的步长（1 / 2 / 2.5 / 5 / 10 × 10ⁿ），用于自适应基线 */
function niceStep(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = [1, 2, 2.5, 5, 10].find((item) => item >= normalized) ?? 10
  return step * magnitude
}

const max = computed(() => niceCeil(Math.max(...finite.value, 1)))

/** 基线：默认从 0 起；autoScale 时下移到数据附近，放大波动 */
const min = computed(() => {
  if (!props.autoScale) {
    return 0
  }
  const span = Math.max(max.value - (finite.value.length ? Math.min(...finite.value) : 0), 1e-6)
  const step = niceStep(span / (props.tickCount - 1))
  return Number((max.value - step * (props.tickCount - 1)).toFixed(6))
})

/** 从上限递减到基线的刻度，y 为百分比位置 */
const ticks = computed(() =>
  Array.from({ length: props.tickCount }, (_, index) => {
    const ratio = index / (props.tickCount - 1)
    return {
      y: ratio * 100,
      value: max.value - (max.value - min.value) * ratio,
    }
  }),
)

/** Keep full date/offset labels in tooltips while limiting compact axis ticks. */
const labelStep = computed(() => Math.max(1, Math.ceil(props.labels.length / 4)))
const multipleDates = computed(() => new Set(props.labels.map(label => label.slice(0, 5))).size > 1)
const axisLabel = (label: string) => multipleDates.value ? label.slice(0, 5) : label.slice(6, 11)

function isLabelVisible(index: number) {
  return index % labelStep.value === 0
}

const linePath = computed(() => {
  return finiteSegments(props.values, min.value, max.value).map(segment =>
    segment.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')).join(' ')
})

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
</script>

<template>
  <t-empty v-if="!finite.length" :description="t('dashboard.live.empty')" />
  <div v-else class="line-chart">
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
        <span
          v-for="(label, index) in labels"
          :key="`${label}-${index}`"
          v-show="isLabelVisible(index)"
          :title="label"
          :style="{ left: `${labels.length > 1 ? 100 * index / (labels.length - 1) : 50}%` }"
        >
          {{ axisLabel(label) }}
        </span>
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
    position: relative;
    flex: none;
    height: 16px;
    padding-top: 4px;
    font-size: 10px;
    line-height: 12px;
    color: @beacon-text-tertiary;
    span { position: absolute; white-space: nowrap; transform: translateX(-50%); }
    span:first-child { transform: none; }
  }

  // 抽稀时保留占位，标签才继续与数据点对齐
  &__label--hidden {
    visibility: hidden;
  }
}
</style>
