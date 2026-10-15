<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PublicMonitorAvailability } from '@/api/types/status-page'
import ChartCard from '@/components/charts/ChartCard.vue'
import EChart from '@/components/charts/EChart.vue'
import { chartBase, chartTooltip } from '@/components/charts/chartPresets'
import { useChartTheme, withAlpha } from '@/components/charts/chartTheme'
import type { ChartOption } from '@/components/charts/echarts'

/**
 * 单个监控项的逐小时可用率热力图（近 3 天 × 24 小时）。
 *
 * 视觉与概览页的可用率热力图一致（同一套色带、无数据灰格、最低值说明），
 * 但尺寸刻意压得比概览页更小：它挂在监控条目下面，只是补充信息，不该抢主视觉。
 * 数据来自公开接口 `monitors[].availability`；是否展示由调用方按 `showUptime` 决定。
 *
 * `availability.simulated` 为前端演示数据时会在卡片上标注出来，避免被当成真实采集结果。
 */
defineOptions({ name: 'PublicMonitorAvailability' })
const props = defineProps<{ availability: PublicMonitorAvailability }>()
const { t } = useI18n()
const theme = useChartTheme()

/** 后端返回完整日期（YYYY-MM-DD）；卡片上只展示月-日 */
function shortDay(day: string) {
  return day.length > 5 ? day.slice(5) : day
}

/** Y 轴与提示里的日期都用月-日，避免完整日期撑破卡片宽度 */
const dayLabels = computed(() => props.availability.days.map(shortDay))

const unavailable = computed(() => props.availability.unavailableCells ?? [])
const hasCells = computed(
  () => props.availability.cells.length > 0 || unavailable.value.length > 0,
)

/** 右上角：演示数据标注 + 最低可用率位置 */
const extraText = computed(() => {
  const parts: string[] = []
  if (props.availability.simulated) parts.push(t('statusPage.public.heatmap.simulated'))
  const worst = props.availability.worst
  if (worst) {
    parts.push(
      t('statusPage.public.heatmap.worst', {
        day: shortDay(worst.day),
        hour: String(worst.hour).padStart(2, '0'),
        value: worst.value.toFixed(2),
      }),
    )
  }
  return parts.join(' · ')
})

/** 演示数据时在提示里说明来源，真实数据只保留原本的读图说明 */
const tipText = computed(() =>
  props.availability.simulated
    ? `${t('statusPage.public.heatmap.tip')} ${t('statusPage.public.heatmap.simulatedHint')}`
    : t('statusPage.public.heatmap.tip'),
)

const option = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { left: 0, right: 0, top: 4, bottom: 0, containLabel: true },
    tooltip: {
      ...chartTooltip(palette, 'item'),
      formatter: (params: unknown) => {
        const { value } = params as { value: [number, number, number] }
        const day = dayLabels.value[value[1]] ?? ''
        const hour = String(value[0]).padStart(2, '0')
        return `${day} ${hour}:00 &nbsp; <b>${value[2].toFixed(2)}%</b>`
      },
    },
    xAxis: {
      type: 'category',
      data: props.availability.hours.map((hour) => String(hour).padStart(2, '0')),
      splitArea: { show: false },
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      // 卡片矮、列又密，每 4 小时给一个刻度就够
      axisLabel: { color: palette.textTertiary, fontSize: 10, interval: 3 },
    },
    yAxis: {
      type: 'category',
      data: dayLabels.value,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textTertiary, fontSize: 10, interval: 0 },
    },
    visualMap: {
      min: 0,
      max: 100,
      show: false,
      inRange: {
        color: [
          withAlpha(palette.error, 0.9),
          withAlpha(palette.warning, 0.75),
          withAlpha(palette.success, 0.35),
          palette.success,
        ],
      },
    },
    series: [
      {
        type: 'heatmap',
        data: props.availability.cells,
        itemStyle: { borderWidth: 1, borderColor: palette.container },
        emphasis: { itemStyle: { borderColor: palette.brand, borderWidth: 1 } },
      },
      {
        type: 'heatmap',
        data: unavailable.value.map(([x, y]) => ({
          value: [x, y, 0],
          itemStyle: { color: palette.axisLine },
        })),
        tooltip: { formatter: () => t('statusPage.public.heatmap.noData') },
        itemStyle: { borderWidth: 1, borderColor: palette.container },
      },
    ],
  })
})
</script>

<template>
  <ChartCard
    class="public-heatmap"
    :title="t('statusPage.public.heatmap.title', { days: availability.days.length })"
    :tip="tipText"
    :extra="extraText"
    height="150px"
  >
    <EChart v-if="hasCells" :option="option" />
    <div v-else class="public-heatmap__empty">
      {{ t('statusPage.public.heatmap.empty') }}
    </div>
  </ChartCard>
</template>

<style scoped lang="less">
.public-heatmap {
  // 比 ChartCard 默认紧凑：标题行贴近图表，把高度让给热力格
  :deep(.chart-card__head) {
    margin-bottom: 8px;
  }
}

.public-heatmap__empty {
  display: grid;
  place-items: center;
  height: 100%;
  font-size: @beacon-font-size-base;
  color: @beacon-text-tertiary;
}
</style>
