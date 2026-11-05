<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listRumEvents, getRumEventStats } from '@/api/modules/rum'
import type { RumEvent } from '@/api/types/rum'
import ChartCard from '@/components/charts/ChartCard.vue'
import EChart from '@/components/charts/EChart.vue'
import { useChartTheme } from '@/components/charts/chartTheme'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumKpiGrid from './RumKpiGrid.vue'
import RumState from './RumState.vue'
import RumPager from './RumPager.vue'
const { t } = useI18n()
const { projectId: p, appId: a } = useRumContext()
const page = ref(1)
const days = ref(7)
const draftDays = ref(7)
const chartTheme = useChartTheme()
const selected = ref<RumEvent | null>(null)
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
const columns = computed(() => [
  { colKey: 'eventName', title: t('rum.eventName') },
  { colKey: 'actor', title: t('rum.actor'), width: 200 },
  { colKey: 'sessionId', title: t('rum.sessionId'), width: 180 },
  { colKey: 'page', title: t('rum.page'), width: 180 },
  { colKey: 'occurred', title: t('rum.occurred'), width: 190 },
  { colKey: 'action', title: '', width: 100 },
])
const summary = computed(() => [
  {
    key: 'total',
    label: t('rum.total'),
    value: stats.data.value?.total,
    hint: t('rum.recent7'),
  },
  {
    key: 'actors',
    label: t('rum.actors'),
    value: stats.data.value?.uniqueActors,
    hint: t('rumProject.retained'),
  },
  {
    key: 'sessions',
    label: t('rum.sessions'),
    value: stats.data.value?.uniqueSessions,
    hint: t('rumProject.retained'),
  },
])
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
function actorOf(row: RumEvent) {
  return row.endUserId || row.anonymousId || '—'
}
</script>
<template>
  <t-card class="rum-events">
    <template #title>{{ t('rumProject.events') }}</template>
    <template #actions>
      <span class="rum-events__scope">{{ t('rum.days') }}: {{ days }}</span>
    </template>
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
          v-model="draft.eventName"
          class="rum-filter__field"
          :placeholder="t('rum.eventName')"
        /><t-input
          v-model="draft.sessionId"
          class="rum-filter__field"
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
    >
      <template v-if="stats.data.value">
        <RumKpiGrid
          class="rum-events__kpis"
          :items="summary"
        />
        <div class="rum-events__charts">
          <ChartCard
            :title="t('rum.trend')"
            height="240px"
          >
            <EChart
              :option="trend"
              height="100%"
            />
          </ChartCard>
          <ChartCard
            :title="t('rum.topEvents')"
            height="240px"
          >
            <EChart
              :option="top"
              height="100%"
            />
          </ChartCard>
        </div>
      </template>
    </RumState>
  </t-card>
  <t-card class="rum-events rum-events--records">
    <template #title>{{ t('rum.events') }}</template>
    <template #actions>
      <span class="rum-events__scope">
        {{ t('rum.total') }}: {{ events.data.value?.total ?? '—' }}
      </span>
    </template>
    <RumState
      :loading="events.loading.value"
      :error="events.error.value"
      @retry="events.reload"
    >
      <template v-if="events.data.value">
        <t-table
          row-key="id"
          :data="events.data.value.items"
          :columns="columns"
          :empty="t('rum.empty')"
          hover
        >
          <template #actor="{ row }">{{ actorOf(row) }}</template>
          <template #sessionId="{ row }">{{ row.sessionId || '—' }}</template>
          <template #page="{ row }">{{ row.page || '—' }}</template>
          <template #occurred="{ row }">{{
            row.occurredAt || row.receivedAt
          }}</template>
          <template #action="{ row }"
            ><t-link
              theme="primary"
              @click="selected = row"
              >{{ t('rum.properties') }}</t-link
            ></template
          >
        </t-table>
        <RumPager
          v-model="page"
          :total="events.data.value.total"
          :limit="events.data.value.limit"
        />
      </template>
    </RumState>
  </t-card>
  <t-dialog
    :visible="!!selected"
    :header="t('rum.properties')"
    :footer="false"
    @close="selected = null"
  >
    <pre class="rum-events__properties">{{
      JSON.stringify(selected?.properties, null, 2)
    }}</pre>
  </t-dialog>
</template>
<style scoped lang="less">
.rum-events {
  min-width: 0;
  margin-bottom: @beacon-gap-l;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__kpis {
    margin-bottom: @beacon-gap-l;
  }

  &__charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: @beacon-gap-l;
  }

  &__properties {
    max-height: 55vh;
    margin: 0;
    padding: 12px;
    overflow: auto;
    font-family: @beacon-font-family-code;
    font-size: @beacon-font-size-base;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background-color: @beacon-bg-active;
  }
}
</style>
