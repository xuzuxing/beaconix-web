<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  bindRuleGroup,
  getMonitor,
  listMonitorRuleBindings,
  listOrganizations,
  listProjects,
  listRuleGroups,
  unbindRuleGroup,
} from '@/api'
import type { MonitorDetailRange } from '@/api/types/monitor-detail'
import type {
  BoundRuleGroup,
  MonitorRuleBinding,
  RuleGroup,
} from '@/api/types/rule'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import MonitorActions from '@/components/monitor/MonitorActions.vue'
import MonitorDetailCharts from '@/components/monitor/MonitorDetailCharts.vue'
import MonitorEditorDialog from '@/components/monitor/MonitorEditorDialog.vue'
import MonitorEvents from '@/components/monitor/MonitorEvents.vue'
import MonitorRoundDialog from '@/components/monitor/MonitorRoundDialog.vue'
import MonitorStatusTag from '@/components/monitor/MonitorStatusTag.vue'
import RuleGroupEditorDialog from '@/components/rules/RuleGroupEditorDialog.vue'
import RuleTreeView from '@/components/rules/RuleTreeView.vue'
import { useMonitorAccess } from '@/composables/useMonitorAccess'
import { useMonitorActions } from '@/composables/useMonitorActions'
import { useMonitorDetail } from '@/composables/useMonitorDetail'
import { usePageHeader } from '@/composables/usePageHeader'
import { Copy01Icon, RefreshIcon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { certificateDays, formatMonitorTime } from '@/utils/monitor-presenter'

defineOptions({ name: 'MonitorDetailView' })
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const org = useOrganizationStore()
const permissions = usePermissionsStore()
const routeProject = computed(() => String(route.params.projectId ?? ''))
const monitorId = computed(() => String(route.params.monitorId ?? ''))
const ready = ref(false)
const workspaceLoading = ref(false)
const workspaceError = ref('')
let workspaceGeneration = 0
let workspaceController: AbortController | undefined
let committingWorkspace = false
const back = computed(() => ({ name: 'monitor', query: route.query }))
// Resolve deep links independently of whichever workspace was last selected.
async function resolveWorkspace() {
  const token = ++workspaceGeneration
  const revision = org.workspaceRevision
  workspaceController?.abort()
  workspaceController = new AbortController()
  ready.value = false
  workspaceError.value = ''
  workspaceLoading.value = true
  if (org.projects.some((project) => project.id === routeProject.value)) {
    committingWorkspace = true
    try {
      await org.switchProject(routeProject.value)
      if (token === workspaceGeneration)
        ready.value = permissions.canProject(routeProject.value, 'monitor.read')
    } finally {
      committingWorkspace = false
      if (token === workspaceGeneration) workspaceLoading.value = false
    }
    return
  }
  try {
    const item = await getMonitor(routeProject.value, monitorId.value, {
      signal: workspaceController.signal,
    })
    if (token !== workspaceGeneration) return
    const authority = await permissions.ensureOrganization(item.organizationId)
    const projectAuthority = await permissions.ensureProject(routeProject.value)
    if (
      !authority ||
      !projectAuthority ||
      projectAuthority.organizationId !== item.organizationId
    )
      throw new Error(t('access.unavailable'))
    const [organizations, projects] = await Promise.all([
      listOrganizations(),
      listProjects(item.organizationId),
    ])
    if (token !== workspaceGeneration) return
    if (!projects.some((project) => project.id === routeProject.value))
      throw new Error(t('monitorPage.notFound'))
    committingWorkspace = true
    const applied = org.applyWorkspace(
      item.organizationId,
      routeProject.value,
      organizations,
      projects,
      revision,
    )
    committingWorkspace = false
    if (!applied) return
    ready.value = true
    void org.loadSubscription().catch(() => {})
  } catch (cause) {
    if (token === workspaceGeneration)
      workspaceError.value =
        cause instanceof Error ? cause.message : t('monitorPage.notFound')
  } finally {
    if (token === workspaceGeneration) workspaceLoading.value = false
  }
}
watch(
  [routeProject, monitorId],
  () => {
    void resolveWorkspace()
  },
  { immediate: true },
)
watch(
  () => org.workspaceRevision,
  () => {
    if (committingWorkspace) return
    workspaceGeneration++
    workspaceController?.abort()
    ready.value = false
    workspaceLoading.value = false
    void router.replace(back.value)
  },
  { flush: 'sync' },
)
const projectId = computed(() =>
  ready.value && org.currentProjectId === routeProject.value
    ? routeProject.value
    : '',
)
const identity = computed(() => `${projectId.value}/${monitorId.value}`)
const range = ref<MonitorDetailRange>('24h')
const tz = ref(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
const timezones = [
  ...new Set([
    tz.value,
    'UTC',
    'Asia/Shanghai',
    'America/New_York',
    'Europe/London',
  ]),
]
const ranges: MonitorDetailRange[] = ['1h', '24h', '7d', '30d']
const tab = ref('overview')
const autoRefresh = ref(false)
const dialog = ref(false)
const checkPage = ref(1)
const roundDialog = ref(false)
const selectedRoundId = ref('')
const { canManage, canCheck, canTestAlert } = useMonitorAccess()
const { monitor, insights, loading, error, refresh } = useMonitorDetail(
  projectId,
  monitorId,
  range,
  tz,
)
/** 标题栏：标题取监控项名称，返回按钮回到列表并保留筛选条件 */
usePageHeader({ title: () => monitor.value?.name, back })
const { pending, actionError, act } = useMonitorActions(
  identity,
  async (action) => {
    if (action === 'delete') {
      await router.replace(back.value)
      return
    }
    await refresh()
  },
)
watch(
  identity,
  () => {
    dialog.value = false
    checkPage.value = 1
  },
  { flush: 'sync' },
)
watch([range, tz], () => {
  checkPage.value = 1
})
const timer = setInterval(() => {
  if (
    autoRefresh.value &&
    !loading.value &&
    !dialog.value &&
    !pending.value[monitorId.value] &&
    document.visibilityState === 'visible'
  )
    void refresh()
}, 30000)
onScopeDispose(() => {
  clearInterval(timer)
  workspaceGeneration++
  workspaceController?.abort()
})
const time = (value?: string | null) =>
  formatMonitorTime(value, locale.value, tz.value)
const metric = (value?: number | null, suffix = '') =>
  value == null ? '-' : `${value.toLocaleString(locale.value)}${suffix}`
const kpis = computed(() => {
  const m = insights.value?.metrics
  return [
    { label: 'uptime', value: metric(m?.uptimePercent, '%') },
    { label: 'avg', value: metric(m?.avgLatencyMs, ' ms') },
    { label: 'p95', value: metric(m?.p95LatencyMs, ' ms') },
    { label: 'totalChecks', value: metric(m?.totalChecks) },
    { label: 'failedChecks', value: metric(m?.failedChecks) },
    { label: 'rescued', value: metric(m?.rescuedChecks) },
  ]
})
const days = computed(() =>
  certificateDays(
    monitor.value?.sslExpiresAt ?? null,
    insights.value?.asOf ?? Date.now(),
  ),
)
// ---------- 检测异常条件（绑定的规则组）----------
const ruleBindings = ref<MonitorRuleBinding[]>([])
const ruleGroups = ref<RuleGroup[]>([])
const rulesLoading = ref(false)
const rulesError = ref('')
let rulesGeneration = 0
const ruleDialog = ref(false)
const ruleEditing = ref<RuleGroup | null>(null)

const orgId = computed(() => org.currentOrganizationId)
const boundGroups = computed(() =>
  ruleBindings.value
    .map((binding) => binding.ruleGroup)
    .filter((group): group is BoundRuleGroup => Boolean(group)),
)
/** 可绑定的规则组：已启用、组织级或当前项目级，且尚未绑定 */
const bindOptions = computed(() =>
  ruleGroups.value
    .filter(
      (group) =>
        group.enabled &&
        (!group.projectId || group.projectId === projectId.value) &&
        !ruleBindings.value.some((binding) => binding.ruleGroupId === group.id),
    )
    .map((group) => ({
      label: `${group.name} · ${t(group.projectId ? 'ruleGroup.monitor.scopeProject' : 'ruleGroup.monitor.scopeOrg')}`,
      value: group.id,
    })),
)

async function loadRules() {
  const token = ++rulesGeneration
  const project = projectId.value
  const id = monitorId.value
  const organizationId = orgId.value
  rulesError.value = ''
  ruleBindings.value = []
  ruleGroups.value = []
  if (!project || !id || !organizationId) return
  rulesLoading.value = true
  try {
    const [groups, bindings] = await Promise.all([
      canManage.value ? listRuleGroups(organizationId) : Promise.resolve([]),
      listMonitorRuleBindings(project, id),
    ])
    if (
      token !== rulesGeneration ||
      project !== projectId.value ||
      id !== monitorId.value
    )
      return
    ruleGroups.value = groups
    ruleBindings.value = bindings
  } catch (cause) {
    if (token !== rulesGeneration) return
    rulesError.value =
      cause instanceof Error ? cause.message : t('ruleGroup.monitor.loadFailed')
  } finally {
    if (token === rulesGeneration) rulesLoading.value = false
  }
}
async function bindRule(value: unknown) {
  const ruleGroupId = value === null || value === undefined ? '' : String(value)
  const project = projectId.value
  if (!ruleGroupId || !project || !canManage.value) return
  try {
    await bindRuleGroup(project, monitorId.value, { ruleGroupId })
    await loadRules()
  } catch {
    MessagePlugin.warning(t('ruleGroup.monitor.bindFailed'))
  }
}
async function unbindRule(ruleGroupId: string) {
  const project = projectId.value
  if (!project || !canManage.value) return
  try {
    await unbindRuleGroup(project, monitorId.value, ruleGroupId)
    await loadRules()
  } catch {
    MessagePlugin.warning(t('ruleGroup.monitor.unbindFailed'))
  }
}
function isFullRuleGroup(group: BoundRuleGroup): group is RuleGroup {
  return (
    typeof group.organizationId === 'string' && group.projectId !== undefined
  )
}
function openRuleEditor(group?: BoundRuleGroup) {
  if (
    !canManage.value ||
    (group &&
      (!isFullRuleGroup(group) ||
        !group.tree ||
        (group.projectId
          ? !permissions.canProject(group.projectId, 'rule.manage')
          : !permissions.canOrganization(orgId.value))))
  )
    return
  ruleEditing.value = group ?? null
  ruleDialog.value = true
}
// 监控项 / 项目变化时重新拉取绑定，并关闭规则组弹窗避免写错对象
watch(
  identity,
  () => {
    ruleDialog.value = false
    void loadRules()
  },
  { immediate: true, flush: 'sync' },
)
const info = computed(() => {
  const m = monitor.value
  if (!m) return []
  return [
    ['protocol', m.type],
    ['interval', t('monitorPage.seconds', { value: m.interval })],
    ['timeout', `${m.timeout} ms`],
    ['threshold', String(m.failureThreshold)],
    [
      'scheduling',
      t(m.enabled ? 'monitorPage.enabled' : 'monitorPage.disabled'),
    ],
    ['expected', m.type === 'HTTP' ? String(m.expectedStatus) : '-'],
    ['createdAt', time(m.createdAt)],
    ['modifiedAt', time(m.updatedAt)],
    ...(m.notificationChannelIds !== undefined
      ? [
          [
            'boundChannels',
            m.notificationChannelIds.length
              ? t('monitorPage.channels', {
                  count: m.notificationChannelIds.length,
                })
              : t('monitorPage.organizationFallback'),
          ],
        ]
      : []),
    [
      'rules',
      ruleBindings.value.length
        ? t('monitorPage.rulesBound', { count: ruleBindings.value.length })
        : t('monitorPage.rulesNone'),
    ],
    [
      'availabilityThreshold',
      m.availabilityThreshold === null ? '-' : `${m.availabilityThreshold}%`,
    ],
    [
      'availabilityWindow',
      m.availabilityWindow === null ? '-' : String(m.availabilityWindow),
    ],
  ]
})
const visibleChecks = computed(
  () =>
    insights.value?.checks.slice(
      (checkPage.value - 1) * 10,
      checkPage.value * 10,
    ) ?? [],
)
function openRound(check: { roundId?: string | null }) {
  if (!check.roundId) {
    MessagePlugin.warning(t('monitorPage.roundUnavailable'))
    return
  }
  selectedRoundId.value = check.roundId
  roundDialog.value = true
}
async function copy() {
  try {
    await navigator.clipboard.writeText(monitor.value?.target ?? '')
    MessagePlugin.success(t('monitorPage.copied'))
  } catch {
    MessagePlugin.warning(t('monitorPage.copyFailed'))
  }
}
</script>

<template>
  <section class="monitor-detail">
    <!-- 页面级操作与协议标签注入内容区标题栏，返回按钮与标题由 usePageHeader 声明 -->
    <HeaderActions>
      <t-tooltip :content="t('monitorPage.refresh')"
        ><t-button
          shape="square"
          variant="outline"
          :loading="loading"
          :aria-label="t('monitorPage.refresh')"
          @click="refresh"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
      <MonitorActions
        v-if="monitor"
        :monitor="monitor"
        :pending="pending[monitor.id]"
        :can-manage="canManage"
        :can-check="canCheck"
        :can-test-alert="canTestAlert"
        @edit="dialog = true"
        @action="act(projectId, monitor, $event)"
      />
    </HeaderActions>
    <HeaderActions to="#layout-header-title-addon">
      <span
        v-if="monitor"
        class="monitor-detail__protocol"
        >{{ monitor.type }}</span
      >
    </HeaderActions>
    <div
      v-if="workspaceError || error"
      class="monitor-detail__empty"
    >
      <t-alert
        theme="error"
        :message="workspaceError || error"
      /><t-button @click="workspaceError ? resolveWorkspace() : refresh()">{{
        t('monitorPage.retry')
      }}</t-button>
    </div>
    <div
      v-else-if="!monitor || !insights"
      class="monitor-detail__empty"
    >
      <t-loading
        v-if="loading || workspaceLoading"
        :text="t('common.loading')"
      /><t-empty
        v-else
        :description="t('monitorPage.notFound')"
      />
    </div>
    <template v-else>
      <div class="monitor-detail__target">
        <span>{{ monitor.target }}</span
        ><t-tooltip :content="t('monitorPage.copyTarget')"
          ><t-button
            shape="square"
            variant="text"
            :aria-label="t('monitorPage.copyTarget')"
            @click="copy"
            ><AppIcon :icon="Copy01Icon" /></t-button
        ></t-tooltip>
      </div>
      <t-alert
        v-if="actionError"
        theme="error"
        :message="actionError"
      />
      <t-alert
        v-if="monitor.executionEligible === false"
        theme="warning"
        :message="`${t('monitorPage.executionBlocked')} · ${monitor.executionBlockedReason ?? '-'}`"
      />
      <t-card class="monitor-detail__card">
        <template #title>{{ t('monitorPage.status') }}</template>
        <div
          class="monitor-detail__status"
          :class="`monitor-detail__status--${insights.latest.status.toLowerCase()}`"
        >
          <div>
            <span>{{ t('monitorPage.status') }}</span
            ><MonitorStatusTag :status="insights.latest.status" />
          </div>
          <div>
            <span>{{ t('monitorPage.lastCheck') }}</span
            ><strong>{{
              insights.latest.lastCheckAt
                ? time(insights.latest.lastCheckAt)
                : t('monitorPage.never')
            }}</strong>
          </div>
          <div>
            <span>{{ t('monitorPage.lastLatency') }}</span
            ><strong>{{ metric(insights.latest.lastLatency, ' ms') }}</strong>
          </div>
          <div>
            <span>{{ t('monitorPage.streak') }}</span
            ><strong>{{ insights.latest.failCount }}</strong>
          </div>
          <div>
            <span>{{ t('monitorPage.ongoing') }}</span
            ><strong>{{ insights.latest.ongoingCount }}</strong>
          </div>
        </div>
        <p
          v-if="insights.latest.lastError"
          class="monitor-detail__error"
        >
          {{ insights.latest.lastError }}
        </p>
      </t-card>

      <t-card class="monitor-detail__card">
        <template #title>{{ t('monitorPage.overview') }}</template>
        <template #actions>
          <div class="monitor-detail__toolbar">
            <t-radio-group
              v-model="range"
              variant="default-filled"
              ><t-radio-button
                v-for="value in ranges"
                :key="value"
                :value="value"
                >{{ t(`monitorPage.range${value}`) }}</t-radio-button
              ></t-radio-group
            >
            <div class="monitor-detail__settings">
              <t-select
                v-model="tz"
                :aria-label="t('monitorPage.timezone')"
                :options="timezones.map((value) => ({ label: value, value }))"
              />
              <label
                ><t-switch
                  v-model="autoRefresh"
                  size="small"
                />{{ t('monitorPage.autoRefresh') }}</label
              >
            </div>
          </div>
        </template>
        <p class="monitor-detail__snapshot">
          {{ t('monitorPage.updatedAt') }} · {{ time(insights.asOf) }}
        </p>
        <t-alert
          v-if="insights.history.status === 'TRUNCATED'"
          theme="warning"
          :message="t('monitorPage.truncated')"
        />
        <div class="monitor-detail__kpis">
          <div
            v-for="item in kpis"
            :key="item.label"
          >
            <span>{{ t(`monitorPage.${item.label}`) }}</span
            ><strong>{{ item.value }}</strong>
          </div>
        </div>
      </t-card>
      <t-tabs v-model="tab">
        <t-tab-panel
          v-for="value in ['overview', 'checks', 'events', 'configuration']"
          :key="value"
          :value="value"
          :label="t(`monitorPage.${value}`)"
        />
      </t-tabs>
      <t-card
        v-if="tab === 'overview' || tab === 'configuration'"
        class="monitor-detail__card"
      >
        <template #title>{{ t('monitorPage.configuration') }}</template>
        <dl class="monitor-detail__info">
          <div
            v-for="[key, value] in tab === 'overview' ? info.slice(0, 4) : info"
            :key="key"
          >
            <dt>{{ t(`monitorPage.${key}`) }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>
      </t-card>

      <t-card
        v-if="tab === 'overview'"
        class="monitor-detail__card"
      >
        <MonitorDetailCharts :insights="insights" />
      </t-card>
      <t-card
        v-if="tab === 'overview' || tab === 'events'"
        class="monitor-detail__card"
      >
        <template #title>
          <span>{{ t('monitorPage.events') }}</span>
          <span class="monitor-detail__hint">
            {{ t('monitorPage.eventLimit', { count: insights.eventsLimit }) }}
          </span>
        </template>
        <template #actions>
          <t-button
            v-if="tab === 'overview' && insights.events.length > 5"
            variant="text"
            @click="tab = 'events'"
            >{{ t('monitorPage.more') }}</t-button
          >
        </template>
        <t-alert
          v-if="insights.history.alertsStatus === 'TRUNCATED'"
          theme="warning"
          :message="t('monitorPage.eventsTruncated')"
        />
        <MonitorEvents
          :events="
            tab === 'overview' ? insights.events.slice(0, 5) : insights.events
          "
          :as-of="insights.asOf"
          :tz="tz"
        />
      </t-card>

      <t-card
        v-if="tab === 'checks'"
        class="monitor-detail__card"
      >
        <template #title>{{ t('monitorPage.checks') }}</template>
        <template #actions>
          <span class="monitor-detail__hint">
            {{ t('monitorPage.checkLimit', { count: insights.checksLimit }) }}
          </span>
        </template>
        <div
          v-if="visibleChecks.length"
          class="monitor-detail__table-scroll"
        >
          <table class="monitor-detail__checks">
            <thead>
              <tr>
                <th>{{ t('monitorPage.checkedAt') }}</th>
                <th>{{ t('monitorPage.result') }}</th>
                <th>{{ t('monitorPage.latency') }}</th>
                <th>{{ t('monitorPage.code') }}</th>
                <th>{{ t('monitorPage.error') }}</th>
                <th>{{ t('monitorPage.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="check in visibleChecks"
                :key="check.id"
                class="monitor-detail__check-row"
                @click="openRound(check)"
              >
                <td>{{ time(check.checkedAt) }}</td>
                <td>
                  <t-tag
                    size="small"
                    variant="light"
                    :theme="check.success ? 'success' : 'danger'"
                    >{{
                      t(
                        check.success
                          ? 'workspace.monitor.ok'
                          : 'workspace.monitor.fail',
                      )
                    }}</t-tag
                  ><small v-if="check.rescuedByProbe">{{
                    t('monitorPage.rescuedLabel')
                  }}</small>
                </td>
                <td>{{ metric(check.latency, ' ms') }}</td>
                <td>{{ check.statusCode ?? '-' }}</td>
                <td>{{ check.error || '-' }}</td>
                <td>
                  <t-button
                    size="small"
                    variant="text"
                    theme="primary"
                    @click.stop="openRound(check)"
                    >{{ t('monitorPage.view') }}</t-button
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <t-empty
          v-else
          :description="t('workspace.monitor.historyEmpty')"
        />
        <t-pagination
          v-if="insights.checks.length > 10"
          v-model:current="checkPage"
          :total="insights.checks.length"
          :page-size="10"
          :show-page-size="false"
          :show-jumper="false"
        />
      </t-card>

      <!-- 检测异常条件：绑定的规则组只读展示，可即时绑定 / 解绑 / 编辑（参考图 1 的展示形态） -->
      <t-card
        v-if="tab === 'configuration'"
        class="monitor-detail__card"
      >
        <template #title>{{ t('ruleGroup.monitor.cardTitle') }}</template>
        <template #actions>
          <div class="monitor-detail__rules-actions">
            <t-select
              v-if="canManage && bindOptions.length"
              :value="null"
              :options="bindOptions"
              :placeholder="t('ruleGroup.monitor.bindPlaceholder')"
              :aria-label="t('ruleGroup.monitor.bind')"
              @change="(value: string) => bindRule(value)"
            />
            <t-button
              v-if="canManage"
              size="small"
              variant="outline"
              @click="openRuleEditor()"
              >{{ t('ruleGroup.monitor.addRule') }}</t-button
            >
          </div>
        </template>
        <t-alert
          v-if="rulesError"
          theme="error"
          :message="rulesError"
        />
        <t-loading
          v-else-if="rulesLoading"
          size="small"
          :text="t('common.loading')"
        />
        <div
          v-else-if="boundGroups.length"
          class="monitor-detail__rules"
        >
          <article
            v-for="group in boundGroups"
            :key="group.id"
            class="monitor-detail__rule"
          >
            <div class="monitor-detail__rule-head">
              <span class="monitor-detail__rule-name">{{ group.name }}</span>
              <t-tag
                size="small"
                variant="outline"
                >{{
                  group.projectId
                    ? t('ruleGroup.monitor.scopeProject')
                    : t('ruleGroup.monitor.scopeOrg')
                }}</t-tag
              >
              <t-tag
                v-if="!group.enabled"
                size="small"
                variant="light"
                >{{ t('ruleGroup.monitor.disabled') }}</t-tag
              >
              <t-button
                v-if="canManage"
                size="small"
                variant="text"
                @click="openRuleEditor(group)"
                >{{ t('ruleGroup.monitor.editConditions') }}</t-button
              >
              <t-button
                v-if="canManage"
                size="small"
                variant="text"
                theme="danger"
                @click="unbindRule(group.id)"
                >{{ t('ruleGroup.monitor.unbind') }}</t-button
              >
            </div>
            <RuleTreeView
              v-if="group.tree"
              :tree="group.tree"
            />
          </article>
        </div>
        <p
          v-else
          class="monitor-detail__rules-empty"
        >
          {{ t('ruleGroup.monitor.empty') }}
        </p>
      </t-card>
      <t-card
        v-if="tab === 'configuration'"
        class="monitor-detail__card"
      >
        <template #title>{{ t('monitorPage.ssl') }}</template>
        <dl class="monitor-detail__info">
          <div>
            <dt>{{ t('monitorPage.sslEnabled') }}</dt>
            <dd>
              {{
                t(
                  monitor.checkSsl
                    ? 'monitorPage.enabled'
                    : 'monitorPage.disabled',
                )
              }}
            </dd>
          </div>
          <template v-if="monitor.checkSsl">
            <div>
              <dt>{{ t('monitorPage.sslThreshold') }}</dt>
              <dd>{{ monitor.sslExpiryThreshold }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.sslExpiresAt') }}</dt>
              <dd>{{ time(monitor.sslExpiresAt) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.status') }}</dt>
              <dd>
                {{
                  days === null
                    ? t('monitorPage.sslUnknown')
                    : days <= 0
                      ? t('monitorPage.sslExpired')
                      : t('monitorPage.sslRemaining', { days })
                }}
              </dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.sslIssuer') }}</dt>
              <dd>{{ monitor.sslIssuer || '-' }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.sslSubject') }}</dt>
              <dd>{{ monitor.sslSubject || '-' }}</dd>
            </div>
          </template>
        </dl>
        <dl class="monitor-detail__info monitor-detail__info--coverage">
          <div>
            <dt>{{ t('monitorPage.availableFrom') }}</dt>
            <dd>{{ time(insights.history.availableFrom) }}</dd>
          </div>
          <div>
            <dt>{{ t('monitorPage.eventsFrom') }}</dt>
            <dd>{{ time(insights.history.alertsAvailableFrom) }}</dd>
          </div>
        </dl>
      </t-card>
      <MonitorEditorDialog
        v-model:visible="dialog"
        :project-id="projectId"
        :monitor="monitor"
        @saved="
          (id) => {
            if (id === projectId) void refresh()
          }
        "
      />
      <RuleGroupEditorDialog
        v-model:visible="ruleDialog"
        :org-id="orgId"
        :group="ruleEditing"
        :project-id="projectId"
        :monitor-type="monitor.type"
        @saved="loadRules"
      />
      <MonitorRoundDialog
        v-model:visible="roundDialog"
        :project-id="projectId"
        :monitor-id="monitorId"
        :round-id="selectedRoundId"
        :tz="tz"
      />
    </template>
  </section>
</template>

<style scoped lang="less">
.monitor-detail {
  min-width: 0;
  color: @beacon-text-primary;
  // 协议标签：注入标题栏的标题附加区
  &__protocol {
    color: @beacon-text-tertiary;
    font-size: 12px;
  }
  &__target {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0 0 16px;
    color: @beacon-text-secondary;
    font-size: 13px;
    span {
      overflow-wrap: anywhere;
      min-width: 0;
    }
  }
  &__status {
    display: grid;
    grid-template-columns: 110px minmax(160px, 1.5fr) repeat(
        3,
        minmax(80px, 1fr)
      );
    gap: 16px;
    // 卡片已提供白底与边框，这里只留状态色条
    padding-left: 12px;
    border-left: 3px solid @beacon-text-tertiary;
    > div {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      min-width: 0;
    }
    span {
      color: @beacon-text-secondary;
      font-size: 12px;
    }
    strong {
      font-weight: 500;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    &--up {
      border-left-color: @beacon-success;
    }
    &--down {
      border-left-color: @beacon-error;
    }
    &--degraded {
      border-left-color: @beacon-warning;
    }
  }
  &__error {
    color: @beacon-error;
    overflow-wrap: anywhere;
    font-size: 12px;
  }
  // 时间范围与自动刷新：作为「运行概况」卡片标题右侧的动作区
  &__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  &__settings {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    :deep(.t-select__wrap) {
      width: 190px;
    }
    label {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 12px;
      color: @beacon-text-secondary;
    }
  }
  &__snapshot {
    margin: 0 0 12px;
    color: @beacon-text-tertiary;
    font-size: 11px;
  }
  &__kpis {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    padding-top: 12px;
    gap: 16px;
    > div {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    span {
      color: @beacon-text-secondary;
      font-size: 12px;
    }
    strong {
      font-weight: 600;
      font-size: 20px;
      overflow-wrap: anywhere;
      font-variant-numeric: tabular-nums;
    }
  }
  // 功能区块之间留出页面底色的间隔
  &__card {
    margin-bottom: 16px;
  }
  // 卡片标题里的补充说明（事件 / 检查记录条数）
  &__hint {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 400;
    color: @beacon-text-tertiary;
  }
  &__info {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 24px;
    margin: 0;
    &--coverage {
      margin-top: 24px;
    }
    dt {
      color: @beacon-text-secondary;
      font-size: 12px;
      margin-bottom: 8px;
    }
    dd {
      margin: 0;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
  }
  &__empty {
    display: flex;
    min-height: 300px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 20px;
  }
  &__table-scroll {
    overflow-x: auto;
  }
  &__checks {
    width: 100%;
    min-width: 650px;
    border-collapse: collapse;
    text-align: left;
    font-size: 12px;
    th {
      color: @beacon-text-secondary;
      font-weight: 500;
    }
    th,
    td {
      padding: 12px;
      border-bottom: 1px solid @beacon-border;
    }
    td {
      max-width: 280px;
      overflow-wrap: anywhere;
    }
    small {
      display: block;
      margin-top: 4px;
      color: @beacon-text-tertiary;
    }
  }
  &__check-row {
    cursor: pointer;
    &:hover td {
      background: @beacon-bg-page;
    }
  }
  :deep(.t-tabs) {
    margin-bottom: 16px;
  }
  // 检测异常条件卡片：绑定的规则组逐个只读展示
  &__rules-actions {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.t-select__wrap) {
      width: 220px;
    }
  }
  &__rules {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  &__rule {
    padding: 12px 16px;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }
  &__rule-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  &__rule-name {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }
  &__rules-empty {
    margin: 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }
  :deep(.t-alert) {
    margin: 12px 0;
  }
}
@media (max-width: 1100px) {
  .monitor-detail__status {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .monitor-detail__kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .monitor-detail__info {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .monitor-detail__status {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 16px 12px;
  }
  .monitor-detail__status > :nth-child(2) {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .monitor-detail__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .monitor-detail__toolbar :deep(.t-radio-group) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }
  .monitor-detail__toolbar :deep(.t-radio-button) {
    text-align: center;
  }
  .monitor-detail__settings {
    width: 100%;
    :deep(.t-select__wrap) {
      width: 100%;
    }
  }
  .monitor-detail__info {
    gap: 20px 16px;
  }
  .monitor-detail :deep(.t-tabs__nav-item) {
    padding: 0 10px;
    font-size: 13px;
  }
}
</style>
