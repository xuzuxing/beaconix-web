<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ChartCard from '@/components/charts/ChartCard.vue'
import EChart from '@/components/charts/EChart.vue'
import { useChartTheme, withAlpha } from '@/components/charts/chartTheme'
import {
  areaStyle,
  categoryAxis,
  chartBase,
  chartGrid,
  chartLegend,
  chartTooltip,
  valueAxis,
} from '@/components/charts/chartPresets'
import type { ChartOption } from '@/components/charts/echarts'
import type { MonitorTimeline } from '@/utils/monitoring-adapter'

/**
 * 性能趋势区：检查次数与失败数、响应时间分位、可用率。
 * 三张图共用同一份时序数据（props.timeline），切换时间范围时整体刷新。
 */
defineOptions({ name: 'MonitorTrendCharts' })

const props = defineProps<{ timeline: MonitorTimeline }>()

const { t } = useI18n()
const theme = useChartTheme()

const timeAxis = computed(() => {
  const palette = theme.value
  const labels = props.timeline.labels
  const multipleDates = new Set(labels.map(label => label.slice(0, 5))).size > 1
  const axis = categoryAxis(palette, labels)
  return { ...axis, axisLabel: { ...axis.axisLabel,
    showMinLabel: false, showMaxLabel: false,
    formatter: (label: string) => multipleDates ? label.slice(0, 5) : label.slice(6, 11),
  } }
})

/** 检查次数与失败数：折线 + 柱状双轴 */
const checkOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: chartGrid,
    tooltip: chartTooltip(palette),
    legend: chartLegend(palette),
    xAxis: timeAxis.value,
    yAxis: [valueAxis(palette, { name: t('dashboard.trend.axisChecks') }), valueAxis(palette)],
    series: [
      {
        name: t('dashboard.trend.checks'),
        type: 'line',
        smooth: 0.25,
        showSymbol: false,
        data: props.timeline.checks,
        lineStyle: { width: 1.8, color: palette.brand },
        itemStyle: { color: palette.brand },
        areaStyle: areaStyle(palette.brand),
      },
      {
        name: t('dashboard.trend.failures'),
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 10,
        data: props.timeline.failures,
        itemStyle: { color: withAlpha(palette.error, 0.75) },
      },
    ],
  })
})

/** 响应时间分位：P50 / P95 / P99 三条折线 */
const latencyOption = computed<ChartOption>(() => {
  const palette = theme.value
  const series = [
    { key: 'p50', label: 'P50', data: props.timeline.latencyP50, color: palette.brand },
    { key: 'p95', label: 'P95', data: props.timeline.latencyP95, color: palette.warning },
    { key: 'p99', label: 'P99', data: props.timeline.latencyP99, color: palette.error },
  ]

  return chartBase(palette, {
    grid: chartGrid,
    tooltip: chartTooltip(palette),
    legend: chartLegend(palette),
    xAxis: timeAxis.value,
    yAxis: valueAxis(palette, { name: t('dashboard.trend.axisLatency') }),
    series: series.map((item) => ({
      name: item.label,
      type: 'line' as const,
      smooth: 0.25,
      showSymbol: false,
      data: item.data,
      lineStyle: { width: 1.6, color: item.color },
      itemStyle: { color: item.color },
    })),
  })
})

/** 可用率：面积折线 + SLO 阈值参考线 */
const availabilityOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: chartGrid,
    tooltip: chartTooltip(palette),
    xAxis: timeAxis.value,
    yAxis: valueAxis(palette, {
      name: t('dashboard.trend.axisAvailability'),
      min: 0,
      max: 100,
      formatter: '{value}%',
    }),
    series: [
      {
        name: t('dashboard.trend.availability'),
        type: 'line',
        smooth: 0.2,
        showSymbol: false,
        data: props.timeline.availability,
        lineStyle: { width: 1.8, color: palette.success },
        itemStyle: { color: palette.success },
        areaStyle: areaStyle(palette.success),
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            formatter: t('dashboard.trend.slo'),
            color: palette.textTertiary,
            fontSize: 10,
            position: 'insideEndTop' as const,
          },
          lineStyle: { color: withAlpha(palette.error, 0.6), type: 'dashed' as const },
          data: [{ yAxis: 99.9 }],
        },
      },
    ],
  })
})

/** 卡片右上角的峰值提示 */
const peakChecks = computed(() => {
  const values = props.timeline.checks.filter((v): v is number => v !== null)
  return values.length ? Math.max(...values) : '-'
})
</script>

<template>
  <div class="trend">
    <ChartCard
      :title="t('dashboard.trend.checksTitle')"
      :tip="t('dashboard.trend.checksTip')"
      :extra="t('dashboard.trend.peak', { value: peakChecks })"
    >
      <EChart v-if="timeline.checks.some(v => v !== null)" :option="checkOption" />
      <t-empty v-else :description="t('dashboard.live.empty')" />
    </ChartCard>

    <ChartCard :title="t('dashboard.trend.latencyTitle')" :tip="t('dashboard.trend.latencyTip')">
      <EChart v-if="timeline.latencyP50.some(v => v !== null)" :option="latencyOption" />
      <t-empty v-else :description="t('dashboard.live.empty')" />
    </ChartCard>

    <ChartCard
      :title="t('dashboard.trend.availabilityTitle')"
      :tip="t('dashboard.trend.availabilityTip')"
    >
      <EChart v-if="timeline.availability.some(v => v !== null)" :option="availabilityOption" />
      <t-empty v-else :description="t('dashboard.live.empty')" />
    </ChartCard>
  </div>
</template>

<style scoped lang="less">
.trend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: @beacon-gap-l;
  @media (max-width: 1000px) { grid-template-columns: minmax(0, 1fr); }
}
</style>
