<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  getRumEventStats,
  listRumAlertIncidents,
  listRumErrors,
  listRumReplays,
} from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
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
</script>
<template>
  <div class="metrics">
    <article
      v-for="item in [
        { key: 'errors', sub: 'retained', resource: errors },
        { key: 'events', sub: 'recent7', resource: events },
        { key: 'replays', sub: 'retained', resource: replays },
        { key: 'openAlerts', sub: 'retained', resource: alerts },
      ]"
      :key="item.key"
    >
      <h3>{{ t('rum.' + item.key) }}</h3>
      <RumState
        :loading="item.resource.loading.value"
        :error="item.resource.error.value"
        @retry="item.resource.reload"
        ><strong>{{ item.resource.data.value?.total ?? '—' }}</strong></RumState
      ><small>{{ t('rum.' + item.sub) }}</small>
    </article>
  </div>
</template>
<style scoped>
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}
.metrics article {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 18px;
  background: var(--td-bg-color-container);
}
h3 {
  margin: 0 0 14px;
  font-size: 14px;
}
strong {
  font-size: 28px;
}
small {
  display: block;
  color: var(--td-text-color-secondary);
  margin-top: 8px;
}
</style>
