<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { getRumErrorOverview, listRumErrors } from '@/api/modules/rum'
import type { RumErrorGroup, RumErrorOverview } from '@/api/types/rum'
import ChartCard from '@/components/charts/ChartCard.vue'
import EChart from '@/components/charts/EChart.vue'
import { useChartTheme } from '@/components/charts/chartTheme'
import {
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
 * 错误列表页顶部的异常概览。
 * 指标来自 getRumErrorOverview 的聚合（错误发生次数 / PV / 影响面），
 * 「最新错误」列表来自 listRumErrors 的真实查询；比率没有数据时为 null。
 */
const ranges = RUM_RANGES

const { t } = useI18n()
const { projectId: p, appId: a, router, route } = useRumContext()
const theme = useChartTheme()
const range = ref<RumRange>('24h')

const resource = useRumResource(
  (signal) =>
    getRumErrorOverview(p.value, a.value, rumRangeWindow(range.value), {
      signal,
    }),
  [p, a, range],
)

const latest = useRumResource(
  (signal) => {
    const window = rumRangeWindow(range.value)
    return listRumErrors(
      p.value,
      a.value,
      {
        from: window.from,
        to: window.to,
        page: 1,
        limit: 50,
        sortBy: 'lastSeenAt',
        sortOrder: 'desc',
      },
      { signal },
    )
  },
  [p, a, range],
)

const data = computed<RumErrorOverview | null>(() => resource.data.value)
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
function formatTime(value?: string | null) {
  return value ? dayjs(value).format('MM-DD HH:mm:ss') : '—'
}

const kpis = computed(() => {
  const totals = data.value?.totals
  if (!totals) return []
  return [
    { key: 'errors', label: t('rum.totalErrors'), value: formatNumber(totals.errors) },
    { key: 'js', label: t('rum.jsErrors'), value: formatNumber(totals.js) },
    {
      key: 'custom',
      label: t('rum.customExceptions'),
      value: formatNumber(totals.custom),
    },
    { key: 'rate', label: t('rum.errorRate'), value: formatRate(totals.errorRate) },
    {
      key: 'users',
      label: t('rum.affectedUsers'),
      value: formatNumber(totals.affectedUsers),
    },
    {
      key: 'pages',
      label: t('rum.affectedPages'),
      value: formatNumber(totals.affectedPages),
    },
    {
      key: 'open',
      label: t('rum.openGroups'),
      value: formatNumber(totals.openGroups),
    },
  ]
})

const trendOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { ...chartGrid, top: 40 },
    tooltip: chartTooltip(palette),
    legend: chartLegend(palette),
    xAxis: categoryAxis(palette, labels.value, true),
    yAxis: [valueAxis(palette), valueAxis(palette, { formatter: '{value}%' })],
    series: [
      {
        name: t('rum.jsErrors'),
        type: 'bar',
        stack: 'errors',
        barMaxWidth: 20,
        data: series.value.map((point) => point.js),
        itemStyle: { color: palette.error },
      },
      {
        name: t('rum.customExceptions'),
        type: 'bar',
        stack: 'errors',
        barMaxWidth: 20,
        data: series.value.map((point) => point.custom),
        itemStyle: { color: palette.warning },
      },
      {
        name: t('rum.errorRate'),
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        // 没有 PV 的桶留空，避免把「无流量」画成 0%
        data: series.value.map((point) => point.errorRate),
        lineStyle: { width: 1.8, color: palette.brand },
        itemStyle: { color: palette.brand },
      },
    ],
  })
})

function barOption(values: number[], color: string): ChartOption {
  const palette = theme.value
  return chartBase(palette, {
    grid: { ...chartGrid, top: 8 },
    tooltip: chartTooltip(palette),
    xAxis: categoryAxis(palette, labels.value, true),
    yAxis: valueAxis(palette),
    series: [
      {
        type: 'bar',
        barMaxWidth: 16,
        data: values,
        itemStyle: { color },
      },
    ],
  })
}

const jsOption = computed(() =>
  barOption(series.value.map((point) => point.js), theme.value.error),
)
const customOption = computed(() =>
  barOption(series.value.map((point) => point.custom), theme.value.warning),
)

const latestRows = computed(() => latest.data.value?.items ?? [])
const latestJs = computed(() =>
  latestRows.value.filter((item) => item.category !== 'MANUAL').slice(0, 5),
)
const latestCustom = computed(() =>
  latestRows.value.filter((item) => item.category === 'MANUAL').slice(0, 5),
)
const latestPanels = computed<{ key: string; title: string; rows: RumErrorGroup[] }[]>(
  () => [
    { key: 'js', title: t('rum.jsErrors'), rows: latestJs.value },
    { key: 'custom', title: t('rum.customExceptions'), rows: latestCustom.value },
  ],
)

function openError(id: string) {
  void router.push({
    name: 'rum-error-detail',
    params: { projectId: p.value, appId: a.value, errorId: id },
    query: { ...route.query },
  })
}

const rangeLabel = computed(() => t(`rum.range${range.value}`))
</script>

<template>
  <t-card class="error-overview">
    <template #title>{{ t('rum.errorOverview') }}</template>
    <template #actions>
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
    </template>

    <RumState
      :loading="resource.loading.value"
      :error="resource.error.value"
      @retry="resource.reload"
    >
      <div
        v-if="data && data.totals"
        class="error-overview__body"
      >
        <dl class="error-overview__kpis">
          <div
            v-for="item in kpis"
            :key="item.key"
            class="error-overview__kpi"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>

        <ChartCard
          :title="t('rum.errorTrend')"
          :extra="rangeLabel"
          height="260px"
        >
          <EChart :option="trendOption" />
        </ChartCard>

        <div class="error-overview__split">
          <ChartCard
            :title="t('rum.jsErrors')"
            :extra="formatNumber(data.totals.js)"
            height="220px"
          >
            <EChart :option="jsOption" />
          </ChartCard>
          <ChartCard
            :title="t('rum.customExceptions')"
            :extra="formatNumber(data.totals.custom)"
            height="220px"
          >
            <EChart :option="customOption" />
          </ChartCard>
        </div>

        <div class="error-overview__latest">
          <section
            v-for="group in latestPanels"
            :key="group.key"
            class="error-overview__panel"
          >
            <header class="error-overview__section-head">
              <h3>{{ group.title }} · {{ t('rum.latestErrors') }}</h3>
              <span>{{ t('rum.latestInWindow') }}</span>
            </header>
            <div
              v-if="group.rows.length"
              class="rum-table"
            >
              <div class="rum-table__head error-overview__row">
                <span>{{ t('rum.errorMessage') }}</span>
                <span>{{ t('rum.page') }}</span>
                <span>{{ t('rum.count') }}</span>
                <span>{{ t('rum.lastSeen') }}</span>
              </div>
              <article
                v-for="item in group.rows"
                :key="item.id"
                class="rum-table__row error-overview__row"
              >
                <div class="rum-table__primary">
                  <t-button
                    variant="text"
                    @click="openError(item.id)"
                  >
                    {{ item.message }}
                  </t-button>
                </div>
                <span class="rum-table__muted">{{ item.page || '—' }}</span>
                <span class="rum-table__num">{{ item.count }}</span>
                <time class="rum-table__muted">{{ formatTime(item.lastSeenAt) }}</time>
              </article>
            </div>
            <div
              v-else
              class="error-overview__empty"
            >
              {{ t('rum.empty') }}
            </div>
          </section>
        </div>
      </div>
    </RumState>
  </t-card>
</template>

<style scoped lang="less">
.error-overview {
  min-width: 0;

  &__body {
    display: grid;
    gap: 16px;
    min-width: 0;
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
      font-size: 22px;
      font-weight: 600;
      line-height: 30px;
      font-variant-numeric: tabular-nums;
    }
  }

  &__split {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
    min-width: 0;
  }

  &__latest {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
    min-width: 0;
  }

  &__panel {
    min-width: 0;
  }

  &__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;

    h3 {
      margin: 0;
      font-size: 13px;
      font-weight: @beacon-font-weight-medium;
    }

    span {
      color: @beacon-text-tertiary;
      font-size: 11px;
    }
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(160px, 2fr) minmax(80px, 1fr) 60px 120px;
    align-items: center;
    gap: 12px;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }
}

@media (max-width: 900px) {
  .error-overview__row {
    grid-template-columns: minmax(140px, 2fr) 60px 110px;
  }

  .error-overview__row > :nth-child(2) {
    display: none;
  }
}
</style>
