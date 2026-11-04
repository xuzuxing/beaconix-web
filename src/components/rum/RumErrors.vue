<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { listRumErrors } from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumState from './RumState.vue'
import RumPager from './RumPager.vue'
const { t } = useI18n()
const { projectId: p, appId: a, router, route } = useRumContext()
function queryString(key: string) {
  return typeof route.query[key] === 'string'
    ? (route.query[key] as string)
    : ''
}
const page = ref(
  Math.max(1, Number.parseInt(queryString('errorPage'), 10) || 1),
)
const draft = reactive({
  search: queryString('errorSearch'),
  type: queryString('errorType'),
  release: queryString('errorRelease'),
  from: queryString('errorFrom'),
  to: queryString('errorTo'),
  sortBy: ['lastSeenAt', 'firstSeenAt', 'count'].includes(
    queryString('errorSort'),
  )
    ? queryString('errorSort')
    : 'lastSeenAt',
  sortOrder: queryString('errorOrder') === 'asc' ? 'asc' : 'desc',
})
const filters = ref({ ...draft })
const resource = useRumResource(
  (signal) =>
    listRumErrors(
      p.value,
      a.value,
      {
        ...filters.value,
        from: filters.value.from
          ? new Date(filters.value.from).toISOString()
          : undefined,
        to: filters.value.to
          ? new Date(filters.value.to).toISOString()
          : undefined,
        page: page.value,
        limit: 20,
      },
      { signal },
    ),
  [p, a, filters, page],
)
function persist() {
  void router.replace({
    query: {
      ...route.query,
      tab: 'errors',
      errorSearch: filters.value.search || undefined,
      errorType: filters.value.type || undefined,
      errorRelease: filters.value.release || undefined,
      errorFrom: filters.value.from || undefined,
      errorTo: filters.value.to || undefined,
      errorSort: filters.value.sortBy,
      errorOrder: filters.value.sortOrder,
      errorPage: String(page.value),
    },
  })
}
function search() {
  page.value = 1
  filters.value = { ...draft }
  persist()
}
watch(page, persist)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => draft.search,
  () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(search, 300)
  },
)
onScopeDispose(() => {
  if (timer) clearTimeout(timer)
})
</script>
<template>
  <form
    class="filters rum-filter"
    @submit.prevent="search"
  >
    <t-input
      class="rum-filter__field"
      v-model="draft.search"
      :placeholder="t('rum.search')"
    /><t-input
      class="rum-filter__field"
      v-model="draft.type"
      :placeholder="t('rum.type')"
    /><t-input
      class="rum-filter__field"
      v-model="draft.release"
      :placeholder="t('rum.release')"
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
    ><t-select
      class="rum-filter__field"
      v-model="draft.sortBy"
      :options="[
        { value: 'lastSeenAt', label: t('rum.lastSeen') },
        { value: 'firstSeenAt', label: t('rum.firstSeen') },
        { value: 'count', label: t('rum.count') },
      ]"
    /><t-select
      class="rum-filter__field"
      v-model="draft.sortOrder"
      :options="[
        { value: 'desc', label: t('rum.desc') },
        { value: 'asc', label: t('rum.asc') },
      ]"
    /><t-button type="submit">{{ t('rum.search') }}</t-button>
  </form>
  <RumState
    :loading="resource.loading.value"
    :error="resource.error.value"
    @retry="resource.reload"
    ><t-empty
      v-if="!resource.data.value?.items.length"
      :description="t('rum.empty')" />
    <div
      v-else
      class="list"
    >
      <article
        v-for="item in resource.data.value.items"
        :key="item.id"
      >
        <t-button
          variant="text"
          @click="
            router.push({
              name: 'rum-error-detail',
              params: { projectId: p, appId: a, errorId: item.id },
              query: { ...route.query, tab: 'errors' },
            })
          "
          >{{ item.message }}</t-button
        >
        <div>
          {{ item.type }} · {{ item.release || '—' }} · {{ t('rum.count') }}:
          {{ item.count }}
        </div>
        <small>{{ t('rum.lastSeen') }}: {{ item.lastSeenAt }}</small>
      </article>
    </div>
    <RumPager
      v-if="resource.data.value"
      v-model="page"
      :total="resource.data.value.total"
      :limit="resource.data.value.limit"
  /></RumState>
</template>
<style scoped>
.list {
  display: grid;
  gap: 8px;
}
.list article {
  border-bottom: 1px solid var(--td-border-level-1-color);
  padding: 12px;
  overflow-wrap: anywhere;
}
.list small {
  color: var(--td-text-color-secondary);
}
</style>
