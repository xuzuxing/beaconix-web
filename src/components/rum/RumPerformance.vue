<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getRumPerformance,
  getRumPerformancePages,
  getRumPerformanceResources,
  getRumPerformanceSummary,
} from '@/api/modules/rum'
import type { RumPerfRating, RumPerformanceStats } from '@/api/types/rum'
import EChart from '@/components/charts/EChart.vue'
import {
  categoryAxis,
  chartBase,
  chartGrid,
  chartLegend,
  chartTooltip,
  valueAxis,
} from '@/components/charts/chartPresets'
import { useChartTheme } from '@/components/charts/chartTheme'
import type { ChartOption } from '@/components/charts/echarts'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumKpiGrid, { type RumKpi } from './RumKpiGrid.vue'
import RumState from './RumState.vue'

const { t } = useI18n()
const { projectId, appId, canReadRum } = useRumContext()
const theme = useChartTheme()

const range = ref<'24h' | '7d' | '30d'>('24h')
const rangeOptions = computed(() => [
  { value: '24h', label: t('rum.range24h') },
  { value: '7d', label: t('rum.range7d') },
  { value: '30d', label: t('rum.range30d') },
])
const from = computed(() => {
  const days = range.value === '24h' ? 1 : range.value === '7d' ? 7 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
})
const params = computed(() => ({ from: from.value }))

function load<T>(loader: (signal: AbortSignal) => Promise<T>) {
  return (signal: AbortSignal) =>
    canReadRum.value
      ? loader(signal)
      : Promise.reject(new Error('RUM access denied'))
}

const summary = useRumResource(
  load((signal) =>
    getRumPerformanceSummary(projectId.value, appId.value, params.value, {
      signal,
    }),
  ),
  [projectId, appId, canReadRum, range],
)
const series = useRumResource(
  load((signal) =>
    getRumPerformance(
      projectId.value,
      appId.value,
      { ...params.value, metrics: 'LCP,INP,CLS,FCP,TTFB' },
      { signal },
    ),
  ),
  [projectId, appId, canReadRum, range],
)
const pages = useRumResource(
  load((signal) =>
    getRumPerformancePages(
      projectId.value,
      appId.value,
      { ...params.value, limit: 10 },
      { signal },
    ),
  ),
  [projectId, appId, canReadRum, range],
)
const resources = useRumResource(
  load((signal) =>
    getRumPerformanceResources(
      projectId.value,
      appId.value,
      { ...params.value, metric: 'RESOURCE', limit: 10 },
      { signal },
    ),
  ),
  [projectId, appId, canReadRum, range],
)

const ratingTone: Record<RumPerfRating, 'success' | 'warning' | 'error'> = {
  GOOD: 'success',
  NEEDS_IMPROVEMENT: 'warning',
  POOR: 'error',
}
const ratingLabel = (rating: RumPerfRating | null) =>
  rating === 'GOOD'
    ? t('rum.perfGood')
    : rating === 'NEEDS_IMPROVEMENT'
      ? t('rum.perfNeedsImprovement')
      : rating === 'POOR'
        ? t('rum.perfPoor')
        : '—'
const formatValue = (stats: RumPerformanceStats) =>
  stats.p75 === null
    ? '—'
    : stats.metric === 'CLS'
      ? stats.p75.toFixed(3)
      : `${Math.round(stats.p75)} ms`

const kpis = computed<RumKpi[]>(() =>
  (summary.data.value?.metrics ?? []).map((stats) => ({
    key: stats.metric,
    label: `${stats.metric} p75`,
    value: formatValue(stats),
    hint: `${ratingLabel(stats.rating)} · ${stats.count} ${t('rum.perfSamples')}`,
    tone: stats.rating ? ratingTone[stats.rating] : undefined,
  })),
)

const chartOption = computed<ChartOption>(() => {
  const palette = theme.value
  const data = series.data.value
  if (!data) return chartBase(palette, {})
  const labels = [
    ...new Set(
      data.series.flatMap((item) =>
        item.points.map((point) => point.bucketStart),
      ),
    ),
  ].sort()
  return chartBase(palette, {
    grid: chartGrid,
    tooltip: chartTooltip(palette),
    legend: chartLegend(
      palette,
      data.series.map((item) => item.metric),
    ),
    xAxis: categoryAxis(
      palette,
      labels.map((label) => label.slice(5, 16).replace('T', ' ')),
    ),
    yAxis: valueAxis(palette),
    series: data.series.map((item, index) => ({
      name: item.metric,
      type: 'line',
      smooth: 0.25,
      showSymbol: false,
      data: labels.map(
        (label) =>
          item.points.find((point) => point.bucketStart === label)?.p75 ?? null,
      ),
      lineStyle: {
        width: 1.8,
        color: palette.series[index % palette.series.length],
      },
      itemStyle: { color: palette.series[index % palette.series.length] },
    })),
  })
})

const pageColumns = computed(() => [
  { colKey: 'page', title: t('rum.page'), ellipsis: true },
  { colKey: 'samples', title: t('rum.perfSamples'), width: 120 },
  { colKey: 'p75', title: 'p75 (ms)', width: 120 },
  { colKey: 'errors', title: t('rum.errors'), width: 100 },
  { colKey: 'errorRate', title: t('rum.perfErrorRate'), width: 140 },
])
const resourceColumns = computed(() => [
  { colKey: 'dimension', title: t('rum.perfResource'), ellipsis: true },
  { colKey: 'samples', title: t('rum.perfSamples'), width: 120 },
  { colKey: 'p75', title: 'p75 (ms)', width: 120 },
  { colKey: 'failureRate', title: t('rum.perfFailureRate'), width: 140 },
])
</script>

<template>
  <div class="rum-performance">
    <div class="rum-performance__toolbar">
      <t-radio-group
        v-model="range"
        variant="default-filled"
        :options="rangeOptions"
      />
      <t-button
        variant="outline"
        @click="
          () => {
            summary.reload()
            series.reload()
            pages.reload()
            resources.reload()
          }
        "
        >{{ t('rum.refresh') }}</t-button
      >
    </div>

    <RumState
      :loading="summary.loading.value"
      :error="summary.error.value"
      @retry="summary.reload"
    >
      <RumKpiGrid
        v-if="kpis.length"
        :items="kpis"
      />
    </RumState>

    <t-card class="rum-performance__chart">
      <template #title>{{ t('rum.perfTrend') }}</template>
      <RumState
        :loading="series.loading.value"
        :error="series.error.value"
        @retry="series.reload"
      >
        <div class="rum-performance__chart-body">
          <EChart
            :option="chartOption"
            height="280px"
          />
        </div>
      </RumState>
    </t-card>

    <div class="rum-performance__grid">
      <t-card>
        <template #title>{{ t('rum.perfPages') }}</template>
        <RumState
          :loading="pages.loading.value"
          :error="pages.error.value"
          @retry="pages.reload"
        >
          <t-table
            v-if="pages.data.value"
            row-key="page"
            :data="pages.data.value.items"
            :columns="pageColumns"
            :empty="t('rum.empty')"
            hover
          >
            <template #page="{ row }">{{ row.page || '—' }}</template>
            <template #p75="{ row }">{{
              row.p75 === null ? '—' : Math.round(row.p75)
            }}</template>
            <template #errorRate="{ row }">
              {{ row.errorRate === null ? '—' : `${row.errorRate}%` }}
            </template>
          </t-table>
        </RumState>
      </t-card>

      <t-card>
        <template #title>{{ t('rum.perfResources') }}</template>
        <RumState
          :loading="resources.loading.value"
          :error="resources.error.value"
          @retry="resources.reload"
        >
          <t-table
            v-if="resources.data.value"
            row-key="dimension"
            :data="resources.data.value.items"
            :columns="resourceColumns"
            :empty="t('rum.empty')"
            hover
          >
            <template #dimension="{ row }">{{ row.dimension || '—' }}</template>
            <template #p75="{ row }">{{
              row.p75 === null ? '—' : Math.round(row.p75)
            }}</template>
            <template #failureRate="{ row }">
              {{ row.failureRate === null ? '—' : `${row.failureRate}%` }}
            </template>
          </t-table>
        </RumState>
      </t-card>
    </div>
  </div>
</template>

<style scoped lang="less">
.rum-performance {
  display: grid;
  gap: @beacon-gap-l;
  min-width: 0;

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @beacon-gap;
  }

  &__chart {
    min-width: 0;
  }

  &__chart-body {
    min-width: 0;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: @beacon-gap-l;
  }
}
</style>
