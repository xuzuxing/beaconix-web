<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { reactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getRumPerformanceSeries,
  getRumPerformanceSummary,
  listRumPerformancePages,
  listRumPerformanceResources,
} from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumState from './RumState.vue'
import RumPerformancePages from './RumPerformancePages.vue'
import RumPerformanceResources from './RumPerformanceResources.vue'
import RumPerformanceSummary from './RumPerformanceSummary.vue'
import RumPerformanceTrend from './RumPerformanceTrend.vue'

interface PerformanceFilter {
  release: string
  page: string
  from: string
  to: string
}

const { t } = useI18n()
const { projectId: p, appId: a } = useRumContext()
const draft = reactive<PerformanceFilter>({
  release: '',
  page: '',
  from: '',
  to: '',
})
const filter = shallowRef<PerformanceFilter>({ ...draft })
const resourceMetric = shallowRef<'RESOURCE' | 'HTTP'>('RESOURCE')

function dateParam(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function commonParams() {
  return {
    from: dateParam(filter.value.from),
    to: dateParam(filter.value.to),
  }
}

function detailedParams() {
  return {
    ...commonParams(),
    release: filter.value.release || undefined,
    page: filter.value.page || undefined,
  }
}

const summary = useRumResource(
  (signal) =>
    getRumPerformanceSummary(p.value, a.value, detailedParams(), { signal }),
  [p, a, filter],
)
const series = useRumResource(
  (signal) =>
    getRumPerformanceSeries(p.value, a.value, detailedParams(), { signal }),
  [p, a, filter],
)
const pages = useRumResource(
  (signal) =>
    listRumPerformancePages(
      p.value,
      a.value,
      { ...commonParams(), limit: 20 },
      { signal },
    ),
  [p, a, filter],
)
const resources = useRumResource(
  (signal) =>
    listRumPerformanceResources(
      p.value,
      a.value,
      { ...commonParams(), metric: resourceMetric.value, limit: 20 },
      { signal },
    ),
  [p, a, filter, resourceMetric],
)

function search() {
  filter.value = { ...draft }
}

function retryOverview() {
  void summary.reload()
  void series.reload()
}
</script>

<template>
  <t-card class="performance-filter-card">
    <form
      class="rum-filter performance-filter"
      @submit.prevent="search"
    >
      <t-input
        v-model="draft.release"
        class="rum-filter__field"
        :placeholder="t('rum.release')"
      />
      <t-input
        v-model="draft.page"
        class="rum-filter__field"
        :placeholder="t('rum.page')"
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
  </t-card>

  <div class="performance-sections">
    <RumState
      :loading="summary.loading.value || series.loading.value"
      :error="summary.error.value || series.error.value"
      @retry="retryOverview"
    >
      <RumPerformanceSummary
        v-if="summary.data.value && series.data.value"
        :summary="summary.data.value"
        :series="series.data.value.series"
      />
      <RumPerformanceTrend
        v-if="series.data.value"
        :series="series.data.value.series"
      />
    </RumState>
    <RumState
      :loading="pages.loading.value"
      :error="pages.error.value"
      @retry="pages.reload"
    >
      <RumPerformancePages
        v-if="pages.data.value"
        :items="pages.data.value.items"
      />
    </RumState>
    <RumState
      :loading="resources.loading.value"
      :error="resources.error.value"
      @retry="resources.reload"
    >
      <RumPerformanceResources
        v-if="resources.data.value"
        :items="resources.data.value.items"
        :metric="resourceMetric"
        @change-metric="resourceMetric = $event"
      />
    </RumState>
  </div>
</template>

<style scoped>
.performance-filter {
  margin-bottom: 0;
}

.performance-filter-card {
  margin-bottom: 20px;
}

.performance-sections {
  display: grid;
  gap: 24px;
}
</style>
