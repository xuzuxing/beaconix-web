<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RumPerformanceResourceItem } from '@/api/types/rum'

defineProps<{
  items: RumPerformanceResourceItem[]
  metric: 'RESOURCE' | 'HTTP'
}>()
const emit = defineEmits<{ changeMetric: [metric: 'RESOURCE' | 'HTTP'] }>()
const { t } = useI18n()
</script>

<template>
  <t-card class="resource-performance">
    <div class="resource-performance__head">
      <h2 class="resource-performance__title">
        {{ t('rum.resourcePerformance') }}
      </h2>
      <t-radio-group
        :value="metric"
        variant="default-filled"
        @change="emit('changeMetric', $event as 'RESOURCE' | 'HTTP')"
      >
        <t-radio-button value="RESOURCE">{{
          t('rum.resourcesMetric')
        }}</t-radio-button>
        <t-radio-button value="HTTP">HTTP</t-radio-button>
      </t-radio-group>
    </div>
    <t-empty
      v-if="!items.length"
      :description="t('rum.empty')"
    />
    <div
      v-else
      class="resource-performance__scroll"
    >
      <table class="resource-performance__table">
        <thead>
          <tr>
            <th>{{ metric === 'HTTP' ? 'URL' : t('rum.resource') }}</th>
            <th>p75</th>
            <th>{{ t('rum.samples') }}</th>
            <th>{{ t('rum.failures') }}</th>
            <th>{{ t('rum.failureRate') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.dimension"
          >
            <td>{{ item.dimension || '—' }}</td>
            <td>
              {{ item.p75 === null ? '—' : `${Math.round(item.p75)} ms` }}
            </td>
            <td>{{ item.samples }}</td>
            <td>{{ item.failures }}</td>
            <td>
              {{ item.failureRate === null ? '—' : `${item.failureRate}%` }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </t-card>
</template>

<style scoped>
.resource-performance__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.resource-performance__title {
  margin: 0;
}

.resource-performance__scroll {
  overflow-x: auto;
}

.resource-performance__table {
  width: 100%;
  border-collapse: collapse;
}

.resource-performance__table th,
.resource-performance__table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  text-align: left;
  overflow-wrap: anywhere;
}
</style>
