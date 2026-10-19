<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ChartCard from '@/components/charts/ChartCard.vue'
import EChart from '@/components/charts/EChart.vue'
import { useChartTheme, withAlpha } from '@/components/charts/chartTheme'
import {
  categoryAxis,
  chartBase,
  chartTooltip,
  chartLegend,
  valueAxis,
} from '@/components/charts/chartPresets'
import type { ChartOption } from '@/components/charts/echarts'
import type { Availability, StatusCodes } from '@/api/types/monitoring'
import { timeLabel } from '@/utils/monitoring-adapter'

/**
 * 可用性区：近 30 天逐小时可用率热力图 + 最近 12 小时状态码分布。
 * 热力图的色带从「故障红」过渡到「正常绿」，一眼能看出问题窗口。
 */
defineOptions({ name: 'MonitorAvailabilityPanel' })

const { t } = useI18n()
const theme = useChartTheme()

const props = defineProps<{ heatmap: Availability; codes: StatusCodes }>()
const statusCodes = computed(() => ({
  labels: props.codes.buckets.map((b) => timeLabel(b.time)),
  success: props.codes.buckets.map((b) => b.success2xx),
  redirect: props.codes.buckets.map((b) => b.redirect3xx),
  clientError: props.codes.buckets.map((b) => b.clientError4xx),
  serverError: props.codes.buckets.map((b) => b.serverError5xx),
}))

const heatmapOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { left: 0, right: 0, top: 8, bottom: 0, containLabel: true },
    tooltip: {
      ...chartTooltip(palette, 'item'),
      formatter: (params: unknown) => {
        const { value } = params as { value: [number, number, number] }
        const day = props.heatmap.days[value[1]] ?? ''
        const hour = String(value[0]).padStart(2, '0')
        return `${day} ${hour}:00 &nbsp; <b>${value[2].toFixed(2)}%</b>`
      },
    },
    xAxis: {
      type: 'category',
      data: props.heatmap.hours.map((hour) => String(hour).padStart(2, '0')),
      splitArea: { show: false },
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textTertiary, fontSize: 10, interval: 1 },
    },
    yAxis: {
      type: 'category',
      data: props.heatmap.days,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textTertiary, fontSize: 10, interval: 2 },
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
        data: props.heatmap.cells,
        itemStyle: { borderWidth: 1, borderColor: palette.container },
        emphasis: { itemStyle: { borderColor: palette.brand, borderWidth: 1 } },
      },
      {
        type: 'heatmap',
        data: props.heatmap.unavailableCells.map(([x, y]) => ({
          value: [x, y, 0],
          itemStyle: { color: palette.axisLine },
        })),
        tooltip: { formatter: () => t('dashboard.live.truncated') },
        itemStyle: { borderWidth: 1, borderColor: palette.container },
      },
    ],
  })
})

/** 状态码分布：按小时堆叠，错误部分即使很小也能看到 */
const statusOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { left: 0, right: 0, top: 34, bottom: 0, containLabel: true },
    tooltip: chartTooltip(palette),
    legend: chartLegend(palette),
    xAxis: categoryAxis(palette, statusCodes.value.labels, true),
    yAxis: valueAxis(palette),
    series: [
      {
        name: t('dashboard.statusCode.success'),
        type: 'bar',
        stack: 'total',
        barMaxWidth: 18,
        data: statusCodes.value.success,
        itemStyle: { color: withAlpha(palette.success, 0.85) },
      },
      {
        name: t('dashboard.statusCode.redirect'),
        type: 'bar',
        stack: 'total',
        data: statusCodes.value.redirect,
        itemStyle: {
          color: withAlpha(palette.series[4] ?? palette.brand, 0.9),
        },
      },
      {
        name: t('dashboard.statusCode.clientError'),
        type: 'bar',
        stack: 'total',
        data: statusCodes.value.clientError,
        itemStyle: { color: withAlpha(palette.warning, 0.9) },
      },
      {
        name: t('dashboard.statusCode.serverError'),
        type: 'bar',
        stack: 'total',
        data: statusCodes.value.serverError,
        itemStyle: { color: withAlpha(palette.error, 0.9) },
      },
      {
        name: t('dashboard.live.otherStatus'),
        type: 'bar',
        stack: 'total',
        data: props.codes.buckets.map((b) => b.otherStatusCode),
        itemStyle: { color: palette.textSecondary },
      },
      {
        name: t('dashboard.live.noStatus'),
        type: 'bar',
        stack: 'total',
        data: props.codes.buckets.map((b) => b.noStatusCode),
        itemStyle: { color: palette.textTertiary },
      },
    ],
  })
})
</script>

<template>
  <div class="availability">
    <ChartCard
      :title="t('dashboard.heatmap.title')"
      :tip="t('dashboard.heatmap.tip')"
      :extra="
        heatmap.worst
          ? t('dashboard.heatmap.worst', {
              day: heatmap.worst.day,
              hour: String(heatmap.worst.hour).padStart(2, '0'),
              value: heatmap.worst.value.toFixed(2),
            })
          : ''
      "
      height="300px"
    >
      <EChart
        v-if="heatmap.cells.length || heatmap.unavailableCells.length"
        :option="heatmapOption"
      />
      <t-empty
        v-else
        :description="t('dashboard.live.empty')"
      />
    </ChartCard>

    <ChartCard
      :title="t('dashboard.statusCode.title')"
      :tip="t('dashboard.statusCode.tip')"
      :extra="
        codes.unclassifiedChecks
          ? t('dashboard.live.unclassified', {
              count: codes.unclassifiedChecks,
            })
          : ''
      "
      height="300px"
    >
      <EChart
        v-if="codes.buckets.length"
        :option="statusOption"
      />
      <t-empty
        v-else
        :description="t('dashboard.live.empty')"
      />
    </ChartCard>
  </div>
</template>

<style scoped lang="less">
.availability {
  display: grid;
  // 热力图需要更宽的可视区，状态码分布窄一些
  grid-template-columns: 1.6fr 1fr;
  gap: @beacon-gap-l;
  @media (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
