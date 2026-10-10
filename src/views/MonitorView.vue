<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { Monitor, MonitorStatus, MonitorType } from '@/api/types'
import AppIcon from '@/components/AppIcon.vue'
import MonitorActions from '@/components/monitor/MonitorActions.vue'
import MonitorEditorDialog from '@/components/monitor/MonitorEditorDialog.vue'
import MonitorStatusTag from '@/components/monitor/MonitorStatusTag.vue'
import { useMonitorAccess } from '@/composables/useMonitorAccess'
import { useMonitorActions } from '@/composables/useMonitorActions'
import { useMonitorList } from '@/composables/useMonitorList'
import { PlusSignIcon, RefreshIcon, Search01Icon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import {
  formatMonitorTime,
  monitorStatus,
  selectMonitors,
  type MonitorSort,
} from '@/utils/monitor-presenter'

defineOptions({ name: 'MonitorView' })
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const org = useOrganizationStore()
const projectId = computed(() => org.currentProjectId)
const { canManage, canCheck } = useMonitorAccess()
const { monitors, loading, error, load } = useMonitorList(projectId)
const dialog = ref(false)
const editing = ref<Monitor>()
const statuses: MonitorStatus[] = ['UP', 'DOWN', 'DEGRADED', 'PAUSED', 'UNKNOWN']
const protocols: MonitorType[] = [
  'HTTP',
  'TCP',
  'PING',
  'DNS',
  'MYSQL',
  'POSTGRESQL',
  'REDIS',
  'MONGODB',
  'DOCKER',
  'GRPC',
  'WEBSOCKET',
]
const queryValue = (key: string) =>
  typeof route.query[key] === 'string' ? (route.query[key] as string) : ''
function setFilter(key: string, value: string | number) {
  void router.replace({
    query: {
      ...route.query,
      [key]: value === 'all' || value === '' ? undefined : String(value),
      page: undefined,
    },
  })
}
const search = computed({ get: () => queryValue('q'), set: (value) => setFilter('q', value) })
const status = computed({
  get: () =>
    statuses.includes(queryValue('status') as MonitorStatus)
      ? (queryValue('status') as MonitorStatus)
      : ('all' as const),
  set: (value) => setFilter('status', value),
})
const types = computed(() =>
  [
    ...new Set([
      ...monitors.value.map((m) => m.type),
      ...(protocols.includes(queryValue('type') as MonitorType)
        ? [queryValue('type') as MonitorType]
        : []),
    ]),
  ].sort(),
)
const type = computed({
  get: () =>
    protocols.includes(queryValue('type') as MonitorType)
      ? (queryValue('type') as MonitorType)
      : ('all' as const),
  set: (value) => setFilter('type', value),
})
const sort = computed({
  get: () =>
    ['newest', 'name', 'status', 'latency'].includes(queryValue('sort'))
      ? (queryValue('sort') as MonitorSort)
      : 'status',
  set: (value) => setFilter('sort', value),
})
const pageSize = computed(() =>
  [10, 20, 50].includes(Number(queryValue('size'))) ? Number(queryValue('size')) : 10,
)
const filtered = computed(() =>
  selectMonitors(monitors.value, search.value, status.value, type.value, sort.value),
)
const page = computed(() =>
  Math.min(
    Math.max(1, Math.floor(Number(queryValue('page'))) || 1),
    Math.max(1, Math.ceil(filtered.value.length / pageSize.value)),
  ),
)
const rows = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)
// 切换项目时关闭编辑弹窗；列表本身由 useMonitorList 负责重载
watch(
  projectId,
  () => {
    dialog.value = false
  },
  { flush: 'sync' },
)
const { pending, actionError, act } = useMonitorActions(projectId, async () => {
  await load()
})
function edit(monitor?: Monitor) {
  editing.value = monitor
  dialog.value = true
}
function detail(monitor: Monitor) {
  return {
    name: 'monitor-detail',
    params: { projectId: projectId.value, monitorId: monitor.id },
    query: route.query,
  }
}
function paginate({ current, pageSize: size }: { current: number; pageSize: number }) {
  void router.replace({ query: { ...route.query, page: String(current), size: String(size) } })
}
</script>

<template>
  <section class="monitor-page">
    <!-- 页面级操作注入内容区标题栏右侧的动作区（defer：目标在同一渲染周期内创建） -->
    <Teleport defer to="#layout-header-actions">
      <t-tooltip :content="t('monitorPage.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!projectId"
          :aria-label="t('monitorPage.refresh')"
          @click="load"
          ><AppIcon :icon="RefreshIcon" /></t-button
      ></t-tooltip>
      <t-button v-if="canManage" :disabled="!projectId" @click="edit()"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('workspace.monitor.create') }}</t-button
      >
    </Teleport>
    <t-card class="monitor-page__panel">
      <template #title>{{ t('monitorPage.title') }}</template>
      <template #actions>
        <span class="monitor-page__scope">
          {{ org.currentOrganization?.name ?? '-' }} / {{ org.currentProject?.name ?? '-' }}
        </span>
      </template>
      <t-alert v-if="actionError" theme="error" :message="actionError" />
      <div class="monitor-page__filters">
        <t-input
          v-model="search"
          clearable
          :placeholder="t('monitorPage.search')"
          :aria-label="t('monitorPage.search')"
          ><template #prefix-icon><AppIcon :icon="Search01Icon" /></template
        ></t-input>
        <t-select
          v-model="status"
          :aria-label="t('monitorPage.allStatuses')"
          :options="[
            { label: t('monitorPage.allStatuses'), value: 'all' },
            ...statuses.map((value) => ({ label: t(`workspace.monitor.status.${value}`), value })),
          ]"
        />
        <t-select
          v-model="type"
          :aria-label="t('monitorPage.allTypes')"
          :options="[
            { label: t('monitorPage.allTypes'), value: 'all' },
            ...types.map((value) => ({ label: value, value })),
          ]"
        />
        <t-select
          v-model="sort"
          :aria-label="t('monitorPage.sort')"
          :options="
            ['status', 'newest', 'name', 'latency'].map((value) => ({
              label: t(
                `monitorPage.${value === 'newest' ? 'newest' : value === 'status' ? 'statusSort' : value === 'name' ? 'nameSort' : 'latencySort'}`,
              ),
              value,
            }))
          "
        />
      </div>
      <div v-if="error" class="monitor-page__empty">
        <t-alert theme="error" :message="error" /><t-button @click="load">{{
          t('monitorPage.retry')
        }}</t-button>
      </div>
      <div v-else-if="loading" class="monitor-page__empty">
        <t-loading :text="t('common.loading')" />
      </div>
      <div v-else-if="!projectId" class="monitor-page__empty">
        {{ t('monitorPage.noProjectData') }}
      </div>
      <template v-else-if="rows.length">
        <div class="monitor-page__table">
          <div class="monitor-page__table-head">
            <span>{{ t('monitorPage.name') }}</span
            ><span>{{ t('monitorPage.lastLatency') }}</span
            ><span>{{ t('monitorPage.lastCheck') }}</span
            ><span>{{ t('monitorPage.actions') }}</span>
          </div>
          <article
            v-for="monitor in rows"
            :key="monitor.id"
            class="monitor-row"
            @click="router.push(detail(monitor))"
          >
            <div class="monitor-row__identity">
              <div class="monitor-row__name">
                <RouterLink :to="detail(monitor)" @click.stop>{{ monitor.name }}</RouterLink
                ><MonitorStatusTag :status="monitorStatus(monitor)" /><span
                  class="monitor-row__protocol"
                  >{{ monitor.type }}</span
                >
              </div>
              <p class="monitor-row__target" :title="monitor.target">{{ monitor.target }}</p>
              <p v-if="monitor.lastError" class="monitor-row__error" :title="monitor.lastError">
                {{ monitor.lastError }}
              </p>
              <p v-if="monitor.executionEligible === false" class="monitor-row__error">
                {{ t('monitorPage.executionBlocked') }} · {{ monitor.executionBlockedReason }}
              </p>
            </div>
            <div class="monitor-row__latency">
              <span>{{ monitor.lastLatency == null ? '-' : `${monitor.lastLatency} ms` }}</span
              ><small>{{ t('monitorPage.seconds', { value: monitor.interval }) }}</small>
            </div>
            <time class="monitor-row__time">{{
              monitor.lastCheckAt
                ? formatMonitorTime(monitor.lastCheckAt, locale)
                : t('monitorPage.never')
            }}</time>
            <MonitorActions
              :monitor="monitor"
              :pending="pending[monitor.id]"
              :can-manage="canManage"
              :can-check="canCheck"
              @edit="edit(monitor)"
              @action="act(projectId, monitor, $event)"
            />
          </article>
        </div>
        <t-pagination
          :total="filtered.length"
          :current="page"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>
      <div v-else class="monitor-page__empty">
        <p>{{ t(monitors.length ? 'monitorPage.noMatches' : 'workspace.monitor.empty') }}</p>
        <t-button v-if="monitors.length" variant="outline" @click="router.replace({ query: {} })">{{
          t('monitorPage.reset')
        }}</t-button>
      </div>
    </t-card>
    <MonitorEditorDialog
      v-model:visible="dialog"
      :project-id="projectId"
      :monitor="editing"
      @saved="
        (id) => {
          if (id === projectId) void load()
        }
      "
    />
  </section>
</template>

<style scoped lang="less">
.monitor-page {
  min-width: 0;
  &__scope {
    color: @beacon-text-secondary;
  }
  &__filters {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 130px 120px 160px;
    gap: 8px;
    margin-bottom: 16px;
  }
  // 表头与行之间用 1px 分割线；白底与边框由卡片（.t-card）提供
  &__table {
    border-top: 1px solid @beacon-border;
  }
  &__table-head,
  .monitor-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 100px 168px 128px;
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
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    min-height: 240px;
    justify-content: center;
  }
  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}
.monitor-row {
  cursor: pointer;
  &:hover {
    background: @beacon-bg-page;
  }
  &__identity {
    min-width: 0;
  }
  &__name {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    a {
      color: @beacon-text-primary;
      font-weight: 600;
      overflow-wrap: anywhere;
      &:hover {
        color: @beacon-brand;
      }
    }
  }
  &__protocol {
    color: @beacon-text-tertiary;
    font-size: 11px;
  }
  &__target,
  &__error {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 6px 0 0;
    font-size: 12px;
    color: @beacon-text-secondary;
  }
  &__error {
    color: @beacon-error;
  }
  &__latency {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-variant-numeric: tabular-nums;
    small {
      color: @beacon-text-tertiary;
    }
  }
  &__time {
    color: @beacon-text-secondary;
    font-size: 12px;
  }
}
@media (max-width: 1200px) {
  .monitor-page__table-head,
  .monitor-page .monitor-row {
    grid-template-columns: minmax(150px, 1fr) 90px 128px;
  }
  .monitor-page__table-head > :nth-child(3),
  .monitor-row__time {
    display: none;
  }
}
@media (max-width: 600px) {
  .monitor-page__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    > :first-child {
      grid-column: 1 / -1;
    }
  }
  .monitor-page__table-head {
    display: none;
  }
  .monitor-page .monitor-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 16px 8px;
  }
  .monitor-row__identity {
    grid-column: 1 / -1;
  }
  .monitor-row__latency {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
}
</style>
