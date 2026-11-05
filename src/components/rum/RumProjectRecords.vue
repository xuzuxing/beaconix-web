<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  listProjectRumErrors,
  listProjectRumEvents,
  getProjectRumOverview,
} from '@/api/modules/rum'
import type { RumProjectError, RumProjectEvent } from '@/api/types/rum'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { RefreshIcon } from '@/icons'
import { useRumResource } from '@/composables/useRumResource'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import RumState from './RumState.vue'

const props = defineProps<{ kind: 'errors' | 'events' }>()
const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const org = useOrganizationStore()
const permissions = usePermissionsStore()
const projectId = computed(() => org.currentProjectId)
const canRead = computed(
  () =>
    !!projectId.value && permissions.canProject(projectId.value, 'rum.read'),
)
const queryString = (key: string) =>
  typeof route.query[key] === 'string' ? (route.query[key] as string) : ''
const restore =
  props.kind === 'errors' && queryString('scope') === projectId.value
const initialFrom =
  restore && dayjs(queryString('from')).isValid() ? queryString('from') : ''
const initialTo =
  restore && dayjs(queryString('to')).isValid() ? queryString('to') : ''
const initialPage = Number(queryString('page'))
const initialSize = Number(queryString('size'))
const page = ref(
  restore && Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1,
)
const size = ref(
  restore && [10, 20, 50, 100].includes(initialSize) ? initialSize : 20,
)
const filter = ref({
  appId: restore ? queryString('app').slice(0, 100) : '',
  type: restore ? queryString('type').slice(0, 100) : '',
  from: initialFrom,
  to: initialTo,
})
const draft = reactive({
  appId: filter.value.appId,
  type: filter.value.type,
  range:
    initialFrom && initialTo
      ? [
          dayjs(initialFrom).format('YYYY-MM-DD HH:mm:ss'),
          dayjs(initialTo).format('YYYY-MM-DD HH:mm:ss'),
        ]
      : ([] as string[]),
})
const selectedEvent = ref<RumProjectEvent | null>(null)
const apps = useRumResource(
  (signal) =>
    canRead.value
      ? getProjectRumOverview(projectId.value, { signal })
      : Promise.resolve(null),
  [projectId, canRead],
)
const options = computed(() => [
  { label: t('rumProject.allApps'), value: '' },
  ...(apps.data.value?.apps ?? []).map((app) => ({
    label: app.name,
    value: app.id,
  })),
])
const resource = useRumResource(
  async (signal) => {
    if (!canRead.value) return null
    const params = {
      appId: filter.value.appId || undefined,
      from: filter.value.from || undefined,
      to: filter.value.to || undefined,
      page: page.value,
      limit: size.value,
    }
    return props.kind === 'errors'
      ? listProjectRumErrors(
          projectId.value,
          { ...params, type: filter.value.type || undefined },
          { signal },
        )
      : listProjectRumEvents(
          projectId.value,
          { ...params, eventName: filter.value.type || undefined },
          { signal },
        )
  },
  [projectId, canRead, () => props.kind, filter, page, size],
)
watch(
  [projectId, canRead, () => props.kind],
  () => {
    draft.appId = ''
    draft.type = ''
    draft.range = []
    filter.value = { appId: '', type: '', from: '', to: '' }
    page.value = 1
    selectedEvent.value = null
  },
  { flush: 'sync' },
)
function apply() {
  const [start, end] = draft.range ?? []
  const from = start ? new Date(start) : undefined
  const to = end ? new Date(end) : undefined
  if (
    (from && Number.isNaN(from.getTime())) ||
    (to && Number.isNaN(to.getTime())) ||
    (from && to && from > to)
  ) {
    void MessagePlugin.warning(t('rumProject.rangeInvalid'))
    return
  }
  page.value = 1
  filter.value = {
    appId: draft.appId || '',
    type: draft.type.trim(),
    from: from?.toISOString() ?? '',
    to: to?.toISOString() ?? '',
  }
}
function reset() {
  draft.appId = ''
  draft.type = ''
  draft.range = []
  apply()
}
function viewError(row: RumProjectError) {
  void router.push({
    name: 'rum-error-detail',
    params: { projectId: projectId.value, appId: row.appId, errorId: row.id },
    query: {
      returnTo: 'project-errors',
      scope: projectId.value,
      app: filter.value.appId || undefined,
      type: filter.value.type || undefined,
      from: filter.value.from || undefined,
      to: filter.value.to || undefined,
      page: String(page.value),
      size: String(size.value),
    },
  })
}
function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}
function paginate(info: { current: number; pageSize: number }) {
  size.value = info.pageSize
  page.value = info.current
}
</script>

<template>
  <section class="project-page">
    <HeaderActions>
      <t-tooltip :content="t('rumProject.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="resource.loading.value"
          :disabled="!projectId"
          :aria-label="t('rumProject.refresh')"
          @click="resource.reload"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
    </HeaderActions>

    <t-alert
      v-if="!projectId"
      theme="info"
      :message="t('rumProject.noProject')"
    />
    <t-alert
      v-else-if="!canRead"
      theme="warning"
      :message="t('rum.noPermission')"
    />
    <template v-else>
      <t-card class="project-page__card">
        <template #title>{{ t('rumProject.records') }}</template>
        <template #actions>
          <span class="project-page__hint">
            {{ t('rum.total') }}: {{ resource.data.value?.total ?? 0 }}
          </span>
        </template>

        <div class="filters rum-filter">
          <t-select
            v-model="draft.appId"
            class="rum-filter__field"
            :options="options"
            :aria-label="t('rumProject.appName')"
            :loading="apps.loading.value"
          />
          <t-input
            v-model="draft.type"
            class="rum-filter__field"
            :placeholder="
              t(
                kind === 'errors'
                  ? 'rumProject.typeHint'
                  : 'rumProject.eventHint',
              )
            "
            clearable
            @enter="apply"
          />
          <t-date-range-picker
            v-model="draft.range"
            class="rum-filter__field rum-filter__range"
            allow-input
            enable-time-picker
            format="YYYY-MM-DD HH:mm:ss"
            clearable
            :aria-label="t('rumProject.dateRange')"
          />
          <t-button
            theme="primary"
            @click="apply"
          >
            {{ t('rumProject.apply') }}
          </t-button>
          <t-button
            variant="outline"
            @click="reset"
          >
            {{ t('rumProject.reset') }}
          </t-button>
        </div>

        <t-alert
          v-if="apps.error.value"
          theme="warning"
          :message="t('rum.loadFailed')"
        />
        <RumState
          :loading="resource.loading.value"
          :error="resource.error.value"
          @retry="resource.reload"
        >
          <template v-if="resource.data.value">
            <div
              v-if="resource.data.value.items.length"
              class="project-page__table"
              :class="`project-page__table--${kind}`"
            >
              <div class="project-page__table-head">
                <template v-if="kind === 'errors'">
                  <span>{{ t('rum.errorMessage') }}</span>
                  <span>{{ t('rum.type') }}</span>
                  <span>{{ t('rumProject.appName') }}</span>
                  <span>{{ t('rum.count') }}</span>
                  <span>{{ t('rum.lastSeen') }}</span>
                </template>
                <template v-else>
                  <span>{{ t('rumProject.eventType') }}</span>
                  <span>{{ t('rumProject.appName') }}</span>
                  <span>{{ t('rum.sessionId') }}</span>
                  <span>{{ t('rumProject.occurred') }}</span>
                  <span>{{ t('rumApps.actions') }}</span>
                </template>
              </div>
              <article
                v-for="row in resource.data.value.items"
                :key="row.id"
                class="project-page__row"
              >
                <template v-if="kind === 'errors'">
                  <div class="project-page__message">
                    <t-button
                      variant="text"
                      @click="viewError(row as RumProjectError)"
                    >
                      {{ (row as RumProjectError).message }}
                    </t-button>
                  </div>
                  <div class="project-page__muted">
                    {{ (row as RumProjectError).type }}
                  </div>
                  <div class="project-page__muted">
                    {{ (row as RumProjectError).app.name }}
                  </div>
                  <div class="project-page__num">
                    {{ (row as RumProjectError).count }}
                  </div>
                  <time class="project-page__muted">
                    {{ formatTime((row as RumProjectError).lastSeenAt) }}
                  </time>
                </template>
                <template v-else>
                  <div class="project-page__primary">
                    {{ (row as RumProjectEvent).eventName }}
                  </div>
                  <div class="project-page__muted">
                    {{ (row as RumProjectEvent).app.name }}
                  </div>
                  <div class="project-page__muted">
                    {{ (row as RumProjectEvent).sessionId || '—' }}
                  </div>
                  <time class="project-page__muted">
                    {{ formatTime((row as RumProjectEvent).receivedAt) }}
                  </time>
                  <div>
                    <t-button
                      size="small"
                      variant="text"
                      @click="selectedEvent = row as RumProjectEvent"
                    >
                      {{ t('rum.properties') }}
                    </t-button>
                  </div>
                </template>
              </article>
            </div>
            <div
              v-else
              class="project-page__empty"
            >
              {{ t('rum.empty') }}
            </div>
            <t-pagination
              :current="page"
              :page-size="size"
              :total="resource.data.value.total"
              :page-size-options="[10, 20, 50, 100]"
              @change="paginate"
            />
          </template>
        </RumState>
      </t-card>
      <t-dialog
        :visible="!!selectedEvent"
        :header="t('rum.properties')"
        :footer="false"
        @close="selectedEvent = null"
      >
        <pre>{{ JSON.stringify(selectedEvent?.properties, null, 2) }}</pre>
      </t-dialog>
    </template>
  </section>
</template>

<style scoped lang="less">
.project-page {
  min-width: 0;

  &__card {
    min-width: 0;
  }

  &__hint {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__table {
    border-top: 1px solid @beacon-border;

    &--errors {
      .project-page__table-head,
      .project-page__row {
        grid-template-columns: minmax(240px, 1fr) 150px 160px 90px 180px;
      }
    }

    &--events {
      .project-page__table-head,
      .project-page__row {
        grid-template-columns: minmax(180px, 1fr) 150px 200px 180px 110px;
      }
    }
  }

  &__table-head,
  .project-page__row {
    display: grid;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
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

  &__message {
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
  }

  &__primary {
    min-width: 0;
    overflow: hidden;
    color: @beacon-text-primary;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__muted {
    min-width: 0;
    overflow: hidden;
    color: @beacon-text-secondary;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__num {
    font-variant-numeric: tabular-nums;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    color: @beacon-text-tertiary;
  }

  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

pre {
  max-height: 55vh;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 1200px) {
  .project-page__table--errors {
    .project-page__table-head,
    .project-page__row {
      grid-template-columns: minmax(200px, 1fr) 140px 120px 170px;
    }

    .project-page__table-head > :nth-child(3),
    .project-page__row > :nth-child(3) {
      display: none;
    }
  }

  .project-page__table--events {
    .project-page__table-head,
    .project-page__row {
      grid-template-columns: minmax(160px, 1fr) 140px 170px 100px;
    }

    .project-page__table-head > :nth-child(3),
    .project-page__row > :nth-child(3) {
      display: none;
    }
  }
}

@media (max-width: 700px) {
  .project-page__table-head {
    display: none;
  }

  .project-page__table--errors,
  .project-page__table--events {
    .project-page__row {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px 16px;
      padding: 16px 8px;
    }

    .project-page__row > :first-child {
      grid-column: 1 / -1;
    }
  }
}
</style>
