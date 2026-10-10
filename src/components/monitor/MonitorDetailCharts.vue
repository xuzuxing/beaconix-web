<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorInsights } from '@/api/types/monitor-detail'
import EChart from '@/components/charts/EChart.vue'
import {
  chartBase,
  chartGrid,
  chartTooltip,
  chartLegend,
  categoryAxis,
  valueAxis,
} from '@/components/charts/chartPresets'
import { useChartTheme } from '@/components/charts/chartTheme'
import type { ChartOption } from '@/components/charts/echarts'
import { timeLabel } from '@/utils/monitoring-adapter'

const props = defineProps<{ insights: MonitorInsights }>()
const { t } = useI18n()
const theme = useChartTheme()
const labels = computed(() => props.insights.timeline.points.map((p) => timeLabel(p.time)))
const timeAxis = computed(() => {
  const axis = categoryAxis(theme.value, labels.value)
  return {
    ...axis,
    axisLabel: {
      ...axis.axisLabel,
      showMinLabel: false,
      showMaxLabel: false,
      formatter: (label: string) =>
        props.insights.range === '1h' || props.insights.range === '24h'
          ? label.slice(6, 11)
          : label.slice(0, 5),
    },
  }
})
const latency = computed<ChartOption>(() => {
  const p = theme.value
  return chartBase(p, {
    grid: chartGrid,
    tooltip: chartTooltip(p),
    legend: chartLegend(p),
    xAxis: timeAxis.value,
    yAxis: valueAxis(p, { name: 'ms' }),
    series: [
      { name: 'P50', field: 'latencyP50Ms' as const, color: p.brand },
      { name: 'P95', field: 'latencyP95Ms' as const, color: p.warning },
      { name: 'P99', field: 'latencyP99Ms' as const, color: p.error },
    ].map((s) => ({
      name: s.name,
      type: 'line',
      connectNulls: false,
      symbolSize: 4,
      data: props.insights.timeline.points.map((point) => point[s.field]),
      lineStyle: { width: 1.6, color: s.color },
      itemStyle: { color: s.color },
    })),
  })
})
const uptime = computed<ChartOption>(() => {
  const p = theme.value
  return chartBase(p, {
    grid: chartGrid,
    tooltip: chartTooltip(p),
    xAxis: timeAxis.value,
    yAxis: valueAxis(p, { min: 0, max: 100, formatter: '{value}%' }),
    series: [
      {
        name: t('monitorPage.uptime'),
        type: 'line',
        connectNulls: false,
        symbolSize: 4,
        data: props.insights.timeline.points.map((point) => point.uptimePercent),
        lineStyle: { width: 1.8, color: p.success },
        itemStyle: { color: p.success },
      },
    ],
  })
})
</script>

<template>
  <div class="detail-charts">
    <section>
      <h2>{{ t('monitorPage.latencyTrend') }}</h2>
      <EChart
        v-if="insights.timeline.points.some((p) => p.latencyP50Ms !== null)"
        :option="latency"
        height="240px"
      />
      <div v-else class="detail-charts__empty">{{ t('monitorPage.emptyMetrics') }}</div>
    </section>
    <section>
      <h2>{{ t('monitorPage.uptimeTrend') }}</h2>
      <EChart
        v-if="insights.timeline.points.some((p) => p.uptimePercent !== null)"
        :option="uptime"
        height="240px"
      />
      <div v-else class="detail-charts__empty">{{ t('monitorPage.emptyMetrics') }}</div>
    </section>
  </div>
</template>

<style scoped lang="less">
.detail-charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  // 外层卡片已提供白底、边框与内边距
  section {
    min-width: 0;
  }
  h2 {
    font-size: 14px;
    margin: 0 0 16px;
    font-weight: 600;
  }
  &__empty {
    display: grid;
    place-items: center;
    height: 240px;
    color: @beacon-text-tertiary;
  }
}
@media (max-width: 1000px) {
  .detail-charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
