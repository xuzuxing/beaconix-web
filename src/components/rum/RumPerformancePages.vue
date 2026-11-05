<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RumPerformancePageItem } from '@/api/types/rum'

defineProps<{ items: RumPerformancePageItem[] }>()
const { t } = useI18n()
</script>

<template>
  <t-card
    class="performance-table"
    :title="t('rum.pagePerformance')"
  >
    <t-empty
      v-if="!items.length"
      :description="t('rum.empty')"
    />
    <div
      v-else
      class="performance-table__scroll"
    >
      <table class="performance-table__table">
        <thead>
          <tr>
            <th>{{ t('rum.page') }}</th>
            <th>p75</th>
            <th>{{ t('rum.samples') }}</th>
            <th>{{ t('rum.count') }}</th>
            <th>{{ t('rum.errorsPer100Loads') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.page"
          >
            <td>{{ item.page || '—' }}</td>
            <td>
              {{ item.p75 === null ? '—' : `${Math.round(item.p75)} ms` }}
            </td>
            <td>{{ item.samples }}</td>
            <td>{{ item.errors }}</td>
            <td>{{ item.errorRate === null ? '—' : item.errorRate }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="performance-table__hint">{{ t('rum.errorsPer100LoadsHint') }}</p>
  </t-card>
</template>

<style scoped lang="less">
.performance-table__scroll {
  overflow-x: auto;
}

.performance-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.performance-table__table th {
  color: @beacon-text-secondary;
  font-weight: 500;
  background: @beacon-bg-page;
}

.performance-table__table th,
.performance-table__table td {
  padding: 12px;
  border-bottom: 1px solid @beacon-border;
  text-align: left;
  overflow-wrap: anywhere;
}

.performance-table__table td {
  font-variant-numeric: tabular-nums;
}

.performance-table__hint {
  margin: 10px 0 0;
  color: @beacon-text-tertiary;
  font-size: 12px;
}
</style>
