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
const metrics = [
  { key: 'errors', sub: 'retained', resource: errors },
  { key: 'events', sub: 'recent7', resource: events },
  { key: 'replays', sub: 'retained', resource: replays },
  { key: 'openAlerts', sub: 'retained', resource: alerts },
] as const
</script>

<template>
  <t-card class="rum-overview">
    <template #title>{{ t('rum.overview') }}</template>
    <template #actions>
      <span class="rum-overview__hint">{{ t('rum.recent7') }}</span>
    </template>
    <div class="rum-overview__grid">
      <div
        v-for="item in metrics"
        :key="item.key"
        class="rum-overview__metric"
      >
        <span class="rum-overview__label">{{ t('rum.' + item.key) }}</span>
        <RumState
          :loading="item.resource.loading.value"
          :error="item.resource.error.value"
          @retry="item.resource.reload"
        >
          <strong>{{ item.resource.data.value?.total ?? '—' }}</strong>
        </RumState>
        <small>{{ t('rum.' + item.sub) }}</small>
      </div>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.rum-overview {
  min-width: 0;

  &__hint {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  &__metric {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 4px 0;

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

  &__label {
    color: @beacon-text-secondary;
    font-size: 12px;
  }
}

@media (max-width: 1100px) {
  .rum-overview__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .rum-overview__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
