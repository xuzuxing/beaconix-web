<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  RumPerformanceSeriesItem,
  RumPerformanceSummary,
  RumPerformanceMetric,
} from '@/api/types/rum'

const props = defineProps<{
  summary: RumPerformanceSummary
  series: RumPerformanceSeriesItem[]
}>()
const { t } = useI18n()

const cards = computed(() => {
  const byMetric = new Map(props.series.map((item) => [item.metric, item]))
  return props.summary.metrics.map((metric) => ({
    ...metric,
    changePercent: byMetric.get(metric.metric)?.current.changePercent ?? null,
  }))
})

function formatValue(metric: RumPerformanceMetric, value: number | null) {
  if (value === null) return '—'
  return metric === 'CLS' ? value.toFixed(3) : `${Math.round(value)} ms`
}
</script>

<template>
  <t-card
    class="performance-summary"
    :title="t('rum.performanceSummary')"
  >
    <div class="performance-summary__grid">
      <div
        v-for="metric in cards"
        :key="metric.metric"
        class="performance-summary__card"
      >
        <div class="performance-summary__heading">
          <strong>{{ metric.metric }}</strong>
          <t-tag
            :theme="
              metric.rating === null
                ? 'default'
                : metric.rating === 'GOOD'
                  ? 'success'
                  : metric.rating === 'POOR'
                    ? 'danger'
                    : 'warning'
            "
          >
            {{
              metric.rating ? t(`rum.performanceRating.${metric.rating}`) : '—'
            }}
          </t-tag>
        </div>
        <p class="performance-summary__value">
          p75 {{ formatValue(metric.metric, metric.p75) }}
        </p>
        <p class="performance-summary__meta">
          {{ t('rum.samples') }}: {{ metric.count }} · {{ t('rum.goodRate') }}:
          {{ metric.goodRate ?? '—' }}% · {{ t('rum.poorRate') }}:
          {{ metric.poorRate ?? '—' }}%
        </p>
        <p class="performance-summary__meta">
          {{ t('rum.windowChange') }}:
          {{
            metric.changePercent === null
              ? '—'
              : `${metric.changePercent > 0 ? '+' : ''}${metric.changePercent}%`
          }}
        </p>
      </div>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.performance-summary__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}

.performance-summary__card {
  min-width: 0;
  padding: 4px 0;
}

.performance-summary__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  strong {
    font-size: 14px;
    font-weight: @beacon-font-weight-medium;
  }
}

.performance-summary__value {
  margin: 14px 0 8px;
  font-size: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.performance-summary__meta {
  margin: 4px 0 0;
  color: @beacon-text-secondary;
  font-size: 12px;
}
</style>
