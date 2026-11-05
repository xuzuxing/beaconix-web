<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RumPage, RumAlertIncident } from '@/api/types/rum'
import RumPager from './RumPager.vue'

defineProps<{
  data: RumPage<RumAlertIncident>
  page: number
  status: string
}>()
const emit = defineEmits<{
  updatePage: [page: number]
  updateStatus: [status: string]
}>()
const { t } = useI18n()
</script>

<template>
  <t-card class="alert-incidents">
    <div class="alert-incidents__head">
      <h2>{{ t('rum.incidents') }}</h2>
      <t-select
        class="alert-incidents__status"
        :value="status"
        :options="[
          { value: '', label: t('rum.total') },
          { value: 'OPEN', label: 'OPEN' },
          { value: 'RESOLVED', label: 'RESOLVED' },
        ]"
        @change="emit('updateStatus', String($event))"
      />
    </div>
    <t-empty
      v-if="!data.items.length"
      :description="t('rum.empty')"
    />
    <article
      v-for="incident in data.items"
      :key="incident.id"
      class="alert-incidents__item"
    >
      <strong>{{ incident.rule?.name || incident.ruleId }}</strong>
      <span>
        {{ incident.status }} ·
        {{ incident.rule ? t(`rum.alertMetric.${incident.rule.metric}`) : '' }}
        · {{ t('rum.value') }}: {{ incident.value }} / {{ incident.threshold }}
      </span>
      <span>
        {{ t('rum.started') }}: {{ incident.startedAt }} ·
        {{ t('rum.resolvedAt') }}:
        {{ incident.resolvedAt || '—' }}
      </span>
    </article>
    <RumPager
      :model-value="page"
      :total="data.total"
      :limit="data.limit"
      @update:model-value="emit('updatePage', $event)"
    />
  </t-card>
</template>

<style scoped>
.alert-incidents {
  display: grid;
  gap: 12px;
}

.alert-incidents__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.alert-incidents__head h2 {
  margin: 0;
}

.alert-incidents__status {
  width: 180px;
}

.alert-incidents__item {
  display: grid;
  gap: 5px;
  padding: 12px 0;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.alert-incidents__item span {
  color: var(--td-text-color-secondary);
}
</style>
