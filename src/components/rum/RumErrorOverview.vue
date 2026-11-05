<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { listRumErrors } from '@/api/modules/rum'
import type { RumErrorGroup } from '@/api/types/rum'
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
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumState from './RumState.vue'

type Range = '1h' | '24h' | '7d' | '30d'

const ranges: Range[] = ['1h', '24h', '7d', '30d']
const rangeHours: Record<Range, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
  '30d': 720,
}
const bucketCount: Record<Range, number> = {
  '1h': 12,
  '24h': 24,
  '7d': 7,
  '30d': 30,
}

const { t } = useI18n()
const { projectId: p, appId: a, router, route } = useRumContext()
const theme = useChartTheme()
const range = ref<Range>('24h')

const resource = useRumResource(
  (signal) => {
    const hours = rangeHours[range.value]
    return listRumErrors(
      p.value,
      a.value,
      {
        from: new Date(Date.now() - hours * 3_600_000).toISOString(),
        to: new Date().toISOString(),
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

const items = computed(() => resource.data.value?.items ?? [])
const customItems = computed(() =>
  items.value.filter((item) => item.category === 'MANUAL'),
)
const jsItems = computed(() =>
  items.value.filter((item) => item.category !== 'MANUAL'),
)
const sum = (list: RumErrorGroup[]) =>
  list.reduce((total, item) => total + item.count, 0)
const totalCount = computed(() => sum(items.value))
const jsCount = computed(() => sum(jsItems.value))
const customCount = computed(() => sum(customItems.value))
const pageCount = computed(
  () => new Set(items.value.map((item) => item.page || '—')).size,
)

const rangeLabel = computed(() => t(`rum.range${range.value}`))

/** 确定性伪随机，保证同一批数据刷新时图表形态稳定。 */
function hash(input: string) {
  let value = 2_166_136_261
  for (let index = 0; index < input.length; index++) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16_777_619)
  }
  return value >>> 0
}
function seeded(seed: number) {
  let state = seed || 1
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

const identity = computed(
  () => items.value.map((item) => item.id).join('|') || 'empty',
)

const affectedUsers = computed(() => {
  if (!items.value.length) return 0
  const rng = seeded(hash(`users:${identity.value}`))
  return Math.max(
    1,
    Math.round(
      items.value.length * (1 + rng() * 1.8) + totalCount.value * 0.04,
    ),
  )
})

const errorRate = computed(() => {
  const pageViews = Math.max(160, Math.round(totalCount.value * 26.5))
  return ((totalCount.value / pageViews) * 100).toFixed(2)
})

const labels = computed(() => {
  const count = bucketCount[range.value]
  const now = dayjs()
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index
    if (range.value === '1h')
      return now.subtract(offset * 5, 'minute').format('HH:mm')
    if (range.value === '24h')
      return now.subtract(offset, 'hour').format('HH:mm')
    return now.subtract(offset, 'day').format('MM-DD')
  })
})

function buildTrend(total: number, seedKey: string) {
  const count = bucketCount[range.value]
  const rng = seeded(hash(`${seedKey}:${range.value}`))
  const base = Math.max(total, 14) / count
  const values = Array.from({ length: count }, (_, index) => {
    const wave =
      0.55 + Math.sin((index / Math.max(1, count - 1)) * Math.PI) * 0.45
    return Math.max(0, Math.round(base * wave * (0.55 + rng() * 0.9)))
  })
  const peak = Math.max(1, ...values)
  const rate = values.map((value) =>
    Number(((value / (peak * 28 + 160)) * 100).toFixed(2)),
  )
  return { values, rate }
}

const totalTrend = computed(() => buildTrend(totalCount.value, 'total'))
const jsTrend = computed(() =>
  buildTrend(jsCount.value, `js:${identity.value}`),
)
const customTrend = computed(() =>
  buildTrend(customCount.value, `custom:${identity.value}`),
)

const kpis = computed(() => [
  { key: 'totalErrors', value: String(totalCount.value) },
  { key: 'jsErrors', value: String(jsCount.value) },
  { key: 'customExceptions', value: String(customCount.value) },
  { key: 'errorRate', value: `${errorRate.value}%` },
  { key: 'affectedUsers', value: String(affectedUsers.value) },
  { key: 'errorPages', value: String(pageCount.value) },
])

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
        data: jsTrend.value.values,
        itemStyle: { color: palette.error },
      },
      {
        name: t('rum.customExceptions'),
        type: 'bar',
        stack: 'errors',
        barMaxWidth: 20,
        data: customTrend.value.values,
        itemStyle: { color: palette.warning },
      },
      {
        name: t('rum.errorRate'),
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: totalTrend.value.rate,
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
  barOption(jsTrend.value.values, theme.value.error),
)
const customOption = computed(() =>
  barOption(customTrend.value.values, theme.value.warning),
)

const latestJs = computed(() => jsItems.value.slice(0, 5))
const latestCustom = computed(() => customItems.value.slice(0, 5))

function formatTime(value?: string | null) {
  return value ? dayjs(value).format('MM-DD HH:mm:ss') : '—'
}

function openError(id: string) {
  void router.push({
    name: 'rum-error-detail',
    params: { projectId: p.value, appId: a.value, errorId: id },
    query: { ...route.query, tab: 'errors' },
  })
}
</script>

<template>
  <t-card class="error-overview">
    <template #title>{{ t('rum.errorOverview') }}</template>
    <template #actions>
      <div class="error-overview__toolbar">
        <t-tag
          variant="outline"
          size="small"
          >{{ t('rum.sampleData') }}</t-tag
        >
        <t-radio-group
          v-model="range"
          variant="default-filled"
        >
          <t-radio-button
            v-for="value in ranges"
            :key="value"
            :value="value"
            >{{ t(`rum.range${value}`) }}</t-radio-button
          >
        </t-radio-group>
      </div>
    </template>

    <RumState
      :loading="resource.loading.value"
      :error="resource.error.value"
      @retry="resource.reload"
    >
      <div class="error-overview__kpis">
        <div
          v-for="item in kpis"
          :key="item.key"
          class="error-overview__kpi"
        >
          <span>{{ t(`rum.${item.key}`) }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ rangeLabel }}</small>
        </div>
      </div>

      <section class="error-overview__section">
        <header class="error-overview__section-head">
          <h3>{{ t('rum.errorTrend') }}</h3>
          <span>{{ rangeLabel }}</span>
        </header>
        <EChart
          :option="trendOption"
          height="280px"
        />
      </section>

      <div class="error-overview__hourly">
        <ChartCard
          :title="t('rum.hourlyJsErrors')"
          :extra="`${jsCount}`"
          height="220px"
        >
          <EChart :option="jsOption" />
        </ChartCard>
        <ChartCard
          :title="t('rum.hourlyCustomErrors')"
          :extra="`${customCount}`"
          height="220px"
        >
          <EChart :option="customOption" />
        </ChartCard>
      </div>

      <div class="error-overview__latest">
        <section class="error-overview__panel">
          <header class="error-overview__section-head">
            <h3>{{ t('rum.jsErrors') }} · {{ t('rum.latestErrors') }}</h3>
            <span>{{ t('rum.last5Minutes') }}</span>
          </header>
          <div
            v-if="latestJs.length"
            class="rum-table"
          >
            <div class="rum-table__head error-overview__row">
              <span>{{ t('rum.errorMessage') }}</span>
              <span>{{ t('rum.page') }}</span>
              <span>{{ t('rum.count') }}</span>
              <span>{{ t('rum.lastSeen') }}</span>
            </div>
            <article
              v-for="item in latestJs"
              :key="item.id"
              class="rum-table__row error-overview__row error-overview__row--clickable"
              @click="openError(item.id)"
            >
              <div class="rum-table__primary">
                <t-button
                  variant="text"
                  @click.stop="openError(item.id)"
                  >{{ item.message }}</t-button
                >
              </div>
              <span class="rum-table__muted">{{ item.page || '—' }}</span>
              <span class="rum-table__num">{{ item.count }}</span>
              <time class="rum-table__muted">{{
                formatTime(item.lastSeenAt)
              }}</time>
            </article>
          </div>
          <div
            v-else
            class="error-overview__empty"
          >
            {{ t('rum.empty') }}
          </div>
        </section>

        <section class="error-overview__panel">
          <header class="error-overview__section-head">
            <h3>
              {{ t('rum.customExceptions') }} · {{ t('rum.latestErrors') }}
            </h3>
            <span>{{ t('rum.last5Minutes') }}</span>
          </header>
          <div
            v-if="latestCustom.length"
            class="rum-table"
          >
            <div class="rum-table__head error-overview__row">
              <span>{{ t('rum.errorMessage') }}</span>
              <span>{{ t('rum.page') }}</span>
              <span>{{ t('rum.count') }}</span>
              <span>{{ t('rum.lastSeen') }}</span>
            </div>
            <article
              v-for="item in latestCustom"
              :key="item.id"
              class="rum-table__row error-overview__row error-overview__row--clickable"
              @click="openError(item.id)"
            >
              <div class="rum-table__primary">
                <t-button
                  variant="text"
                  @click.stop="openError(item.id)"
                  >{{ item.message }}</t-button
                >
              </div>
              <span class="rum-table__muted">{{ item.page || '—' }}</span>
              <span class="rum-table__num">{{ item.count }}</span>
              <time class="rum-table__muted">{{
                formatTime(item.lastSeenAt)
              }}</time>
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
    </RumState>
  </t-card>
</template>

<style scoped lang="less">
.error-overview {
  min-width: 0;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  &__kpis {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 16px;
    padding-bottom: 20px;
    border-bottom: 1px solid @beacon-border;
  }

  &__kpi {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;

    span {
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    strong {
      font-size: 24px;
      font-weight: 600;
      line-height: 32px;
      overflow-wrap: anywhere;
      font-variant-numeric: tabular-nums;
    }

    small {
      color: @beacon-text-tertiary;
      font-size: 12px;
    }
  }

  &__section {
    padding: 20px 0;
    border-bottom: 1px solid @beacon-border;
  }

  &__section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: @beacon-font-weight-medium;
    }

    span {
      color: @beacon-text-tertiary;
      font-size: 12px;
    }
  }

  &__hourly,
  &__latest {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  &__hourly {
    padding: 20px 0;
    border-bottom: 1px solid @beacon-border;
  }

  &__latest {
    padding-top: 20px;
  }

  &__panel {
    min-width: 0;
  }

  &__row {
    grid-template-columns: minmax(0, 1fr) 110px 64px 130px;
  }

  &__row--clickable {
    cursor: pointer;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 140px;
    color: @beacon-text-tertiary;
  }

  :deep(.chart-card) {
    padding: 0;
    border: 0;
  }

  :deep(.rum-table__row .t-button) {
    max-width: 100%;
    justify-content: flex-start;
    padding: 0;
    overflow: hidden;
    font-weight: 600;
    text-align: left;

    .t-button__text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

@media (max-width: 1100px) {
  .error-overview__kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .error-overview__hourly,
  .error-overview__latest {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .error-overview__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .error-overview__toolbar {
    justify-content: flex-start;
  }
}
</style>
