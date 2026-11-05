<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { getRumAppOverview } from '@/api/modules/rum'
import type { RumAppOverview } from '@/api/types/rum'
import ChartCard from '@/components/charts/ChartCard.vue'
import EChart from '@/components/charts/EChart.vue'
import { useChartTheme } from '@/components/charts/chartTheme'
import {
  areaStyle,
  chartBase,
  chartGrid,
  chartLegend,
  chartTooltip,
  categoryAxis,
  valueAxis,
} from '@/components/charts/chartPresets'
import type { ChartOption } from '@/components/charts/echarts'
import { RUM_RANGES, rumRangeWindow, type RumRange } from '@/config/rum-ranges'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumState from './RumState.vue'

/**
 * 应用概览：一屏回答「有多少人来、接口是否健康、错误量级如何」。
 * 数据来自 getRumAppOverview 的单次聚合：PV/UV/点击来自 SDK 自动上报的
 * `$pageview` / `$click`，请求指标来自 HTTP 性能样本；比率没有数据时为 null，不编造数值。
 */
const ranges = RUM_RANGES

const { t } = useI18n()
const { projectId: p, appId: a } = useRumContext()
const theme = useChartTheme()
const range = ref<RumRange>('24h')

const resource = useRumResource(
  (signal) =>
    getRumAppOverview(p.value, a.value, rumRangeWindow(range.value), { signal }),
  [p, a, range],
)

const data = computed<RumAppOverview | null>(() => resource.data.value)
const series = computed(() => data.value?.series ?? [])
const labels = computed(() => {
  const format = range.value === '7d' || range.value === '30d' ? 'MM-DD' : 'HH:mm'
  return series.value.map((point) => dayjs(point.bucketStart).format(format))
})

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}
function formatRate(value: number | null) {
  return value === null ? '—' : `${value}%`
}
function formatMs(value: number | null) {
  return value === null ? '—' : `${formatNumber(value)} ms`
}

/** 三组指标，顺序与排查路径一致：多少人 → 接口健不健康 → 错在哪 */
const groups = computed(() => {
  const overview = data.value
  if (!overview) return []
  return [
    {
      key: 'traffic',
      title: t('rum.trafficGroup'),
      items: [
        { key: 'pv', label: t('rum.pv'), value: formatNumber(overview.traffic.pv) },
        { key: 'uv', label: t('rum.uv'), value: formatNumber(overview.traffic.uv) },
        { key: 'clicks', label: t('rum.clicks'), value: formatNumber(overview.traffic.clicks) },
      ],
    },
    {
      key: 'requests',
      title: t('rum.requestGroup'),
      items: [
        {
          key: 'total',
          label: t('rum.requestVolume'),
          value: formatNumber(overview.requests.total),
        },
        {
          key: 'successRate',
          label: t('rum.requestSuccessRate'),
          value: formatRate(overview.requests.successRate),
        },
        {
          key: 'errorRate',
          label: t('rum.requestErrorRate'),
          value: formatRate(overview.requests.errorRate),
        },
        {
          key: 'failures',
          label: t('rum.requestFailures'),
          value: formatNumber(overview.requests.failures),
        },
        {
          key: 'p75',
          label: t('rum.requestLatency'),
          value: formatMs(overview.requests.p75),
        },
      ],
    },
    {
      key: 'errors',
      title: t('rum.errorEventGroup'),
      items: [
        { key: 'js', label: t('rum.jsErrorVolume'), value: formatNumber(overview.errors.js) },
        {
          key: 'jsRate',
          label: t('rum.jsErrorRate'),
          value: formatRate(overview.errors.jsRate),
        },
        {
          key: 'custom',
          label: t('rum.customErrorVolume'),
          value: formatNumber(overview.errors.custom),
        },
        {
          key: 'events',
          label: t('rum.eventVolume'),
          value: formatNumber(overview.errors.events),
        },
      ],
    },
  ]
})

const trafficOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { ...chartGrid, top: 40 },
    tooltip: chartTooltip(palette),
    legend: chartLegend(palette),
    xAxis: categoryAxis(palette, labels.value, true),
    yAxis: valueAxis(palette),
    series: [
      {
        name: t('rum.pv'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.value.map((point) => point.pv),
        lineStyle: { width: 1.8, color: palette.brand },
        itemStyle: { color: palette.brand },
        areaStyle: areaStyle(palette.brand),
      },
      {
        name: t('rum.uv'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.value.map((point) => point.uv),
        lineStyle: { width: 1.8, color: palette.success },
        itemStyle: { color: palette.success },
      },
      {
        name: t('rum.clicks'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.value.map((point) => point.clicks),
        lineStyle: { width: 1.8, color: palette.warning },
        itemStyle: { color: palette.warning },
      },
    ],
  })
})

const requestOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { ...chartGrid, top: 40 },
    tooltip: chartTooltip(palette),
    legend: chartLegend(palette),
    xAxis: categoryAxis(palette, labels.value, true),
    yAxis: [valueAxis(palette), valueAxis(palette, { formatter: '{value}%', max: 100 })],
    series: [
      {
        name: t('rum.requestVolume'),
        type: 'bar',
        stack: 'requests',
        barMaxWidth: 18,
        data: series.value.map((point) => point.requests),
        itemStyle: { color: palette.brand },
      },
      {
        name: t('rum.requestFailures'),
        type: 'bar',
        stack: 'requests',
        barMaxWidth: 18,
        data: series.value.map((point) => point.failures),
        itemStyle: { color: palette.error },
      },
      {
        name: t('rum.requestSuccessRate'),
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        // 没有请求的桶留空，避免把「无数据」画成 0%
        data: series.value.map((point) =>
          point.requests
            ? Math.round(((point.requests - point.failures) / point.requests) * 10_000) / 100
            : null,
        ),
        lineStyle: { width: 1.8, color: palette.success },
        itemStyle: { color: palette.success },
      },
    ],
  })
})

const errorOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { ...chartGrid, top: 40 },
    tooltip: chartTooltip(palette),
    legend: chartLegend(palette),
    xAxis: categoryAxis(palette, labels.value, true),
    yAxis: [valueAxis(palette), valueAxis(palette)],
    series: [
      {
        name: t('rum.jsErrorVolume'),
        type: 'bar',
        stack: 'errors',
        barMaxWidth: 18,
        data: series.value.map((point) => point.jsErrors),
        itemStyle: { color: palette.error },
      },
      {
        name: t('rum.customErrorVolume'),
        type: 'bar',
        stack: 'errors',
        barMaxWidth: 18,
        data: series.value.map((point) => point.customErrors),
        itemStyle: { color: palette.warning },
      },
      {
        name: t('rum.eventVolume'),
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 18,
        data: series.value.map((point) => point.events),
        itemStyle: { color: palette.brand },
      },
    ],
  })
})

const rangeLabel = computed(() => t(`rum.range${range.value}`))
</script>

<template>
  <div class="rum-overview">
    <header class="rum-overview__toolbar">
      <span class="rum-overview__scope">{{ t('rum.overviewScope') }}</span>
      <t-radio-group
        v-model="range"
        variant="default-filled"
        size="small"
      >
        <t-radio-button
          v-for="value in ranges"
          :key="value"
          :value="value"
        >
          {{ t(`rum.range${value}`) }}
        </t-radio-button>
      </t-radio-group>
    </header>

    <RumState
      :loading="resource.loading.value"
      :error="resource.error.value"
      @retry="resource.reload"
    >
      <div
        v-if="data"
        class="rum-overview__body"
      >
        <section
          v-for="group in groups"
          :key="group.key"
          class="rum-overview__group"
        >
          <h3 class="rum-overview__group-title">{{ group.title }}</h3>
          <dl class="rum-overview__kpis">
            <div
              v-for="item in group.items"
              :key="item.key"
              class="rum-overview__kpi"
            >
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </section>

        <div class="rum-overview__charts">
          <ChartCard
            :title="t('rum.trafficTrend')"
            :extra="rangeLabel"
            height="260px"
          >
            <EChart :option="trafficOption" />
          </ChartCard>
          <ChartCard
            :title="t('rum.requestTrend')"
            :extra="formatRate(data.requests.successRate)"
            height="260px"
          >
            <EChart :option="requestOption" />
          </ChartCard>
          <ChartCard
            :title="t('rum.errorEventTrend')"
            :extra="formatNumber(data.errors.total)"
            height="260px"
          >
            <EChart :option="errorOption" />
          </ChartCard>
        </div>
      </div>
    </RumState>
  </div>
</template>

<style scoped lang="less">
.rum-overview {
  display: grid;
  gap: 16px;
  min-width: 0;

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__scope {
    color: @beacon-text-tertiary;
    font-size: 12px;
  }

  &__body {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  &__group {
    padding: 16px;
    background: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__group-title {
    margin: 0 0 12px;
    color: @beacon-text-secondary;
    font-size: 12px;
    font-weight: @beacon-font-weight-medium;
  }

  &__kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    margin: 0;

    div {
      min-width: 0;
    }

    dt {
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    dd {
      margin: 6px 0 0;
      overflow-wrap: anywhere;
      font-size: 24px;
      font-weight: 600;
      line-height: 32px;
      font-variant-numeric: tabular-nums;
    }
  }

  &__charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 16px;
    min-width: 0;
  }
}

@media (max-width: 700px) {
  .rum-overview__charts {
    grid-template-columns: minmax(0, 1fr);
  }

  .rum-overview__kpis dd {
    font-size: 20px;
    line-height: 28px;
  }
}
</style>
