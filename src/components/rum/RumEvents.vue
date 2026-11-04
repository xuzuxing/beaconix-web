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
  <div class="filters rum-filter">
    <label class="rum-filter__field rum-filter__date rum-filter__period"
      >{{ t('rum.days') }}
      <t-input-number
        v-model="draftDays"
        :min="1"
        :max="90"
        @change="updateDays"
    /></label>
    <form
      class="rum-filter rum-filter__nested"
      @submit.prevent="search"
    >
      <t-input
        class="rum-filter__field"
        v-model="draft.eventName"
        :placeholder="t('rum.eventName')"
      /><t-input
        class="rum-filter__field"
        v-model="draft.sessionId"
        :placeholder="t('rum.sessionId')"
      /><label class="rum-filter__field rum-filter__date"
        >{{ t('rum.from') }}
        <t-date-picker
          v-model="draft.from"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          clearable /></label
      ><label class="rum-filter__field rum-filter__date"
        >{{ t('rum.to') }}
        <t-date-picker
          v-model="draft.to"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          clearable /></label
      ><t-button type="submit">{{ t('rum.search') }}</t-button>
    </form>
  </div>
  <RumState
    :loading="stats.loading.value"
    :error="stats.error.value"
    @retry="stats.reload"
    ><template v-if="stats.data.value"
      ><div class="summary">
        <span
          >{{ t('rum.total') }}: <b>{{ stats.data.value.total }}</b></span
        ><span
          >{{ t('rum.actors') }}:
          <b>{{ stats.data.value.uniqueActors }}</b></span
        ><span
          >{{ t('rum.sessions') }}:
          <b>{{ stats.data.value.uniqueSessions }}</b></span
        >
      </div>
      <div class="charts">
        <div>
          <h3>{{ t('rum.trend') }}</h3>
          <EChart
            :option="trend"
            height="240px"
          />
        </div>
        <div>
          <h3>{{ t('rum.topEvents') }}</h3>
          <EChart
            :option="top"
            height="240px"
          />
        </div>
      </div>
      <details>
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
      </details></template
    ></RumState
  >
  <RumState
    :loading="events.loading.value"
    :error="events.error.value"
    @retry="events.reload"
    ><t-empty
      v-if="!events.data.value?.items.length"
      :description="t('rum.empty')" />
    <article
      v-for="item in events.data.value?.items"
      :key="item.id"
      class="event"
    >
      <strong>{{ item.eventName }}</strong>
      <p>
        {{ t('rum.actor') }}: {{ item.endUserId || item.anonymousId || '—' }} ·
        {{ t('rum.sessionId') }}: {{ item.sessionId || '—' }}
      </p>
      <p>
        {{ t('rum.occurred') }}: {{ item.occurredAt || '—' }} ·
        {{ t('rum.received') }}: {{ item.receivedAt }}
      </p>
      <details>
        <summary>{{ t('rum.properties') }}</summary>
        <pre>{{ JSON.stringify(item.properties, null, 2) }}</pre>
      </details>
    </article>
    <RumPager
      v-if="events.data.value"
      v-model="page"
      :total="events.data.value.total"
      :limit="events.data.value.limit"
  /></RumState>
</template>
<style scoped>
.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.summary span {
  padding: 16px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
}
.charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.event {
  padding: 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  overflow-wrap: anywhere;
}
.event p {
  margin: 6px 0;
  color: var(--td-text-color-secondary);
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
