<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  bindRuleGroup,
  createMonitor,
  listMonitorRuleBindings,
  listRuleGroups,
  unbindRuleGroup,
  updateMonitor,
} from '@/api'
import type { Monitor, MonitorType } from '@/api/types'
import type { RuleGroup } from '@/api/types/rule'
import RuleGroupEditorDialog from '@/components/rules/RuleGroupEditorDialog.vue'
import RuleTreeView from '@/components/rules/RuleTreeView.vue'
import { useOrganizationStore } from '@/stores'

/**
 * 监控项编辑器：基础配置 + 告警规则绑定。
 * 绑定关系在保存监控项时统一提交（编辑模式下按差异 bind / unbind），
 * 而弹窗内「新增规则组」按产品约定立即创建规则组，再把新组加进本次绑定集合。
 */
const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ projectId: string; monitor?: Monitor }>()
const emit = defineEmits<{ saved: [projectId: string, monitorId: string] }>()
const { t } = useI18n()
const org = useOrganizationStore()
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
  availabilityEnabled: false,
  availabilityThreshold: 90,
  availabilityWindow: 10,
})

// ---------- 告警规则绑定 ----------
const orgId = computed(() => props.monitor?.organizationId ?? org.currentOrganizationId)
const groups = ref<RuleGroup[]>([])
/** 弹窗打开时该监控项已有的绑定（编辑模式） */
const boundIds = ref<string[]>([])
/** 本次保存后应生效的绑定集合 */
const selectedIds = ref<string[]>([])
const rulesLoading = ref(false)
const rulesError = ref('')
const ruleDialog = ref(false)

/** 可绑定的规则组：已启用，且为组织级或属于当前项目（后端绑定接口的约束） */
const candidates = computed(() =>
  groups.value.filter((group) => group.enabled && (!group.projectId || group.projectId === props.projectId)),
)
const selectedGroups = computed(() =>
  selectedIds.value
    .map((id) => groups.value.find((group) => group.id === id))
    .filter((group): group is RuleGroup => Boolean(group)),
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
  boundIds.value = []
  selectedIds.value = []
  if (!organizationId) return
  rulesLoading.value = true
  try {
    const [all, bindings] = await Promise.all([
      listRuleGroups(organizationId),
      monitorId ? listMonitorRuleBindings(props.projectId, monitorId) : Promise.resolve([]),
    ])
    if (token !== generation) return
    groups.value = all
    boundIds.value = bindings.map((binding) => binding.ruleGroupId)
    selectedIds.value = [...boundIds.value]
  } catch (cause) {
    if (token === generation)
      rulesError.value = cause instanceof Error ? cause.message : t('ruleGroup.monitor.loadFailed')
  } finally {
    if (token === generation) rulesLoading.value = false
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
    Object.assign(form, {
      name: m?.name ?? '',
      type: m?.type ?? 'HTTP',
      target: m?.target ?? '',
      interval: m?.interval ?? 60,
      timeout: m?.timeout ?? 5000,
      expectedStatus: m?.expectedStatus ?? 200,
      failureThreshold: m?.failureThreshold ?? 3,
      enabled: m?.enabled ?? true,
      checkSsl: m?.checkSsl ?? false,
      sslExpiryThreshold: m?.sslExpiryThreshold ?? 30,
      availabilityEnabled: m?.availabilityEnabled ?? false,
      availabilityThreshold: m?.availabilityThreshold ?? 90,
      availabilityWindow: m?.availabilityWindow ?? 10,
    })
    void loadRules()
  },
  { flush: 'sync' },
)
watch(
  () => [props.projectId, props.monitor?.id],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)

/** 保存监控项后按差异提交绑定关系：失败只提示，不掩盖监控项已保存的事实 */
async function commitBindings(monitorId: string) {
  const target = new Set(selectedIds.value)
  const toBind = [...target].filter((id) => !boundIds.value.includes(id))
  const toUnbind = boundIds.value.filter((id) => !target.has(id))
  if (!toBind.length && !toUnbind.length) return
  try {
    await Promise.all([
      ...toBind.map((id) => bindRuleGroup(props.projectId, monitorId, { ruleGroupId: id })),
      ...toUnbind.map((id) => unbindRuleGroup(props.projectId, monitorId, id)),
    ])
  } catch {
    MessagePlugin.warning(t('ruleGroup.monitor.bindFailed'))
  }
}

async function save() {
  if (submitting.value) return
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
  const project = props.projectId
  const editing = props.monitor?.id
  const token = generation
  submitting.value = true
  try {
    const basic = {
      name: form.name.trim(),
      target: form.target.trim(),
      interval: form.interval,
      timeout: form.timeout,
      failureThreshold: form.failureThreshold,
      availabilityEnabled: form.availabilityEnabled,
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
    )
    const result = editing
      ? await updateMonitor(project, editing, changes)
      : await createMonitor(project, { ...basic, type: form.type, enabled: form.enabled })
    if (token !== generation) return
    await commitBindings(result.id)
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
          :options="[
            { label: 'HTTP / HTTPS', value: 'HTTP' },
            { label: 'TCP', value: 'TCP' },
          ]"
        />
      </t-form-item>
      <t-form-item :label="t('workspace.monitor.target')"
        ><t-input
          v-model="form.target"
          :maxlength="2048"
          :placeholder="t('workspace.monitor.targetPlaceholder')"
      /></t-form-item>
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
      <t-form-item :label="t('monitorPage.availabilityRule')"
        ><t-switch v-model="form.availabilityEnabled"
      /></t-form-item>
      <div v-if="form.availabilityEnabled" class="editor-grid">
        <t-form-item :label="t('monitorPage.availabilityThreshold')"
          ><t-input-number v-model="form.availabilityThreshold" :min="0" :max="100"
        /></t-form-item>
        <t-form-item :label="t('monitorPage.availabilityWindow')"
          ><t-input-number v-model="form.availabilityWindow" :min="1" :max="1000"
        /></t-form-item>
      </div>
      <t-form-item v-if="!monitor" :label="t('workspace.monitor.enabled')"
        ><t-switch v-model="form.enabled"
      /></t-form-item>
    </t-form>
    <!-- 告警规则：选择绑定已有规则组，或直接新增规则组（立即创建并并入本次绑定） -->
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
            <t-button
              size="small"
              variant="text"
              theme="danger"
              @click="unbindRule(group.id)"
              >{{ t('ruleGroup.monitor.unbind') }}</t-button
            >
          </div>
          <RuleTreeView :tree="group.tree" compact />
        </article>
      </div>
      <p v-else class="editor-rules__empty">{{ t('ruleGroup.monitor.empty') }}</p>
      <p v-if="monitor" class="editor-rules__hint">{{ t('ruleGroup.monitor.pendingNote') }}</p>
    </section>
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
