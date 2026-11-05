<script setup lang="ts">
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
const columns = computed(() =>
  props.kind === 'errors'
    ? [
        { colKey: 'message', title: t('rum.errorMessage'), ellipsis: true },
        { colKey: 'type', title: t('rum.type'), width: 160 },
        { colKey: 'app', title: t('rumProject.appName'), width: 170 },
        { colKey: 'count', title: t('rum.count'), width: 100 },
        { colKey: 'lastSeenAt', title: t('rum.lastSeen'), width: 190 },
      ]
    : [
        { colKey: 'eventName', title: t('rumProject.eventType') },
        { colKey: 'app', title: t('rumProject.appName'), width: 170 },
        { colKey: 'sessionId', title: t('rum.sessionId'), ellipsis: true },
        { colKey: 'receivedAt', title: t('rumProject.occurred'), width: 190 },
        { colKey: 'action', title: '', width: 110 },
      ],
)
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
  <section class="rum-project">
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
    <t-card
      v-else
      class="rum-project__card"
    >
      <template #title>{{ t(`rumProject.${kind}`) }}</template>
      <template #actions>
        <span class="rum-project__scope">
          {{ org.currentOrganization?.name ?? '-' }} /
          {{ org.currentProject?.name ?? '-' }}
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
          >{{ t('rumProject.apply') }}</t-button
        >
        <t-button
          variant="outline"
          @click="reset"
          >{{ t('rumProject.reset') }}</t-button
        >
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
          <t-table
            row-key="id"
            :data="resource.data.value.items"
            :columns="columns"
            :empty="t('rum.empty')"
            hover
          >
            <template #message="{ row }"
              ><t-link
                theme="primary"
                @click="viewError(row)"
                >{{ row.message }}</t-link
              ></template
            >
            <template #app="{ row }">{{ row.app.name }}</template>
            <template #lastSeenAt="{ row }">{{
              formatTime(row.lastSeenAt)
            }}</template>
            <template #receivedAt="{ row }">{{
              formatTime(row.receivedAt)
            }}</template>
            <template #action="{ row }"
              ><t-link
                theme="primary"
                @click="selectedEvent = row"
                >{{ t('rum.properties') }}</t-link
              ></template
            >
          </t-table>
          <t-pagination
            class="rum-project__pager"
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
      <pre class="rum-project__properties">{{
        JSON.stringify(selectedEvent?.properties, null, 2)
      }}</pre>
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.rum-project {
  min-width: 0;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__pager {
    display: flex;
    justify-content: flex-end;
    margin-top: @beacon-gap-l;
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
