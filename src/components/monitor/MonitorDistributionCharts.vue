<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ChartCard from '@/components/charts/ChartCard.vue'
import EChart from '@/components/charts/EChart.vue'
import { useChartTheme, withAlpha } from '@/components/charts/chartTheme'
import {
  categoryAxis,
  chartBase,
  chartLegend,
  chartTooltip,
  valueAxis,
} from '@/components/charts/chartPresets'
import type { ChartOption } from '@/components/charts/echarts'
import type { Dashboard, Summary } from '@/api/types/monitoring'

/**
 * 分布区：监控协议占比、探针节点延迟、响应时间分布。
 * 三张图回答「监控什么、从哪监控、慢在哪」三个问题。
 */
defineOptions({ name: 'MonitorDistributionCharts' })

const { t } = useI18n()
const theme = useChartTheme()
const props = defineProps<{ summary: Summary; distribution: Dashboard['distribution'] }>()
const monitorSummary = computed(() => ({ total: props.summary.monitors.total, probes: props.summary.probes }))
const monitorTypeDistribution = computed(() => props.distribution.protocols.map(p => ({ nameKey: `dashboard.type.${p.type.toLowerCase()}`, value: p.count })))
const probeNodes = computed(() => props.distribution.probes)
const responseTimeHistogram = computed(() => ({
  labels: props.distribution.latencyHistogram.buckets.map(b => b.to === null ? `>=${b.from}` : `${b.from}-${b.to}`),
  counts: props.distribution.latencyHistogram.buckets.map(b => b.count),
}))

/** 环形图：监控协议占比 */
const typeOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    tooltip: chartTooltip(palette, 'item'),
    legend: {
      ...chartLegend(palette),
      orient: 'vertical',
      right: 0,
      top: 'middle',
      data: monitorTypeDistribution.value.map((item) => t(item.nameKey)),
    },
    series: [
      {
        type: 'pie',
        radius: ['54%', '76%'],
        center: ['34%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderWidth: 2, borderColor: palette.container },
        label: { show: false },
        labelLine: { show: false },
        data: monitorTypeDistribution.value.map((item, index) => ({
          name: t(item.nameKey),
          value: item.value,
          itemStyle: { color: palette.series[index % palette.series.length] },
        })),
      },
    ],
  })
})

/** 横向条形：所选窗口探针检查耗时，离线节点灰显 */
const probeOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { left: 0, right: 44, top: 8, bottom: 0, containLabel: true },
    tooltip: chartTooltip(palette, 'item'),
    xAxis: valueAxis(palette, { name: 'ms' }),
    yAxis: {
      type: 'category',
      inverse: true,
      data: probeNodes.value.map((node) => `${node.name} (${node.region})${node.online ? '' : ` - ${t('dashboard.probe.offline')}`}`),
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textSecondary, fontSize: 10 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 10,
        data: probeNodes.value.map((node) => ({
          value: node.latencyMs,
          itemStyle: {
            color: node.online
              ? withAlpha(palette.brand, 0.85)
              : withAlpha(palette.error, 0.35),
          },
          label: {
            formatter: node.latencyMs === null ? '-' : `${node.latencyMs} ms`,
          },
        })),
        label: {
          show: true,
          position: 'right',
          color: palette.textTertiary,
          fontSize: 10,
        },
      },
    ],
  })
})

/** 直方图：所选窗口检查耗时分布 */
const histogramOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { left: 0, right: 0, top: 24, bottom: 0, containLabel: true },
    tooltip: chartTooltip(palette, 'item'),
    xAxis: categoryAxis(
      palette,
      responseTimeHistogram.value.labels,
      true,
      { hideOverlap: true },
    ),
    yAxis: valueAxis(palette),
    series: [
      {
        type: 'bar',
        barMaxWidth: 26,
        data: responseTimeHistogram.value.counts,
        itemStyle: { color: withAlpha(palette.brand, 0.8) },
        label: {
          show: true,
          position: 'top',
          color: palette.textTertiary,
          fontSize: 10,
        },
      },
    ],
  })
})
</script>

<template>
  <div class="distribution">
    <ChartCard
      :title="t('dashboard.distribution.typeTitle')"
      :tip="t('dashboard.distribution.typeTip')"
      :extra="t('dashboard.distribution.total', { count: monitorSummary.total })"
      height="264px"
    >
      <EChart v-if="distribution.protocols.length" :option="typeOption" />
      <t-empty v-else :description="t('dashboard.live.empty')" />
    </ChartCard>

    <ChartCard
      :title="t('dashboard.distribution.probeTitle')"
      :tip="t('dashboard.distribution.probeTip')"
      :extra="t('dashboard.distribution.probeExtra', {
        online: monitorSummary.probes.online,
        total: monitorSummary.probes.total,
      })"
      height="264px"
    >
      <EChart v-if="distribution.probes.length" :option="probeOption" />
      <t-empty v-else :description="t('dashboard.live.empty')" />
    </ChartCard>

    <ChartCard
      :title="t('dashboard.distribution.histogramTitle')"
      :tip="t('dashboard.distribution.histogramTip')"
      height="264px"
    >
      <EChart v-if="distribution.latencyHistogram.buckets.length" :option="histogramOption" />
      <t-empty v-else :description="t('dashboard.live.empty')" />
    </ChartCard>
  </div>
</template>

<style scoped lang="less">
.distribution {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: @beacon-gap-l;
  @media (max-width: 1000px) { grid-template-columns: minmax(0, 1fr); }
}
</style>
