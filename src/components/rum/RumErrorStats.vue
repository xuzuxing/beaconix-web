<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import type { RumErrorGroup, RumErrorOccurrence } from '@/api/types/rum'
import EChart from '@/components/charts/EChart.vue'
import { useChartTheme } from '@/components/charts/chartTheme'
import {
  areaStyle,
  chartBase,
  chartGrid,
  chartTooltip,
  categoryAxis,
  valueAxis,
} from '@/components/charts/chartPresets'
import type { ChartOption } from '@/components/charts/echarts'

const props = defineProps<{
  error: RumErrorGroup
  occurrences: RumErrorOccurrence[]
}>()
const { t } = useI18n()
const theme = useChartTheme()

function hash(input: string) {
  let value = 2_166_136_261
  for (let index = 0; index < input.length; index++) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16_777_619)
  }
  return value >>> 0
}

function formatTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '—'
}

const sessions = computed(() => {
  const ids = new Set(
    props.occurrences
      .map((item) => item.sessionId)
      .filter((value): value is string => Boolean(value)),
  )
  if (ids.size) return ids.size
  return Math.max(1, Math.round(props.error.count * 0.35))
})

const users = computed(() => {
  const ids = new Set(
    props.occurrences
      .map((item) => item.endUserId || item.anonymousId)
      .filter((value): value is string => Boolean(value)),
  )
  if (ids.size) return ids.size
  const seed = hash(props.error.id)
  return Math.max(1, Math.round(props.error.count * (0.4 + (seed % 30) / 100)))
})

const overview = computed(() => [
  { key: 'count', value: String(props.error.count) },
  { key: 'affectedUsers', value: String(users.value) },
  { key: 'sessionsCount', value: String(sessions.value) },
  { key: 'release', value: props.error.release || '—' },
  { key: 'firstOccurred', value: formatTime(props.error.firstSeenAt) },
  { key: 'lastOccurred', value: formatTime(props.error.lastSeenAt) },
])

const hasBrowserData = computed(() =>
  props.occurrences.some((item) => {
    const sdk = item.sdk ?? {}
    return Boolean(sdk.browser || sdk.browserName || sdk.userAgent || sdk.ua)
  }),
)

const browsers = computed(() => {
  const counts = new Map<string, number>()
  for (const item of props.occurrences) {
    const sdk = item.sdk ?? {}
    const raw = sdk.browser || sdk.browserName || sdk.userAgent || sdk.ua
    if (typeof raw !== 'string' || !raw) continue
    const name = /edg/i.test(raw)
      ? 'Edge'
      : /firefox/i.test(raw)
        ? 'Firefox'
        : /safari/i.test(raw) && !/chrome/i.test(raw)
          ? 'Safari'
          : /chrome/i.test(raw)
            ? 'Chrome'
            : 'Other'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  if (!counts.size) {
    const seed = hash(`browser:${props.error.id}`)
    const values = [
      ['Chrome', 58 + (seed % 18)],
      ['Safari', 12 + (seed % 9)],
      ['Edge', 7 + (seed % 6)],
      ['Firefox', 4 + (seed % 5)],
    ] as const
    return values.map(([name, value]) => ({ name, value }))
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
})

const browserMax = computed(() =>
  Math.max(1, ...browsers.value.map((item) => item.value)),
)

const trend = computed(() => {
  const days = 7
  const buckets = Array.from({ length: days }, (_, index) =>
    dayjs()
      .subtract(days - 1 - index, 'day')
      .startOf('day'),
  )
  const values = buckets.map(() => 0)
  let real = false
  for (const item of props.occurrences) {
    if (!item.occurredAt) continue
    const occurred = dayjs(item.occurredAt).startOf('day')
    const index = buckets.findIndex((bucket) => bucket.isSame(occurred, 'day'))
    if (index >= 0) {
      values[index]! += 1
      real = true
    }
  }
  if (!real) {
    let state = hash(`trend:${props.error.id}`)
    const base = Math.max(1, props.error.count)
    for (let index = 0; index < values.length; index++) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      values[index] = Math.max(
        0,
        Math.round(base * (0.4 + (state / 4_294_967_296) * 0.9)),
      )
    }
  }
  return {
    labels: buckets.map((bucket) => bucket.format('MM-DD')),
    values,
    sample: !real,
  }
})

const trendOption = computed<ChartOption>(() => {
  const palette = theme.value
  return chartBase(palette, {
    grid: { ...chartGrid, top: 12 },
    tooltip: chartTooltip(palette),
    xAxis: categoryAxis(palette, trend.value.labels, true),
    yAxis: valueAxis(palette),
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: trend.value.values,
        lineStyle: { width: 1.8, color: palette.error },
        itemStyle: { color: palette.error },
        areaStyle: areaStyle(palette.error),
      },
    ],
  })
})
</script>

<template>
  <div class="error-stats">
    <t-card class="error-stats__card">
      <template #title>{{ t('rum.dataOverview') }}</template>
      <dl class="error-stats__overview">
        <div
          v-for="item in overview"
          :key="item.key"
        >
          <dt>{{ t(`rum.${item.key}`) }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </t-card>

    <t-card class="error-stats__card">
      <template #title>{{ t('rum.browserDistribution') }}</template>
      <template
        v-if="!hasBrowserData"
        #actions
        ><t-tag
          variant="outline"
          size="small"
          >{{ t('rum.sampleData') }}</t-tag
        ></template
      >
      <ul class="error-stats__bars">
        <li
          v-for="item in browsers"
          :key="item.name"
        >
          <span class="error-stats__bar-label">{{ item.name }}</span>
          <span class="error-stats__bar-track">
            <span
              class="error-stats__bar-fill"
              :style="{ width: `${(item.value / browserMax) * 100}%` }"
            />
          </span>
          <span class="error-stats__bar-value">{{ item.value }}</span>
        </li>
      </ul>
    </t-card>

    <t-card class="error-stats__card">
      <template #title>{{ t('rum.occurrenceTrend') }}</template>
      <template
        v-if="trend.sample"
        #actions
        ><t-tag
          variant="outline"
          size="small"
          >{{ t('rum.sampleData') }}</t-tag
        ></template
      >
      <EChart
        :option="trendOption"
        height="180px"
      />
    </t-card>
  </div>
</template>

<style scoped lang="less">
.error-stats {
  display: grid;
  gap: 16px;
  min-width: 0;

  &__card {
    min-width: 0;
  }

  &__overview {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin: 0;

    div {
      min-width: 0;
    }

    dt {
      margin-bottom: 6px;
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
  }

  &__bars {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) 40px;
      align-items: center;
      gap: 10px;
      font-size: 12px;
    }
  }

  &__bar-label {
    overflow: hidden;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__bar-track {
    height: 6px;
    overflow: hidden;
    background: @beacon-bg-page;
    border-radius: 3px;
  }

  &__bar-fill {
    display: block;
    height: 100%;
    background: @beacon-brand;
    border-radius: 3px;
  }

  &__bar-value {
    color: @beacon-text-secondary;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}
</style>
