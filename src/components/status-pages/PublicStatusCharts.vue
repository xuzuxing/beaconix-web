<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MonitorStatus } from '@/api/types'
import type {
  PublicStatusPage,
  PublicStatusPageMonitor,
} from '@/api/types/status-page'
import ChartCard from '@/components/charts/ChartCard.vue'
import EChart from '@/components/charts/EChart.vue'
import {
  chartBase,
  chartGrid,
  chartLegend,
  chartTooltip,
  categoryAxis,
  valueAxis,
} from '@/components/charts/chartPresets'
import { useChartTheme, type ChartTheme } from '@/components/charts/chartTheme'
import type { ChartOption } from '@/components/charts/echarts'
import {
  formatLatency,
  formatUptime,
  maxMonitorLatency,
  monitorStatusTone,
  summarizePublicMonitors,
} from '@/utils/status-page-presenter'

/**
 * 公开页顶部的汇总图。
 *
 * 数据全部来自公开接口返回的快照（无时间序列），因此只做分布与横向对比：
 * - 状态分布环形图：各状态的监控项数量
 * - 可用率 / 延迟横向条形对比：仅在页面开启对应展示开关且有数据时出现
 */
defineOptions({ name: 'PublicStatusCharts' })
const props = defineProps<{ page: PublicStatusPage }>()
const { t } = useI18n()
const theme = useChartTheme()

/** 环形图的固定顺序（正常状态在前，未知放最后） */
const STATUS_ORDER: MonitorStatus[] = [
  'UP',
  'DEGRADED',
  'DOWN',
  'PAUSED',
  'UNKNOWN',
]

const statusLabel = (status: MonitorStatus) =>
  t(`workspace.monitor.status.${status}`)

function toneColor(current: ChartTheme, status: MonitorStatus) {
  switch (monitorStatusTone(status)) {
    case 'success':
      return current.success
    case 'warning':
      return current.warning
    case 'danger':
      return current.error
    default:
      return current.textTertiary
  }
}

const distribution = computed(() => {
  const counts = summarizePublicMonitors(props.page.monitors)
  return STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => ({
    status,
    count: counts[status],
  }))
})

const statusOption = computed<ChartOption>(() => {
  const current = theme.value
  return chartBase(current, {
    tooltip: chartTooltip(current, 'item'),
    legend: chartLegend(
      current,
      distribution.value.map((item) => statusLabel(item.status)),
    ),
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        // 图例占住卡片顶部，环心略低一点避免与图例相撞
        center: ['50%', '60%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: current.container, borderWidth: 2 },
        data: distribution.value.map((item) => ({
          name: statusLabel(item.status),
          value: item.count,
          itemStyle: { color: toneColor(current, item.status) },
        })),
      },
    ],
  })
})

const uptimeRows = computed(() =>
  props.page.monitors.filter(
    (monitor) => typeof monitor.uptimePercent === 'number',
  ),
)
const latencyRows = computed(() =>
  props.page.monitors.filter((monitor) => typeof monitor.latency === 'number'),
)
const maxLatency = computed(() => maxMonitorLatency(props.page.monitors))
const averageUptime = computed(() =>
  uptimeRows.value.length
    ? uptimeRows.value.reduce(
        (sum, monitor) => sum + (monitor.uptimePercent ?? 0),
        0,
      ) / uptimeRows.value.length
    : null,
)
const averageLatency = computed(() =>
  latencyRows.value.length
    ? latencyRows.value.reduce(
        (sum, monitor) => sum + (monitor.latency ?? 0),
        0,
      ) / latencyRows.value.length
    : null,
)

/** 监控名过长时截断，避免条形被压扁 */
const truncate = (label: string) =>
  label.length > 18 ? `${label.slice(0, 17)}…` : label

function barsOption(
  rows: PublicStatusPageMonitor[],
  valueOf: (monitor: PublicStatusPageMonitor) => number,
  options: { max?: number; color: string; formatter: string },
): ChartOption {
  const current = theme.value
  const axis = categoryAxis(
    current,
    rows.map((monitor) => monitor.name),
    true,
  )
  return chartBase(current, {
    grid: { ...chartGrid, top: 8, right: 8 },
    tooltip: chartTooltip(current, 'axis'),
    xAxis: valueAxis(current, {
      min: 0,
      max: options.max,
      formatter: options.formatter,
    }),
    yAxis: {
      ...axis,
      axisLabel: { ...axis.axisLabel, margin: 8, formatter: truncate },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 14,
        itemStyle: { color: options.color, borderRadius: [0, 3, 3, 0] },
        data: rows.map(valueOf),
      },
    ],
  })
}

const uptimeOption = computed(() =>
  barsOption(uptimeRows.value, (monitor) => monitor.uptimePercent ?? 0, {
    max: 100,
    color: theme.value.success,
    formatter: '{value}%',
  }),
)
const latencyOption = computed(() =>
  barsOption(latencyRows.value, (monitor) => monitor.latency ?? 0, {
    max: maxLatency.value || undefined,
    color: theme.value.brand,
    formatter: '{value} ms',
  }),
)
</script>

<template>
  <div class="public-charts">
    <ChartCard
      :title="t('statusPage.public.chart.statusTitle')"
      :extra="
        t('statusPage.public.chart.monitorCount', {
          count: page.monitors.length,
        })
      "
    >
      <EChart :option="statusOption" />
    </ChartCard>

    <ChartCard
      v-if="page.showUptime"
      :title="t('statusPage.public.chart.uptimeTitle')"
      :extra="
        t('statusPage.public.chart.average', {
          value: formatUptime(averageUptime) ?? '-',
        })
      "
    >
      <EChart
        v-if="uptimeRows.length"
        :option="uptimeOption"
      />
      <div
        v-else
        class="public-charts__empty"
      >
        {{ t('statusPage.public.chart.empty') }}
      </div>
    </ChartCard>

    <ChartCard
      v-if="page.showLatency"
      :title="t('statusPage.public.chart.latencyTitle')"
      :extra="
        t('statusPage.public.chart.average', {
          value: formatLatency(averageLatency) ?? '-',
        })
      "
    >
      <EChart
        v-if="latencyRows.length"
        :option="latencyOption"
      />
      <div
        v-else
        class="public-charts__empty"
      >
        {{ t('statusPage.public.chart.empty') }}
      </div>
    </ChartCard>
  </div>
</template>

<style scoped lang="less">
.public-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;

  // 与 hero / 监控卡片保持同一套圆角
  :deep(.chart-card) {
    border-radius: 4px;
  }

  &__empty {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}
</style>
