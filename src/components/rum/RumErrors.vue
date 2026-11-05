<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { listRumErrors, updateRumError } from '@/api/modules/rum'
import type {
  RumErrorGroup,
  RumErrorStatus,
  RumErrorStatusFilter,
} from '@/api/types/rum'
import { MessagePlugin } from 'tdesign-vue-next'
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
  status: (['ALL', 'UNRESOLVED', 'RESOLVED', 'IGNORED'].includes(
    queryString('errorStatus'),
  )
    ? queryString('errorStatus')
    : 'UNRESOLVED') as RumErrorStatusFilter,
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
const columns = [
  { colKey: 'message', title: t('rum.errorMessage'), ellipsis: true },
  { colKey: 'status', title: t('rum.status'), width: 150 },
  { colKey: 'type', title: t('rum.type'), width: 160 },
  { colKey: 'release', title: t('rum.release'), width: 140 },
  { colKey: 'count', title: t('rum.count'), width: 100 },
  { colKey: 'lastSeenAt', title: t('rum.lastSeen'), width: 190 },
]
const statusOptions = computed(() => [
  { value: 'UNRESOLVED', label: t('rum.statusUnresolved') },
  { value: 'RESOLVED', label: t('rum.statusResolved') },
  { value: 'IGNORED', label: t('rum.statusIgnored') },
])
const filterOptions = computed(() => [
  { value: 'UNRESOLVED', label: t('rum.statusUnresolved') },
  { value: 'RESOLVED', label: t('rum.statusResolved') },
  { value: 'IGNORED', label: t('rum.statusIgnored') },
  { value: 'ALL', label: t('rum.statusAll') },
])
const updating = ref<string | null>(null)
async function changeStatus(row: RumErrorGroup, status: RumErrorStatus) {
  if (updating.value) return
  updating.value = row.id
  try {
    await updateRumError(p.value, a.value, row.id, { status })
    await resource.reload()
  } catch {
    void MessagePlugin.error(t('rum.statusUpdateFailed'))
  } finally {
    updating.value = null
  }
}
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
      errorStatus:
        filters.value.status === 'UNRESOLVED'
          ? undefined
          : filters.value.status,
      errorPage: String(page.value),
    },
  })
}
function search() {
  page.value = 1
  filters.value = { ...draft }
  persist()
}
function errorTarget(id: string) {
  return {
    name: 'rum-error-detail',
    params: { projectId: p.value, appId: a.value, errorId: id },
    query: { ...route.query, tab: 'errors' },
  }
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
  <t-card class="rum-errors">
    <template #title>{{ t('rum.errors') }}</template>
    <template #actions>
      <span class="rum-errors__total">
        {{ t('rum.total') }}: {{ resource.data.value?.total ?? '—' }}
      </span>
    </template>
    <form
      class="filters rum-filter"
      @submit.prevent="search"
    >
      <t-input
        v-model="draft.search"
        class="rum-filter__field"
        :placeholder="t('rum.search')"
      /><t-input
        v-model="draft.type"
        class="rum-filter__field"
        :placeholder="t('rum.type')"
      /><t-input
        v-model="draft.release"
        class="rum-filter__field"
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
        v-model="draft.status"
        class="rum-filter__field"
        :options="filterOptions"
      /><t-select
        v-model="draft.sortBy"
        class="rum-filter__field"
        :options="[
          { value: 'lastSeenAt', label: t('rum.lastSeen') },
          { value: 'firstSeenAt', label: t('rum.firstSeen') },
          { value: 'count', label: t('rum.count') },
        ]"
      /><t-select
        v-model="draft.sortOrder"
        class="rum-filter__field"
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
    >
      <template v-if="resource.data.value">
        <t-table
          row-key="id"
          :data="resource.data.value.items"
          :columns="columns"
          :empty="t('rum.empty')"
          hover
        >
          <template #message="{ row }"
            ><router-link :to="errorTarget(row.id)">{{
              row.message
            }}</router-link></template
          >
          <template #status="{ row }">
            <t-select
              :value="row.status"
              size="small"
              :options="statusOptions"
              :loading="updating === row.id"
              @change="
                (value: unknown) => changeStatus(row, value as RumErrorStatus)
              "
            />
            <t-tag
              v-if="row.reopenedAt"
              class="rum-errors__reopened"
              theme="warning"
              variant="light"
              size="small"
              >{{ t('rum.reopened') }}</t-tag
            >
          </template>
          <template #count="{ row }">
            <span class="rum-errors__count">{{ row.count }}</span>
          </template>
          <template #lastSeenAt="{ row }">{{ row.lastSeenAt || '—' }}</template>
        </t-table>
        <RumPager
          v-model="page"
          :total="resource.data.value.total"
          :limit="resource.data.value.limit"
        />
      </template>
    </RumState>
  </t-card>
</template>
<style scoped lang="less">
.rum-errors {
  min-width: 0;

  &__total {
    color: @beacon-text-secondary;
  }

  &__count {
    font-variant-numeric: tabular-nums;
  }

  &__reopened {
    margin-left: 6px;
  }
}
</style>
