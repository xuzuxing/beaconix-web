<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import {
  createRumAlertRule,
  deleteRumAlertRule,
  listRumAlertChannels,
  listRumAlertIncidents,
  listRumAlertRules,
  updateRumAlertRule,
} from '@/api/modules/rum'
import type { RumAlertInput, RumAlertRule } from '@/api/types/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  workspaceEpoch,
} from '@/utils/access-context'
import RumState from './RumState.vue'
import RumPager from './RumPager.vue'
const { t } = useI18n()
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const { projectId: p, appId: a, canManage, authorizeWrite } = useRumContext()
const page = ref(1)
const status = ref('')
const submitting = ref(false)
const visible = ref(false)
const editId = ref('')
const mode = ref<'all' | 'selected'>('all')
const form = reactive<RumAlertInput>({
  name: '',
  metric: 'ERROR_COUNT',
  scope: 'APP',
  groupId: '',
  eventName: '',
  threshold: 1,
  windowMinutes: 5,
  confirmWindows: 1,
  channelIds: [],
  enabled: true,
})
const ruleColumns = [
  { colKey: 'name', title: t('rum.name'), ellipsis: true },
  { colKey: 'metric', title: t('rum.metric'), width: 240 },
  { colKey: 'threshold', title: t('rum.threshold'), width: 160 },
  { colKey: 'enabled', title: t('rum.status'), width: 100 },
  { colKey: 'lastValue', title: t('rum.value'), width: 110 },
  { colKey: 'action', title: '', width: 240 },
]
const incidentColumns = [
  { colKey: 'rule', title: t('rum.rule') },
  { colKey: 'status', title: t('rum.status'), width: 120 },
  { colKey: 'value', title: t('rum.value'), width: 130 },
  { colKey: 'startedAt', title: t('rum.started'), width: 190 },
  { colKey: 'resolvedAt', title: t('rum.resolvedAt'), width: 190 },
]
const rules = useRumResource(
  (signal) => listRumAlertRules(p.value, a.value, { signal }),
  [p, a],
)
const incidents = useRumResource(
  (signal) =>
    listRumAlertIncidents(
      p.value,
      a.value,
      { page: page.value, limit: 20, status: status.value || undefined },
      { signal },
    ),
  [p, a, page, status],
)
const channels = useRumResource(
  (signal) =>
    canManage.value
      ? listRumAlertChannels(p.value, a.value, { signal })
      : Promise.resolve([]),
  [p, a, canManage],
)
watch(
  [p, a, permissionEpoch, workspaceEpoch],
  () => {
    visible.value = false
    editId.value = ''
    form.channelIds = []
  },
  { flush: 'sync' },
)
watch(
  () => form.metric,
  (metric) => {
    if (metric !== 'EVENT_COUNT') form.eventName = ''
    if (metric === 'EVENT_COUNT') form.scope = 'APP'
  },
)
const metricOptions = computed(() => [
  { value: 'ERROR_COUNT', label: t('rum.errorCount') },
  { value: 'EVENT_COUNT', label: t('rum.eventCountMetric') },
  { value: 'NEW_ERROR', label: t('rum.newErrorMetric') },
  { value: 'ERROR_RATE', label: t('rum.errorRateMetric') },
  { value: 'SPIKE', label: t('rum.spikeMetric') },
])
const scopeOptions = computed(() => [
  { value: 'APP', label: t('rum.scopeApp') },
  { value: 'ERROR_GROUP', label: t('rum.scopeGroup') },
])
const metricLabel = (metric: RumAlertRule['metric']) =>
  t(
    metric === 'EVENT_COUNT'
      ? 'rum.eventCountMetric'
      : metric === 'NEW_ERROR'
        ? 'rum.newErrorMetric'
        : metric === 'ERROR_RATE'
          ? 'rum.errorRateMetric'
          : metric === 'SPIKE'
            ? 'rum.spikeMetric'
            : 'rum.errorCount',
  )
const silenced = (rule: RumAlertRule) =>
  !!rule.silenceUntil && new Date(rule.silenceUntil).getTime() > Date.now()
async function applySilence(rule: RumAlertRule, hours: number) {
  const ctx = accessContext()
  submitting.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    await updateRumAlertRule(p.value, a.value, rule.id, {
      silenceUntil: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
    })
    if (isCurrentContext(ctx)) await rules.reload()
  } catch {
    if (isCurrentContext(ctx)) void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}
/** 规则停用与删除都会自动恢复活动告警，统一用 TDesign 确认弹窗 */
function confirmAction(body: string, onConfirm: () => void) {
  const dialog = DialogPlugin.confirm({
    header: t('rum.alerts'),
    body,
    theme: 'warning',
    confirmBtn: t('common.confirm'),
    cancelBtn: t('common.cancel'),
    onConfirm: () => {
      dialog.destroy()
      onConfirm()
    },
    onCancel: () => dialog.destroy(),
    onClose: () => dialog.destroy(),
  })
}
function edit(rule?: RumAlertRule) {
  editId.value = rule?.id ?? ''
  form.name = rule?.name ?? ''
  form.metric = rule?.metric ?? 'ERROR_COUNT'
  form.scope = rule?.scope ?? 'APP'
  form.groupId = rule?.groupId ?? ''
  form.confirmWindows = rule?.confirmWindows ?? 1
  form.eventName = rule?.eventName === '*' ? '' : (rule?.eventName ?? '')
  form.threshold = rule?.threshold ?? 1
  form.windowMinutes = rule?.windowMinutes ?? 5
  form.channelIds = [...(rule?.channelIds ?? [])]
  form.enabled = rule?.enabled ?? true
  mode.value = form.channelIds.length ? 'selected' : 'all'
  visible.value = true
}
async function applySave(input: RumAlertInput) {
  const id = editId.value
  const ctx = accessContext()
  const project = p.value
  const app = a.value
  submitting.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    if (id) await updateRumAlertRule(project, app, id, input)
    else await createRumAlertRule(project, app, input)
    if (isCurrentContext(ctx)) {
      visible.value = false
      await Promise.all([rules.reload(), incidents.reload()])
    }
  } catch {
    if (isCurrentContext(ctx)) void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}
function save() {
  if (submitting.value) return
  const input: RumAlertInput = {
    name: form.name.trim(),
    metric: form.metric,
    scope: form.scope,
    groupId: form.scope === 'ERROR_GROUP' ? form.groupId?.trim() : undefined,
    threshold: Number(form.threshold),
    windowMinutes: Number(form.windowMinutes),
    confirmWindows: Number(form.confirmWindows ?? 1),
    channelIds: mode.value === 'all' ? [] : [...form.channelIds],
    enabled: form.enabled,
  }
  if (input.metric === 'EVENT_COUNT')
    input.eventName = form.eventName?.trim() || '*'
  if (
    !input.name ||
    input.name.length > 100 ||
    !Number.isInteger(input.threshold) ||
    input.threshold < 1 ||
    input.threshold > 1000000 ||
    !Number.isInteger(input.windowMinutes) ||
    input.windowMinutes < 1 ||
    input.windowMinutes > 1440 ||
    (mode.value === 'selected' &&
      (input.channelIds.length === 0 || input.channelIds.length > 20)) ||
    !Number.isInteger(input.confirmWindows) ||
    (input.confirmWindows ?? 1) < 1 ||
    (input.confirmWindows ?? 1) > 10 ||
    (input.scope === 'ERROR_GROUP' && !input.groupId) ||
    (input.eventName && !/^[A-Za-z0-9._:*:-]{1,100}$/.test(input.eventName))
  ) {
    void MessagePlugin.error(t('rum.invalid'))
    return
  }
  const original = rules.data.value?.find((x) => x.id === editId.value)
  if (original?.enabled && !input.enabled) {
    confirmAction(t('rum.ruleDisable'), () => {
      void applySave(input)
    })
    return
  }
  void applySave(input)
}
async function applyRemove(id: string) {
  const ctx = accessContext()
  const project = p.value
  const app = a.value
  submitting.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    await deleteRumAlertRule(project, app, id)
    if (isCurrentContext(ctx))
      await Promise.all([rules.reload(), incidents.reload()])
  } catch {
    if (isCurrentContext(ctx)) void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}
function remove(rule: RumAlertRule) {
  if (submitting.value) return
  confirmAction(t('rum.ruleDelete'), () => {
    void applyRemove(rule.id)
  })
}
</script>
<template>
  <t-card class="rum-alerts">
    <template #title>{{ t('rum.alerts') }}</template>
    <template #actions>
      <t-button
        v-if="canManage"
        @click="edit()"
        >{{ t('rum.create') }}</t-button
      >
    </template>
    <RumState
      :loading="rules.loading.value"
      :error="rules.error.value"
      @retry="rules.reload"
    >
      <t-table
        row-key="id"
        :data="rules.data.value ?? []"
        :columns="ruleColumns"
        :empty="t('rum.empty')"
        hover
      >
        <template #name="{ row }"
          ><span class="rum-alerts__name">{{ row.name }}</span></template
        >
        <template #metric="{ row }"
          ><span class="rum-alerts__muted"
            >{{ metricLabel(row.metric) }} · {{ row.eventName || '*' }}
            <template v-if="row.scope === 'ERROR_GROUP'">
              · {{ t('rum.scopeGroup') }}</template
            >
            <template v-if="silenced(row)">
              · {{ t('rum.silenced') }}</template
            ></span
          ></template
        >
        <template #threshold="{ row }"
          ><span class="rum-alerts__muted"
            >{{ row.threshold }} / {{ row.windowMinutes }} min</span
          ></template
        >
        <template #enabled="{ row }"
          ><t-tag
            :theme="row.enabled ? 'success' : 'default'"
            variant="light"
            >{{ t(row.enabled ? 'rum.enabled' : 'rum.disabled') }}</t-tag
          ></template
        >
        <template #lastValue="{ row }"
          ><span class="rum-alerts__muted">{{ row.lastValue }}</span></template
        >
        <template #action="{ row }"
          ><template v-if="canManage"
            ><t-link
              theme="primary"
              @click="edit(row)"
              >{{ t('rum.edit') }}</t-link
            ><t-dropdown
              :options="[
                { value: 1, content: t('rum.silence1h') },
                { value: 24, content: t('rum.silence1d') },
                { value: 168, content: t('rum.silence7d') },
              ]"
              @click="
                (data: { value: number }) => applySilence(row, data.value)
              "
              ><t-link theme="primary">{{
                t('rum.silence')
              }}</t-link></t-dropdown
            ><t-link
              class="rum-alerts__remove"
              theme="danger"
              :disabled="submitting"
              @click="remove(row)"
              >{{ t('rum.remove') }}</t-link
            ></template
          ></template
        >
      </t-table>
    </RumState>
  </t-card>
  <t-card class="rum-alerts rum-alerts--incidents">
    <template #title>{{ t('rum.incidents') }}</template>
    <template #actions>
      <t-select
        v-model="status"
        class="rum-alerts__status"
        :options="[
          { value: '', label: t('rum.total') },
          { value: 'OPEN', label: 'OPEN' },
          { value: 'RESOLVED', label: 'RESOLVED' },
        ]"
        @change="page = 1"
      />
    </template>
    <RumState
      :loading="incidents.loading.value"
      :error="incidents.error.value"
      @retry="incidents.reload"
    >
      <template v-if="incidents.data.value">
        <t-table
          row-key="id"
          :data="incidents.data.value.items"
          :columns="incidentColumns"
          :empty="t('rum.empty')"
          hover
        >
          <template #rule="{ row }"
            ><span class="rum-alerts__name">{{
              row.rule?.name || row.ruleId
            }}</span></template
          >
          <template #status="{ row }"
            ><t-tag
              :theme="row.status === 'OPEN' ? 'warning' : 'success'"
              variant="light"
              >{{ row.status }}</t-tag
            ></template
          >
          <template #value="{ row }"
            ><span class="rum-alerts__muted"
              >{{ row.value }} / {{ row.threshold }}</span
            ></template
          >
          <template #resolvedAt="{ row }">{{ row.resolvedAt || '—' }}</template>
        </t-table>
        <RumPager
          v-model="page"
          :total="incidents.data.value.total"
          :limit="incidents.data.value.limit"
        />
      </template>
    </RumState>
  </t-card>
  <t-dialog
    v-model:visible="visible"
    :header="t(editId ? 'rum.edit' : 'rum.create')"
    :confirm-btn="t('rum.save')"
    :cancel-btn="t('rum.cancel')"
    :confirm-loading="submitting"
    @confirm="save"
  >
    <div class="form">
      <label
        >{{ t('rum.name')
        }}<t-input
          v-model="form.name"
          maxlength="100"
      /></label>
      <label
        >{{ t('rum.metric')
        }}<t-select
          v-model="form.metric"
          :options="metricOptions"
      /></label>
      <label v-if="form.metric !== 'EVENT_COUNT'"
        >{{ t('rum.scope')
        }}<t-select
          v-model="form.scope"
          :options="scopeOptions"
      /></label>
      <label v-if="form.scope === 'ERROR_GROUP'"
        >{{ t('rum.errorGroupId')
        }}<t-input
          v-model="form.groupId"
          :placeholder="t('rum.errorGroupIdHint')"
          maxlength="64"
      /></label>
      <label v-if="form.metric === 'EVENT_COUNT'"
        >{{ t('rum.eventName')
        }}<t-input
          v-model="form.eventName"
          :placeholder="t('rum.allEvents')"
          maxlength="100"
      /></label>
      <label
        >{{ t('rum.threshold')
        }}<t-input-number
          v-model="form.threshold"
          :min="1"
          :max="1000000"
      /></label>
      <label
        >{{ t('rum.window')
        }}<t-input-number
          v-model="form.windowMinutes"
          :min="1"
          :max="1440"
      /></label>
      <label
        >{{ t('rum.confirmWindows')
        }}<t-input-number
          v-model="form.confirmWindows"
          :min="1"
          :max="10"
      /></label>
      <label
        ><t-checkbox v-model="form.enabled">{{
          t('rum.enabled')
        }}</t-checkbox></label
      >
      <fieldset>
        <legend>{{ t('rum.channels') }}</legend>
        <t-radio-group v-model="mode"
          ><t-radio value="all">{{ t('rum.allChannels') }}</t-radio
          ><t-radio value="selected">{{
            t('rum.selectedChannels')
          }}</t-radio></t-radio-group
        >
        <p
          v-if="mode === 'selected' && channels.error.value"
          class="rum-alerts__muted"
          role="alert"
        >
          {{ t('rum.channelsUnavailable') }}
        </p>
        <RumState
          v-if="mode === 'selected'"
          :loading="channels.loading.value"
          :error="channels.error.value"
          @retry="channels.reload"
        >
          <t-select
            v-model="form.channelIds"
            multiple
            :options="
              (channels.data.value ?? []).map((channel) => ({
                value: channel.id,
                label:
                  channel.name +
                  (channel.enabled ? '' : ' (' + t('rum.disabled') + ')'),
              }))
            "
          />
        </RumState>
      </fieldset>
    </div>
  </t-dialog>
</template>
<style scoped lang="less">
.rum-alerts {
  min-width: 0;
  margin-bottom: @beacon-gap-l;

  &__name {
    color: @beacon-text-primary;
  }

  &__muted {
    color: @beacon-text-secondary;
  }

  &__remove {
    margin-left: @beacon-gap-l;
  }

  &__status {
    width: 160px;
  }

  .form {
    display: grid;
    gap: @beacon-gap-l;
  }

  .form label {
    display: grid;
    gap: 4px;
    color: @beacon-text-secondary;
  }

  fieldset {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }
}
</style>
