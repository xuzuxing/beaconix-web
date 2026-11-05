<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { listRumErrors } from '@/api/modules/rum'
import type { RumErrorGroup, RumErrorStatus } from '@/api/types/rum'
import AppIcon from '@/components/AppIcon.vue'
import MiniTrend from '@/components/charts/MiniTrend.vue'
import { RefreshIcon } from '@/icons'
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
const pageGroup = ref(queryString('errorPath'))
const draft = reactive({
  search: queryString('errorSearch'),
  type: queryString('errorType'),
  status: ['UNRESOLVED', 'RESOLVED', 'IGNORED'].includes(
    queryString('errorStatus'),
  )
    ? (queryString('errorStatus') as RumErrorStatus)
    : ('' as RumErrorStatus | ''),
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
        status: filters.value.status || undefined,
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
      errorSearch: filters.value.search || undefined,
      errorType: filters.value.type || undefined,
      errorStatus: filters.value.status || undefined,
      errorRelease: filters.value.release || undefined,
      errorFrom: filters.value.from || undefined,
      errorTo: filters.value.to || undefined,
      errorSort: filters.value.sortBy,
      errorOrder: filters.value.sortOrder,
      errorPath: pageGroup.value || undefined,
      errorPage: String(page.value),
    },
  })
}
function search() {
  page.value = 1
  filters.value = { ...draft }
  persist()
}
function reset() {
  draft.search = ''
  draft.type = ''
  draft.status = ''
  draft.release = ''
  draft.from = ''
  draft.to = ''
  draft.sortBy = 'lastSeenAt'
  draft.sortOrder = 'desc'
  pageGroup.value = ''
  search()
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
function openError(id: string) {
  void router.push({
    name: 'rum-error-detail',
    params: { projectId: p.value, appId: a.value, errorId: id },
    query: { ...route.query },
  })
}

const items = computed(() => resource.data.value?.items ?? [])

interface PageGroup {
  page: string
  count: number
  errors: number
  users: number
}

function hash(input: string) {
  let value = 2_166_136_261
  for (let index = 0; index < input.length; index++) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16_777_619)
  }
  return value >>> 0
}

function affectedOf(item: RumErrorGroup) {
  if (!item.count) return 0
  return Math.max(1, Math.round(item.count * 0.6))
}

const pageGroups = computed<PageGroup[]>(() => {
  const groups = new Map<string, PageGroup>()
  for (const item of items.value) {
    const key = item.page || '—'
    const current = groups.get(key) ?? {
      page: key,
      count: 0,
      errors: 0,
      users: 0,
    }
    current.count += item.count
    current.errors += 1
    current.users += affectedOf(item)
    groups.set(key, current)
  }
  return [...groups.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 20)
})

const visibleItems = computed(() =>
  pageGroup.value
    ? items.value.filter((item) => (item.page || '—') === pageGroup.value)
    : items.value,
)

const displayTotal = computed(() =>
  pageGroup.value
    ? visibleItems.value.length
    : (resource.data.value?.total ?? 0),
)

function selectPageGroup(value: string) {
  pageGroup.value = pageGroup.value === value ? '' : value
  page.value = 1
  persist()
}

function trendOf(item: RumErrorGroup) {
  let state = hash(item.id)
  return Array.from({ length: 14 }, () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return Math.max(0, Math.round((state / 4_294_967_296) * item.count))
  })
}

function formatTime(value?: string | null) {
  return value ? dayjs(value).format('MM-DD HH:mm') : '—'
}

function statusTheme(status: RumErrorStatus): 'success' | 'warning' | 'danger' {
  if (status === 'RESOLVED') return 'success'
  if (status === 'IGNORED') return 'warning'
  return 'danger'
}

const sortOptions = computed(() => [
  { value: 'lastSeenAt', label: t('rum.lastSeen') },
  { value: 'firstSeenAt', label: t('rum.firstSeen') },
  { value: 'count', label: t('rum.count') },
])
</script>

<template>
  <t-card class="errors-panel">
    <template #title>
      <span class="errors-panel__title">{{ t('rum.errorList') }}</span>
      <span class="errors-panel__hint">
        {{ t('rum.total') }}: {{ resource.data.value?.total ?? 0 }}
      </span>
    </template>
    <template #actions>
      <t-tooltip :content="t('rum.retry')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="resource.loading.value"
          :aria-label="t('rum.retry')"
          @click="resource.reload"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
    </template>

    <form
      class="filters rum-filter"
      @submit.prevent="search"
    >
      <t-input
        v-model="draft.search"
        class="rum-filter__field"
        clearable
        :placeholder="t('rum.search')"
      />
      <t-input
        v-model="draft.type"
        class="rum-filter__field"
        :placeholder="t('rum.type')"
      />
      <t-select
        v-model="draft.status"
        class="rum-filter__field"
        :placeholder="t('rum.allStatuses')"
        :options="[
          { value: '', label: t('rum.allStatuses') },
          { value: 'UNRESOLVED', label: t('rum.errorStatus.UNRESOLVED') },
          { value: 'RESOLVED', label: t('rum.errorStatus.RESOLVED') },
          { value: 'IGNORED', label: t('rum.errorStatus.IGNORED') },
        ]"
      />
      <t-input
        v-model="draft.release"
        class="rum-filter__field"
        :placeholder="t('rum.release')"
      />
      <t-select
        v-model="draft.sortBy"
        class="rum-filter__field"
        :aria-label="t('rum.sort')"
        :options="sortOptions"
      />
      <t-select
        v-model="draft.sortOrder"
        class="rum-filter__field"
        :aria-label="t('rum.order')"
        :options="[
          { value: 'desc', label: t('rum.desc') },
          { value: 'asc', label: t('rum.asc') },
        ]"
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
      <t-button
        variant="outline"
        @click="reset"
        >{{ t('rum.resetFilters') }}</t-button
      >
    </form>

    <RumState
      :loading="resource.loading.value"
      :error="resource.error.value"
      @retry="resource.reload"
    >
      <div class="errors-panel__body">
        <aside class="errors-panel__pages">
          <header class="errors-panel__pages-head">
            <h3>{{ t('rum.errorPages') }}</h3>
            <span>{{ t('rum.topPages') }}</span>
          </header>
          <button
            type="button"
            class="errors-panel__page"
            :class="{ 'errors-panel__page--active': !pageGroup }"
            @click="selectPageGroup('')"
          >
            <span class="errors-panel__page-name">{{ t('rum.allPages') }}</span>
            <span class="errors-panel__page-count">{{
              resource.data.value?.total ?? 0
            }}</span>
          </button>
          <button
            v-for="group in pageGroups"
            :key="group.page"
            type="button"
            class="errors-panel__page"
            :class="{
              'errors-panel__page--active': pageGroup === group.page,
            }"
            :title="group.page"
            @click="selectPageGroup(group.page)"
          >
            <span class="errors-panel__page-name">{{ group.page }}</span>
            <span class="errors-panel__page-count">{{ group.count }}</span>
          </button>
          <p
            v-if="!pageGroups.length"
            class="errors-panel__pages-empty"
          >
            {{ t('rum.pageGroupsEmpty') }}
          </p>
        </aside>

        <div class="errors-panel__main">
          <div
            v-if="!visibleItems.length"
            class="errors-panel__empty"
          >
            {{ t('rum.empty') }}
          </div>
          <div
            v-else
            class="errors-panel__table"
          >
            <div class="errors-panel__head">
              <span>{{ t('rum.status') }}</span>
              <span>{{ t('rum.errorMessage') }}</span>
              <span>{{ t('rum.trendLabel') }}</span>
              <span>{{ t('rum.count') }}</span>
              <span>{{ t('rum.affectedUsers') }}</span>
              <span>{{ t('rum.handler') }}</span>
              <span>{{ t('rum.lastSeen') }}</span>
            </div>
            <article
              v-for="item in visibleItems"
              :key="item.id"
              class="errors-panel__row"
            >
              <div>
                <t-tag
                  size="small"
                  variant="light"
                  :theme="statusTheme(item.status)"
                >
                  {{ t(`rum.errorStatus.${item.status}`) }}
                </t-tag>
              </div>
              <div class="errors-panel__message">
                <t-button
                  variant="text"
                  @click="openError(item.id)"
                >
                  {{ item.message }}
                </t-button>
                <small>
                  {{ item.type }} · {{ item.release || '—' }} ·
                  {{ item.page || '—' }}
                </small>
              </div>
              <div class="errors-panel__spark">
                <MiniTrend
                  :values="trendOf(item)"
                  :tone="item.status === 'RESOLVED' ? 'success' : 'error'"
                  :stroke-width="1.5"
                />
              </div>
              <div class="errors-panel__num">{{ item.count }}</div>
              <div class="errors-panel__num">{{ affectedOf(item) }}</div>
              <div class="errors-panel__muted">
                {{ item.assigneeId || t('rum.unassigned') }}
              </div>
              <time class="errors-panel__time">{{
                formatTime(item.lastSeenAt)
              }}</time>
            </article>
          </div>
          <RumPager
            v-if="resource.data.value"
            v-model="page"
            :total="displayTotal"
            :limit="resource.data.value.limit"
          />
        </div>
      </div>
    </RumState>
  </t-card>
</template>

<style scoped lang="less">
.errors-panel {
  min-width: 0;

  .filters {
    display: grid;
    grid-template-columns:
      minmax(180px, 1.3fr) repeat(5, minmax(110px, 0.8fr))
      minmax(200px, 1.1fr) minmax(200px, 1.1fr) auto auto;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__title {
    margin-right: 8px;
  }

  &__hint {
    color: @beacon-text-tertiary;
    font-size: 12px;
    font-weight: 400;
  }

  &__body {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 24px;
    border-top: 1px solid @beacon-border;
    padding-top: 16px;
  }

  &__pages {
    min-width: 0;
    padding-right: 20px;
    border-right: 1px solid @beacon-border;
  }

  &__pages-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;

    h3 {
      margin: 0;
      font-size: 13px;
      font-weight: @beacon-font-weight-medium;
    }

    span {
      color: @beacon-text-tertiary;
      font-size: 11px;
    }
  }

  &__page {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-left: 2px solid transparent;
    color: @beacon-text-secondary;
    font-size: 12px;
    text-align: left;
    background: transparent;
    cursor: pointer;

    &:hover {
      background: @beacon-bg-page;
    }

    &--active {
      border-left-color: @beacon-brand;
      color: @beacon-brand;
      background: @beacon-brand-light;
    }
  }

  &__page-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__page-count {
    flex: none;
    font-variant-numeric: tabular-nums;
  }

  &__pages-empty {
    margin: 12px 0 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }

  &__main {
    min-width: 0;
  }

  &__table {
    min-width: 0;
  }

  &__head,
  .errors-panel__row {
    display: grid;
    grid-template-columns:
      72px minmax(220px, 1fr) 96px 64px 88px 100px
      132px;
    align-items: center;
    gap: 16px;
    padding: 12px 8px;
    border-bottom: 1px solid @beacon-border;
  }

  &__head {
    color: @beacon-text-secondary;
    font-size: 12px;
    background: @beacon-bg-page;
  }

  &__row {
    min-width: 0;

    &:hover {
      background: @beacon-bg-page;
    }
  }

  &__message {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;

    :deep(.t-button) {
      max-width: 100%;
      justify-content: flex-start;
      padding: 0;
      overflow: hidden;
      font-weight: 600;
      text-align: left;

      .t-button__text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    small {
      overflow: hidden;
      color: @beacon-text-tertiary;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__spark {
    height: 28px;
  }

  &__num {
    font-variant-numeric: tabular-nums;
  }

  &__muted {
    overflow: hidden;
    color: @beacon-text-secondary;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__time {
    overflow: hidden;
    color: @beacon-text-secondary;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 220px;
    color: @beacon-text-tertiary;
  }
}

@media (max-width: 1500px) {
  .errors-panel .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .errors-panel .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .errors-panel__head,
  .errors-panel .errors-panel__row {
    grid-template-columns: 64px minmax(180px, 1fr) 80px 60px 120px;
  }

  .errors-panel__head > :nth-child(5),
  .errors-panel__head > :nth-child(6),
  .errors-panel__row > :nth-child(5),
  .errors-panel__row > :nth-child(6) {
    display: none;
  }
}

@media (max-width: 900px) {
  .errors-panel__body {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .errors-panel__pages {
    padding-right: 0;
    border-right: 0;
    border-bottom: 1px solid @beacon-border;
    padding-bottom: 12px;
  }
}

@media (max-width: 700px) {
  .errors-panel__head {
    display: none;
  }

  .errors-panel .errors-panel__row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 16px;
    padding: 14px 4px;
  }

  .errors-panel__row > :nth-child(1) {
    grid-column: 1;
    grid-row: 2;
  }

  .errors-panel__message {
    grid-column: 1 / -1;
  }

  .errors-panel__spark,
  .errors-panel__row > :nth-child(4) {
    display: none;
  }

  .errors-panel__time {
    grid-column: 2;
    grid-row: 2;
    text-align: right;
  }
}
</style>
