<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  RumPerformanceMetric,
  RumPerformanceSeriesItem,
} from '@/api/types/rum'

const props = defineProps<{ series: RumPerformanceSeriesItem[] }>()
const { t } = useI18n()

const rows = computed(() =>
  props.series
    .flatMap((item) =>
      item.points.map((point) => ({
        metric: item.metric,
        ...point,
      })),
    )
    .sort((a, b) => b.bucketStart.localeCompare(a.bucketStart))
    .slice(0, 50),
)

function formatValue(metric: RumPerformanceMetric, value: number | null) {
  if (value === null) return '—'
  return metric === 'CLS' ? value.toFixed(3) : `${Math.round(value)} ms`
}
</script>

<template>
  <t-card
    class="performance-trend"
    :title="t('rum.performanceTrend')"
  >
    <t-empty
      v-if="!rows.length"
      :description="t('rum.empty')"
    />
    <div
      v-else
      class="performance-trend__scroll"
    >
      <table class="performance-trend__table">
        <thead>
          <tr>
            <th>{{ t('rum.metric') }}</th>
            <th>{{ t('rum.bucketStart') }}</th>
            <th>{{ t('rum.samples') }}</th>
            <th>p75</th>
            <th>{{ t('rum.average') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="`${row.metric}:${row.bucketStart}`"
          >
            <td>{{ row.metric }}</td>
            <td>{{ row.bucketStart }}</td>
            <td>{{ row.count }}</td>
            <td>{{ formatValue(row.metric, row.p75) }}</td>
            <td>{{ formatValue(row.metric, row.average) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.performance-trend__scroll {
  overflow-x: auto;
}

.performance-trend__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.performance-trend__table th {
  color: @beacon-text-secondary;
  font-weight: 500;
  background: @beacon-bg-page;
}

.performance-trend__table th,
.performance-trend__table td {
  padding: 12px;
  border-bottom: 1px solid @beacon-border;
  text-align: left;
  white-space: nowrap;
}

.performance-trend__table td {
  font-variant-numeric: tabular-nums;
}
</style>
