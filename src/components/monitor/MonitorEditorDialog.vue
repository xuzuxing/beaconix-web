<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  bindRuleGroup,
  createMonitor,
  listMonitorRuleBindings,
  listNotificationChannels,
  listRuleGroups,
  unbindRuleGroup,
  updateMonitor,
} from '@/api'
import type { Monitor, MonitorConfig, MonitorType, UpdateMonitorParams } from '@/api/types'
import type { NotificationChannel } from '@/api/types/notification'
import type { BoundRuleGroup, RuleGroup } from '@/api/types/rule'
import MonitorConfigForm from '@/components/monitor/MonitorConfigForm.vue'
import RuleGroupEditorDialog from '@/components/rules/RuleGroupEditorDialog.vue'
import RuleTreeView from '@/components/rules/RuleTreeView.vue'
import { useOrganizationStore } from '@/stores'
import { useProjectAccess } from '@/composables/useProjectAccess'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { accessContext, isCurrentContext, permissionEpoch } from '@/utils/access-context'
import {
  MONITOR_TYPE_OPTIONS,
  monitorConfigDefaults,
  monitorConfigDraft,
  monitorConfigHasCredentials,
  monitorTargetPlaceholderKey,
} from '@/utils/monitor-config'

/**
 * 监控项编辑器：基础配置 + 检测异常条件（规则组绑定），表单底部另有独立的可用率条件区块。
 * 绑定关系在保存监控项时统一提交（编辑模式下按差异 bind / unbind），
 * 而弹窗内「新增规则组」按产品约定立即创建规则组，再把新组加进本次绑定集合。
 */
const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ projectId: string; monitor?: Monitor }>()
const emit = defineEmits<{ saved: [projectId: string, monitorId: string] }>()
const { t } = useI18n()
const org = useOrganizationStore()
const { canManage } = useProjectAccess(() => props.projectId)
const permissions = usePermissionsStore()
const submitting = ref(false)
const error = ref('')
let generation = 0
const form = reactive({
  name: '',
  type: 'HTTP' as MonitorType,
  target: '',
  interval: 60,
  timeout: 5000,
  expectedStatus: 200,
  failureThreshold: 3,
  enabled: true,
  checkSsl: false,
  sslExpiryThreshold: 30,
  /** 可用率条件：最近检查窗口内可用率低于阈值即判为异常，并发送告警通知（保存时自动启用 availabilityEnabled） */
  availabilityThreshold: 90,
  availabilityWindow: 10,
  /** 绑定的组织通知渠道；空数组表示不指定、走组织级默认渠道 */
  notificationChannelIds: [] as string[],
  /** 当前协议的 config（字段级校验与清洗见 MonitorConfigForm / utils/monitor-config） */
  config: {} as Record<string, unknown>,
})

/** 协议下拉：与后端 MonitorType 枚举一致（共 11 种） */
const typeOptions = computed(() =>
  MONITOR_TYPE_OPTIONS.map((option) => ({ label: t(option.labelKey), value: option.value })),
)
/** 检查目标的占位提示按协议的目标形态区分 */
const targetPlaceholder = computed(() => t(monitorTargetPlaceholderKey(form.type)))
/** 编辑含凭据的协议时提醒：config 整体替换，凭据需要重新填写 */
const credentialsHint = computed(
  () => Boolean(props.monitor) && monitorConfigHasCredentials(form.type),
)

interface MonitorConfigFormApi {
  buildConfig: () => MonitorConfig
  validate: () => string
  isDirty: () => boolean
}
const configForm = ref<MonitorConfigFormApi>()

// ---------- 检测异常条件（规则组绑定） ----------
const orgId = computed(() => props.monitor?.organizationId ?? org.currentOrganizationId)
const groups = ref<RuleGroup[]>([])
const bindingGroups = ref<BoundRuleGroup[]>([])
/** 弹窗打开时该监控项已有的绑定（编辑模式） */
const boundIds = ref<string[]>([])
/** 本次保存后应生效的绑定集合 */
const selectedIds = ref<string[]>([])
const rulesLoading = ref(false)
const rulesError = ref('')
const ruleDialog = ref(false)

/** 可绑定的规则组：已启用，且为组织级或属于当前项目（后端绑定接口的约束） */
const candidates = computed(() =>
  [
    ...groups.value,
    ...bindingGroups.value.filter((group) => !groups.value.some((item) => item.id === group.id)),
  ].filter((group) => group.enabled && (!group.projectId || group.projectId === props.projectId)),
)
const selectedGroups = computed(() =>
  selectedIds.value
    .map(
      (id) =>
        groups.value.find((group) => group.id === id) ??
        bindingGroups.value.find((group) => group.id === id),
    )
    .filter((group): group is BoundRuleGroup => Boolean(group)),
)
const bindOptions = computed(() =>
  candidates.value
    .filter((group) => !selectedIds.value.includes(group.id))
    .map((group) => ({
      label: `${group.name} · ${t(group.projectId ? 'ruleGroup.monitor.scopeProject' : 'ruleGroup.monitor.scopeOrg')}`,
      value: group.id,
    })),
)

async function loadRules() {
  const token = generation
  const organizationId = orgId.value
  const monitorId = props.monitor?.id
  rulesError.value = ''
  groups.value = []
  bindingGroups.value = []
  boundIds.value = []
  selectedIds.value = []
  if (!organizationId || !canManage.value) return
  rulesLoading.value = true
  try {
    const [all, bindings] = await Promise.all([
      listRuleGroups(organizationId),
      monitorId ? listMonitorRuleBindings(props.projectId, monitorId) : Promise.resolve([]),
    ])
    if (token !== generation) return
    groups.value = all
    bindingGroups.value = bindings.flatMap((binding) =>
      binding.ruleGroup ? [binding.ruleGroup] : [],
    )
    boundIds.value = bindings.map((binding) => binding.ruleGroupId)
    selectedIds.value = [...boundIds.value]
  } catch (cause) {
    if (token === generation)
      rulesError.value = cause instanceof Error ? cause.message : t('ruleGroup.monitor.loadFailed')
  } finally {
    if (token === generation) rulesLoading.value = false
  }
}

// ---------- 告警通知渠道 ----------
const channels = ref<NotificationChannel[]>([])
const channelsLoading = ref(false)
const channelsError = ref('')

/** 可选的渠道：组织下的全部通知渠道，停用的渠道标注出来但仍可保留绑定 */
const channelOptions = computed(() =>
  channels.value.map((channel) => ({
    label: channel.enabled
      ? `${channel.name} · ${t(`channelPage.type.${channel.type}`)}`
      : `${channel.name} · ${t('channelPage.disabled')}`,
    value: channel.id,
  })),
)

async function loadChannels() {
  const token = generation
  const organizationId = orgId.value
  channels.value = []
  channelsError.value = ''
  if (!organizationId || !canManage.value) return
  channelsLoading.value = true
  try {
    const list = await listNotificationChannels(organizationId)
    if (token === generation) channels.value = list
  } catch (cause) {
    if (token === generation)
      channelsError.value =
        cause instanceof Error ? cause.message : t('monitorPage.channelsLoadFailed')
  } finally {
    if (token === generation) channelsLoading.value = false
  }
}

function bindRule(value: unknown) {
  const id = value === null || value === undefined ? '' : String(value)
  if (!id || selectedIds.value.includes(id)) return
  selectedIds.value = [...selectedIds.value, id]
}
function unbindRule(id: string) {
  selectedIds.value = selectedIds.value.filter((value) => value !== id)
}
function openRuleDialog() {
  ruleDialog.value = true
}
/** 规则组立即创建成功：并入本地列表并加入本次绑定集合 */
function onRuleGroupSaved(group: RuleGroup) {
  if (!groups.value.some((item) => item.id === group.id)) groups.value = [group, ...groups.value]
  if (!selectedIds.value.includes(group.id)) selectedIds.value = [...selectedIds.value, group.id]
}

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    ruleDialog.value = false
    if (!value) return
    const m = props.monitor
    const type = m?.type ?? 'HTTP'
    Object.assign(form, {
      name: m?.name ?? '',
      type,
      target: m?.target ?? '',
      interval: m?.interval ?? 60,
      timeout: m?.timeout ?? 5000,
      expectedStatus: m?.expectedStatus ?? 200,
      failureThreshold: m?.failureThreshold ?? 3,
      enabled: m?.enabled ?? true,
      checkSsl: m?.checkSsl ?? false,
      sslExpiryThreshold: m?.sslExpiryThreshold ?? 30,
      availabilityThreshold: m?.availabilityThreshold ?? 90,
      availabilityWindow: m?.availabilityWindow ?? 10,
      // 未指定渠道时后端返回空/缺省，两种情况都按「走组织兜底」回显为空选择
      notificationChannelIds: [...(m?.notificationChannelIds ?? [])],
      // 编辑时用后端返回的 config 覆盖默认值（凭据字段不回传，需重新填写）
      config: monitorConfigDraft(type, m?.config),
    })
    // 检测异常条件（规则组绑定）随监控项一并展示：打开弹窗即加载
    void loadRules()
    void loadChannels()
  },
  { flush: 'sync' },
)

/** 新建时切换协议：重置为该协议的默认配置 */
function onTypeChange(value: unknown) {
  form.config = monitorConfigDefaults(value as MonitorType)
}
watch(
  () => [props.projectId, props.monitor?.id, permissionEpoch.value],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)

/** 保存监控项后按差异提交绑定关系：失败只提示，不掩盖监控项已保存的事实 */
async function commitBindings(project: string, monitorId: string, token: number) {
  if (token !== generation || project !== props.projectId || !canManage.value || !visible.value)
    return
  const target = new Set(selectedIds.value)
  const toBind = [...target].filter((id) => !boundIds.value.includes(id))
  const toUnbind = boundIds.value.filter((id) => !target.has(id))
  if (!toBind.length && !toUnbind.length) return
  try {
    await Promise.all([
      ...toBind.map((id) => bindRuleGroup(project, monitorId, { ruleGroupId: id })),
      ...toUnbind.map((id) => unbindRuleGroup(project, monitorId, id)),
    ])
  } catch {
    if (token === generation) MessagePlugin.warning(t('ruleGroup.monitor.bindFailed'))
  }
}

async function save() {
  if (submitting.value || !canManage.value) return
  error.value = ''
  if (!form.name.trim() || !form.target.trim()) {
    error.value = t('workspace.monitor.required')
    return
  }
  const int = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max
  if (
    !int(form.interval, 10, 86400) ||
    !int(form.timeout, 100, 60000) ||
    !int(form.failureThreshold, 1, 10) ||
    !int(form.expectedStatus, 100, 599) ||
    !int(form.sslExpiryThreshold, 1, 365) ||
    !int(form.availabilityWindow, 1, 1000) ||
    !Number.isFinite(form.availabilityThreshold) ||
    form.availabilityThreshold < 0 ||
    form.availabilityThreshold > 100
  ) {
    error.value = t('monitorPage.invalidNumber')
    return
  }
  const configError = configForm.value?.validate() ?? ''
  if (configError) {
    error.value = configError
    return
  }
  const project = props.projectId
  const editing = props.monitor?.id
  const token = generation
  const context = accessContext()
  submitting.value = true
  try {
    await permissions.ensureProject(project, true)
    if (token !== generation || !isCurrentContext(context) || !canManage.value || !visible.value)
      return
    const basic = {
      name: form.name.trim(),
      target: form.target.trim(),
      interval: form.interval,
      timeout: form.timeout,
      failureThreshold: form.failureThreshold,
      // 区块里配置的可用率条件即生效：没有开关，保存时统一按启用提交
      availabilityEnabled: true,
      availabilityThreshold: form.availabilityThreshold,
      availabilityWindow: form.availabilityWindow,
      ...(form.type === 'HTTP'
        ? {
            expectedStatus: form.expectedStatus,
            checkSsl: form.checkSsl,
            sslExpiryThreshold: form.sslExpiryThreshold,
          }
        : {}),
    }
    const changes = Object.fromEntries(
      Object.entries(basic).filter(
        ([key, value]) => value !== props.monitor?.[key as keyof Monitor],
      ),
    ) as UpdateMonitorParams
    const config: MonitorConfig = configForm.value?.buildConfig() ?? ({} as MonitorConfig)
    // 后端对 config 是整体替换：新建必传；编辑只在用户改过时提交，
    // 否则整段省略以保留密码 / token 等不回传的凭据。
    if (!editing || configForm.value?.isDirty()) changes.config = config
    // 通知渠道是数组，按内容比对（引用比较会让每次保存都提交一遍）；
    // 新建或勾选集合有变化才提交，空数组即「不指定、走组织级兜底」。
    const channelIds = [...(form.notificationChannelIds ?? [])]
    const boundChannelIds = props.monitor?.notificationChannelIds ?? []
    const channelsChanged =
      !editing ||
      channelIds.length !== boundChannelIds.length ||
      channelIds.some((id) => !boundChannelIds.includes(id))
    if (channelsChanged) changes.notificationChannelIds = channelIds
    const result = editing
      ? await updateMonitor(project, editing, changes)
      : await createMonitor(project, {
          ...basic,
          ...(channelsChanged ? { notificationChannelIds: channelIds } : {}),
          type: form.type,
          enabled: form.enabled,
          config,
        })
    if (token !== generation) return
    // 检测异常条件（规则组绑定）随监控项一起保存：按差异提交绑定变更
    await commitBindings(project, result.id, token)
    if (token !== generation || project !== props.projectId) return
    MessagePlugin.success(t(editing ? 'workspace.monitor.updated' : 'workspace.monitor.created'))
    visible.value = false
    emit('saved', project, result.id)
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('monitorPage.saveFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t(monitor ? 'workspace.monitor.edit' : 'workspace.monitor.create')"
    width="min(720px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="save"
  >
    <t-alert v-if="error" theme="error" :message="error" class="editor-error" />
    <t-form :data="form" label-align="top" :colon="false">
      <t-form-item :label="t('workspace.monitor.name')"
        ><t-input v-model="form.name" :maxlength="100"
      /></t-form-item>
      <t-form-item :label="t('workspace.monitor.type')">
        <t-input v-if="monitor" :value="form.type" readonly />
        <t-select
          v-else
          v-model="form.type"
          :options="typeOptions"
          @change="(value: string) => onTypeChange(value)"
        />
      </t-form-item>
      <t-form-item :label="t('workspace.monitor.target')"
        ><t-input v-model="form.target" :maxlength="2048" :placeholder="targetPlaceholder"
      /></t-form-item>
      <!-- 协议配置：按协议渲染各自的 config（TCP / PING 无需额外配置） -->
      <section class="editor-config">
        <div class="editor-config__head">
          <span class="editor-config__title">{{ t('workspace.monitor.config.title') }}</span>
          <small>{{ t(`workspace.monitor.config.hint.${form.type}`) }}</small>
        </div>
        <t-alert
          v-if="credentialsHint"
          theme="warning"
          :message="t('workspace.monitor.config.credentialsHint')"
        />
        <MonitorConfigForm ref="configForm" :type="form.type" :config="form.config" />
      </section>
      <div class="editor-grid">
        <t-form-item :label="t('workspace.monitor.interval')"
          ><t-input-number v-model="form.interval" :min="10" :max="86400"
        /></t-form-item>
        <t-form-item :label="t('workspace.monitor.timeout')"
          ><t-input-number v-model="form.timeout" :min="100" :max="60000" :step="100"
        /></t-form-item>
        <t-form-item :label="t('workspace.monitor.failureThreshold')"
          ><t-input-number v-model="form.failureThreshold" :min="1" :max="10"
        /></t-form-item>
        <t-form-item v-if="form.type === 'HTTP'" :label="t('workspace.monitor.expectedStatus')"
          ><t-input-number v-model="form.expectedStatus" :min="100" :max="599"
        /></t-form-item>
      </div>
      <template v-if="form.type === 'HTTP'">
        <t-form-item :label="t('monitorPage.sslEnabled')"
          ><t-switch v-model="form.checkSsl"
        /></t-form-item>
        <t-form-item v-if="form.checkSsl" :label="t('monitorPage.sslThreshold')"
          ><t-input-number v-model="form.sslExpiryThreshold" :min="1" :max="365"
        /></t-form-item>
      </template>
      <!-- 检测异常条件：绑定规则组（可选绑定已有组或立即新增），区块常驻、无开关门控 -->
      <section class="editor-rules">
        <div class="editor-rules__head">
          <div>
            <span class="editor-rules__title">{{ t('ruleGroup.monitor.rules') }}</span>
            <small>{{ t('ruleGroup.monitor.createHint') }}</small>
          </div>
          <div class="editor-rules__actions">
            <t-select
              v-if="bindOptions.length"
              :value="null"
              :options="bindOptions"
              :placeholder="t('ruleGroup.monitor.bindPlaceholder')"
              :aria-label="t('ruleGroup.monitor.bind')"
              @change="(value: string) => bindRule(value)"
            />
            <t-button size="small" variant="outline" :disabled="!orgId" @click="openRuleDialog">{{
              t('ruleGroup.monitor.addRule')
            }}</t-button>
          </div>
        </div>
        <t-alert v-if="rulesError" theme="error" :message="rulesError" />
        <t-loading v-else-if="rulesLoading" size="small" :text="t('common.loading')" />
        <div v-else-if="selectedGroups.length" class="editor-rules__list">
          <article v-for="group in selectedGroups" :key="group.id" class="editor-rule">
            <div class="editor-rule__head">
              <span class="editor-rule__name">{{ group.name }}</span>
              <t-tag size="small" variant="outline">{{
                group.projectId
                  ? t('ruleGroup.monitor.scopeProject')
                  : t('ruleGroup.monitor.scopeOrg')
              }}</t-tag>
              <t-tag v-if="!group.enabled" size="small" variant="light">{{
                t('ruleGroup.monitor.disabled')
              }}</t-tag>
              <t-button size="small" variant="text" theme="danger" @click="unbindRule(group.id)">{{
                t('ruleGroup.monitor.unbind')
              }}</t-button>
            </div>
            <!-- 按结构回显规则树：逻辑组层级 + 每一条规则，而非一行摘要 -->
            <div v-if="group.tree" class="editor-rule__tree">
              <RuleTreeView :tree="group.tree" />
            </div>
          </article>
        </div>
        <p v-else class="editor-rules__empty">{{ t('ruleGroup.monitor.empty') }}</p>
        <p v-if="monitor" class="editor-rules__hint">{{ t('ruleGroup.monitor.pendingNote') }}</p>
      </section>
      <t-form-item v-if="!monitor" :label="t('workspace.monitor.enabled')"
        ><t-switch v-model="form.enabled"
      /></t-form-item>
      <!-- 可用率条件：独立 section 置于表单最底部；区块无开关，保存时自动启用 availabilityEnabled -->
      <section class="editor-availability">
        <div class="editor-config__head">
          <span class="editor-config__title">{{ t('monitorPage.availabilitySection') }}</span>
          <small>{{ t('monitorPage.availabilityHint') }}</small>
        </div>
        <div class="editor-grid">
          <t-form-item :label="t('monitorPage.availabilityThreshold')"
            ><t-input-number v-model="form.availabilityThreshold" :min="0" :max="100"
          /></t-form-item>
          <t-form-item :label="t('monitorPage.availabilityWindow')"
            ><t-input-number v-model="form.availabilityWindow" :min="1" :max="1000"
          /></t-form-item>
        </div>
      </section>
      <!-- 告警通知渠道：组织级渠道多选，留空表示走组织级默认渠道 -->
      <section class="editor-channels">
        <div class="editor-config__head">
          <span class="editor-config__title">{{ t('monitorPage.boundChannels') }}</span>
          <small>{{ t('monitorPage.channelsHint') }}</small>
        </div>
        <t-alert v-if="channelsError" theme="error" :message="channelsError" />
        <t-select
          v-model="form.notificationChannelIds"
          multiple
          clearable
          :options="channelOptions"
          :loading="channelsLoading"
          :min-collapsed-num="3"
          :placeholder="t('monitorPage.channelsPlaceholder')"
        />
        <p
          v-if="!channelsLoading && !channelsError && !channels.length"
          class="editor-channels__empty"
        >
          {{ t('monitorPage.channelsEmpty') }}
        </p>
      </section>
    </t-form>
    <RuleGroupEditorDialog
      v-model:visible="ruleDialog"
      :org-id="orgId"
      :project-id="projectId"
      :monitor-type="form.type"
      @saved="onRuleGroupSaved"
    />
  </t-dialog>
</template>

<style scoped lang="less">
.editor-error {
  margin-bottom: 16px;
}

.editor-config {
  margin-bottom: 24px;

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;

    small {
      color: @beacon-text-secondary;
      font-size: 12px;
    }
  }

  &__title {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }
}

.editor-availability {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid @beacon-border;
}

.editor-channels {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid @beacon-border;

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.editor-grid :deep(.t-input-number) {
  max-width: 100%;
}

.editor-rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid @beacon-border;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;

    > div {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    small {
      color: @beacon-text-secondary;
      font-size: 12px;
    }
  }

  &__title {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.t-select__wrap) {
      width: 200px;
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__empty,
  &__hint {
    margin: 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }
}

.editor-rule {
  padding: 12px 16px;
  background: @beacon-bg-page;
  border: 1px solid @beacon-border;
  border-radius: @beacon-radius-m;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  &__name {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  /** 规则树按结构完整展示；组多/层级深时在卡片内滚动，避免弹窗被撑长 */
  &__tree {
    max-height: 320px;
    overflow-y: auto;
    padding: 8px 10px;
    background: @beacon-bg-container;
    border-radius: @beacon-radius-m;
  }
}

@media (max-width: 480px) {
  .editor-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-rules__actions {
    width: 100%;

    :deep(.t-select__wrap) {
      width: 100%;
    }
  }
}
</style>
