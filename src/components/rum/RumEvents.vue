<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listRumEvents, getRumEventStats } from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import EChart from '@/components/charts/EChart.vue'
import { useChartTheme } from '@/components/charts/chartTheme'
import RumState from './RumState.vue'
import RumPager from './RumPager.vue'

const { t } = useI18n()
const { projectId: p, appId: a } = useRumContext()
const page = ref(1)
const days = ref(7)
const draftDays = ref(7)
const chartTheme = useChartTheme()
function updateDays() {
  days.value = Math.max(1, Math.min(90, Math.trunc(draftDays.value || 7)))
  draftDays.value = days.value
}
const draft = reactive({ eventName: '', sessionId: '', from: '', to: '' })
const filter = ref({ ...draft })
const stats = useRumResource(
  (signal) =>
    getRumEventStats(
      p.value,
      a.value,
      { days: days.value, eventName: filter.value.eventName || undefined },
      { signal },
    ),
  [p, a, days, filter],
)
const events = useRumResource(
  (signal) =>
    listRumEvents(
      p.value,
      a.value,
      {
        ...filter.value,
        from: filter.value.from
          ? new Date(filter.value.from).toISOString()
          : undefined,
        to: filter.value.to
          ? new Date(filter.value.to).toISOString()
          : undefined,
        page: page.value,
        limit: 20,
      },
      { signal },
    ),
  [p, a, filter, page],
)
function search() {
  page.value = 1
  filter.value = { ...draft }
}
const trend = computed(() => {
  const rows = stats.data.value?.daily ?? []
  const map = new Map(rows.map((x) => [x.day, x.count]))
  const dates = Array.from({ length: days.value + 1 }, (_, i) =>
    new Date(Date.now() - (days.value - i) * 86400000)
      .toISOString()
      .slice(0, 10),
  )
  return {
    tooltip: { trigger: 'axis' as const },
    textStyle: { color: chartTheme.value.textSecondary },
    color: [chartTheme.value.brand],
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: { color: chartTheme.value.textSecondary },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: chartTheme.value.textSecondary },
      splitLine: { lineStyle: { color: chartTheme.value.splitLine } },
    },
    series: [
      { type: 'line' as const, data: dates.map((d) => map.get(d) ?? 0) },
    ],
  }
})
const top = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  textStyle: { color: chartTheme.value.textSecondary },
  color: [chartTheme.value.brand],
  xAxis: {
    type: 'value' as const,
    axisLabel: { color: chartTheme.value.textSecondary },
    splitLine: { lineStyle: { color: chartTheme.value.splitLine } },
  },
  yAxis: {
    axisLabel: { color: chartTheme.value.textSecondary },
    type: 'category' as const,
    data: (stats.data.value?.topEvents ?? []).map((x) => x.eventName),
  },
  series: [
    {
      type: 'bar' as const,
      data: (stats.data.value?.topEvents ?? []).map((x) => x.count),
    },
  ],
}))
</script>

<template>
  <t-card class="events-panel">
    <template #title>{{ t('rum.events') }}</template>
    <template #actions>
      <span class="events-panel__hint">
        {{ t('rum.total') }}: {{ stats.data.value?.total ?? 0 }}
      </span>
    </template>

    <div class="filters rum-filter">
      <label class="rum-filter__field rum-filter__date rum-filter__period">
        {{ t('rum.days') }}
        <t-input-number
          v-model="draftDays"
          :min="1"
          :max="90"
          @change="updateDays"
        />
      </label>
      <form
        class="rum-filter rum-filter__nested"
        @submit.prevent="search"
      >
        <t-input
          v-model="draft.eventName"
          class="rum-filter__field"
          :placeholder="t('rum.eventName')"
        />
        <t-input
          v-model="draft.sessionId"
          class="rum-filter__field"
          :placeholder="t('rum.sessionId')"
        />
        <label class="rum-filter__field rum-filter__date">
          {{ t('rum.from') }}
          <t-date-picker
            v-model="draft.from"
            enable-time-picker
            format="YYYY-MM-DD HH:mm:ss"
            clearable
          />
        </label>
        <label class="rum-filter__field rum-filter__date">
          {{ t('rum.to') }}
          <t-date-picker
            v-model="draft.to"
            enable-time-picker
            format="YYYY-MM-DD HH:mm:ss"
            clearable
          />
        </label>
        <t-button type="submit">{{ t('rum.search') }}</t-button>
      </form>
    </div>

    <RumState
      :loading="stats.loading.value"
      :error="stats.error.value"
      @retry="stats.reload"
    >
      <template v-if="stats.data.value">
        <div class="events-panel__kpis">
          <div>
            <span>{{ t('rum.total') }}</span>
            <strong>{{ stats.data.value.total }}</strong>
          </div>
          <div>
            <span>{{ t('rum.actors') }}</span>
            <strong>{{ stats.data.value.uniqueActors }}</strong>
          </div>
          <div>
            <span>{{ t('rum.sessions') }}</span>
            <strong>{{ stats.data.value.uniqueSessions }}</strong>
          </div>
        </div>
        <div class="events-panel__charts">
          <section>
            <h3>{{ t('rum.trend') }}</h3>
            <EChart
              :option="trend"
              height="240px"
            />
          </section>
          <section>
            <h3>{{ t('rum.topEvents') }}</h3>
            <EChart
              :option="top"
              height="240px"
            />
          </section>
        </div>
        <details class="events-panel__details">
          <summary>{{ t('rum.trend') }} / {{ t('rum.topEvents') }}</summary>
          <p
            v-for="d in stats.data.value.daily"
            :key="d.day"
          >
            {{ d.day }}: {{ d.count }}
          </p>
          <p
            v-for="e in stats.data.value.topEvents"
            :key="e.eventName"
          >
            {{ e.eventName }}: {{ e.count }}
          </p>
        </details>
      </template>
    </RumState>

    <RumState
      :loading="events.loading.value"
      :error="events.error.value"
      @retry="events.reload"
    >
      <div
        v-if="!events.data.value?.items.length"
        class="events-panel__empty"
      >
        {{ t('rum.empty') }}
      </div>
      <div
        v-else
        class="events-panel__list"
      >
        <div class="events-panel__head">
          <span>{{ t('rum.eventName') }}</span>
          <span>{{ t('rum.actor') }} / {{ t('rum.sessionId') }}</span>
          <span>{{ t('rum.occurred') }}</span>
          <span>{{ t('rum.properties') }}</span>
        </div>
        <article
          v-for="item in events.data.value.items"
          :key="item.id"
          class="events-panel__row"
        >
          <div class="events-panel__name">{{ item.eventName }}</div>
          <div class="events-panel__meta">
            <span>{{ item.endUserId || item.anonymousId || '—' }}</span>
            <small>{{ item.sessionId || '—' }}</small>
          </div>
          <time class="events-panel__time">
            {{ item.occurredAt || item.receivedAt }}
          </time>
          <details class="events-panel__properties">
            <summary>{{ t('rum.properties') }}</summary>
            <pre>{{ JSON.stringify(item.properties, null, 2) }}</pre>
          </details>
        </article>
      </div>
      <RumPager
        v-if="events.data.value"
        v-model="page"
        :total="events.data.value.total"
        :limit="events.data.value.limit"
      />
    </RumState>
  </t-card>
</template>

<style scoped lang="less">
.events-panel {
  min-width: 0;

  &__hint {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    padding: 0 0 16px;
    border-bottom: 1px solid @beacon-border;

    > div {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    span {
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    strong {
      font-size: 24px;
      font-weight: 600;
      line-height: 32px;
      font-variant-numeric: tabular-nums;
    }
  }

  &__charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    padding: 16px 0;
    border-bottom: 1px solid @beacon-border;

    h3 {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: @beacon-font-weight-medium;
    }
  }

  &__details {
    padding: 14px 0;
    border-bottom: 1px solid @beacon-border;
    color: @beacon-text-secondary;
    font-size: 12px;

    summary {
      cursor: pointer;
    }

    p {
      margin: 6px 0;
    }
  }

  &__list {
    border-top: 1px solid @beacon-border;
  }

  &__head,
  .events-panel__row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 220px 180px 110px;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__head {
    color: @beacon-text-secondary;
    font-size: 12px;
    background: @beacon-bg-page;
  }

  &__row {
    min-width: 0;
  }

  &__row:hover {
    background: @beacon-bg-page;
  }

  &__name {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    color: @beacon-text-secondary;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;

    small {
      color: @beacon-text-tertiary;
    }
  }

  &__time {
    overflow: hidden;
    color: @beacon-text-secondary;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__properties {
    font-size: 12px;
    color: @beacon-text-secondary;

    summary {
      cursor: pointer;
    }
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    color: @beacon-text-tertiary;
  }
}

pre {
  max-height: 320px;
  margin: 8px 0 0;
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: @beacon-bg-page;
  border: 1px solid @beacon-border;
}

@media (max-width: 1100px) {
  .events-panel__head,
  .events-panel .events-panel__row {
    grid-template-columns: minmax(160px, 1fr) 200px 110px;
  }

  .events-panel__head > :nth-child(3),
  .events-panel__time {
    display: none;
  }
}

@media (max-width: 700px) {
  .events-panel__kpis {
    grid-template-columns: minmax(0, 1fr);
  }

  .events-panel__head {
    display: none;
  }

  .events-panel .events-panel__row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 16px;
    padding: 16px 8px;
  }

  .events-panel__name {
    grid-column: 1 / -1;
  }
}
</style>
