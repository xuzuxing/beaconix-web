<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getRumEventStats,
  listRumAlertIncidents,
  listRumErrors,
  listRumReplays,
} from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumKpiGrid from './RumKpiGrid.vue'
import RumState from './RumState.vue'
const { t } = useI18n()
const { projectId: p, appId: a } = useRumContext()
const sources = [p, a]
const errors = useRumResource(
  (signal) =>
    listRumErrors(
      p.value,
      a.value,
      { page: 1, limit: 5, sortBy: 'lastSeenAt', sortOrder: 'desc' },
      { signal },
    ),
  sources,
)
const events = useRumResource(
  (signal) => getRumEventStats(p.value, a.value, { days: 7 }, { signal }),
  sources,
)
const replays = useRumResource(
  (signal) =>
    listRumReplays(p.value, a.value, { page: 1, limit: 5 }, { signal }),
  sources,
)
const alerts = useRumResource(
  (signal) =>
    listRumAlertIncidents(
      p.value,
      a.value,
      { status: 'OPEN', page: 1, limit: 5 },
      { signal },
    ),
  sources,
)
const resources = [errors, events, replays, alerts]
const loading = computed(() => resources.some((item) => item.loading.value))
const failed = computed(() => resources.some((item) => item.error.value))
function retryAll() {
  resources.forEach((item) => item.reload())
}
const kpis = computed(() => [
  {
    key: 'errors',
    label: t('rum.errors'),
    value: errors.data.value?.total,
    hint: t('rum.retained'),
  },
  {
    key: 'events',
    label: t('rum.events'),
    value: events.data.value?.total,
    hint: t('rum.recent7'),
  },
  {
    key: 'replays',
    label: t('rum.replays'),
    value: replays.data.value?.total,
    hint: t('rum.retained'),
  },
  {
    key: 'openAlerts',
    label: t('rum.openAlerts'),
    value: alerts.data.value?.total,
    hint: t('rum.retained'),
  },
])
</script>
<template>
  <t-card class="rum-overview">
    <template #title>{{ t('rum.overview') }}</template>
    <RumState
      :loading="loading"
      :error="failed"
      @retry="retryAll"
    >
      <RumKpiGrid :items="kpis" />
    </RumState>
  </t-card>
</template>
<style scoped lang="less">
.rum-overview {
  min-width: 0;
}
</style>
