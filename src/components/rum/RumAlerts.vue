<script setup lang="ts">
import { onScopeDispose, reactive, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
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
  eventName: '',
  threshold: 1,
  windowMinutes: 5,
  channelIds: [],
  enabled: true,
})
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
    if (metric === 'ERROR_COUNT') form.eventName = ''
  },
)
function edit(rule?: RumAlertRule) {
  editId.value = rule?.id ?? ''
  form.name = rule?.name ?? ''
  form.metric = rule?.metric ?? 'ERROR_COUNT'
  form.eventName = rule?.eventName === '*' ? '' : (rule?.eventName ?? '')
  form.threshold = rule?.threshold ?? 1
  form.windowMinutes = rule?.windowMinutes ?? 5
  form.channelIds = [...(rule?.channelIds ?? [])]
  form.enabled = rule?.enabled ?? true
  mode.value = form.channelIds.length ? 'selected' : 'all'
  visible.value = true
}
async function save() {
  if (submitting.value) return
  const input: RumAlertInput = {
    name: form.name.trim(),
    metric: form.metric,
    threshold: Number(form.threshold),
    windowMinutes: Number(form.windowMinutes),
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
    (input.eventName && !/^[A-Za-z0-9._:*:-]{1,100}$/.test(input.eventName))
  ) {
    void MessagePlugin.error(t('rum.invalid'))
    return
  }
  const id = editId.value
  const original = rules.data.value?.find((x) => x.id === id)
  if (
    original?.enabled &&
    !input.enabled &&
    !window.confirm(t('rum.ruleDisable'))
  )
    return
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
async function remove(rule: RumAlertRule) {
  if (submitting.value || !window.confirm(t('rum.ruleDelete'))) return
  const ctx = accessContext()
  const project = p.value
  const app = a.value
  submitting.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    await deleteRumAlertRule(project, app, rule.id)
    if (isCurrentContext(ctx))
      await Promise.all([rules.reload(), incidents.reload()])
  } catch {
    if (isCurrentContext(ctx)) void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <div class="head">
    <h2>{{ t('rum.alerts') }}</h2>
    <t-button
      v-if="canManage"
      @click="edit()"
      >{{ t('rum.create') }}</t-button
    >
  </div>
  <RumState
    :loading="rules.loading.value"
    :error="rules.error.value"
    @retry="rules.reload"
    ><t-empty
      v-if="!rules.data.value?.length"
      :description="t('rum.empty')"
    />
    <article
      v-for="rule in rules.data.value"
      :key="rule.id"
    >
      <strong>{{ rule.name }}</strong
      ><span
        >{{
          t(
            rule.metric === 'ERROR_COUNT'
              ? 'rum.errorCount'
              : 'rum.eventCountMetric',
          )
        }}
        · {{ rule.eventName || '*' }} · {{ rule.threshold }} /
        {{ rule.windowMinutes }} min</span
      ><span
        >{{ t(rule.enabled ? 'rum.enabled' : 'rum.disabled') }} ·
        {{ t('rum.value') }}: {{ rule.lastValue }}</span
      ><template v-if="canManage"
        ><t-button
          variant="text"
          @click="edit(rule)"
          >{{ t('rum.edit') }}</t-button
        ><t-button
          variant="text"
          :disabled="submitting"
          @click="remove(rule)"
          >{{ t('rum.remove') }}</t-button
        ></template
      >
    </article></RumState
  >
  <h2>{{ t('rum.incidents') }}</h2>
  <t-select
    v-model="status"
    :options="[
      { value: '', label: t('rum.total') },
      { value: 'OPEN', label: 'OPEN' },
      { value: 'RESOLVED', label: 'RESOLVED' },
    ]"
    @change="page = 1"
  /><RumState
    :loading="incidents.loading.value"
    :error="incidents.error.value"
    @retry="incidents.reload"
    ><t-empty
      v-if="!incidents.data.value?.items.length"
      :description="t('rum.empty')" />
    <article
      v-for="incident in incidents.data.value?.items"
      :key="incident.id"
    >
      <strong>{{ incident.rule?.name || incident.ruleId }}</strong
      ><span
        >{{ incident.status }} · {{ t('rum.value') }}: {{ incident.value }} /
        {{ incident.threshold }}</span
      ><span
        >{{ t('rum.started') }}: {{ incident.startedAt }} ·
        {{ t('rum.resolvedAt') }}: {{ incident.resolvedAt || '—' }}</span
      >
    </article>
    <RumPager
      v-if="incidents.data.value"
      v-model="page"
      :total="incidents.data.value.total"
      :limit="incidents.data.value.limit"
  /></RumState>
  <t-dialog
    v-model:visible="visible"
    :header="t(editId ? 'rum.edit' : 'rum.create')"
    :confirm-btn="t('rum.save')"
    :cancel-btn="t('rum.cancel')"
    :confirm-loading="submitting"
    @confirm="save"
    ><div class="form">
      <label
        >{{ t('rum.name')
        }}<t-input
          v-model="form.name"
          maxlength="100" /></label
      ><label
        >{{ t('rum.metric')
        }}<t-select
          v-model="form.metric"
          :options="[
            { value: 'ERROR_COUNT', label: t('rum.errorCount') },
            { value: 'EVENT_COUNT', label: t('rum.eventCountMetric') },
          ]" /></label
      ><label v-if="form.metric === 'EVENT_COUNT'"
        >{{ t('rum.eventName')
        }}<t-input
          v-model="form.eventName"
          :placeholder="t('rum.allEvents')"
          maxlength="100" /></label
      ><label
        >{{ t('rum.threshold')
        }}<t-input-number
          v-model="form.threshold"
          :min="1"
          :max="1000000" /></label
      ><label
        >{{ t('rum.window')
        }}<t-input-number
          v-model="form.windowMinutes"
          :min="1"
          :max="1440" /></label
      ><label
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
          role="alert"
        >
          {{ t('rum.channelsUnavailable') }}
        </p>
        <RumState
          v-if="mode === 'selected'"
          :loading="channels.loading.value"
          :error="channels.error.value"
          @retry="channels.reload"
          ><t-select
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
        /></RumState>
      </fieldset></div
  ></t-dialog>
</template>
<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
article {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  padding: 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  overflow-wrap: anywhere;
}
article span {
  color: var(--td-text-color-secondary);
}
.form {
  display: grid;
  gap: 12px;
}
.form label {
  display: grid;
  gap: 4px;
}
fieldset {
  display: grid;
  gap: 8px;
}
select[multiple] {
  min-height: 100px;
  width: 100%;
}
</style>
