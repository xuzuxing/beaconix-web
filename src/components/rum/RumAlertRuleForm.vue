<script setup lang="ts">
import { reactive, shallowRef, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import type {
  RumAlertChannel,
  RumAlertInput,
  RumAlertMetric,
  RumAlertRule,
  RumAlertScope,
} from '@/api/types/rum'
import RumState from './RumState.vue'

const props = defineProps<{
  visible: boolean
  rule: RumAlertRule | null
  channels: RumAlertChannel[]
  channelsLoading: boolean
  channelsError: boolean
  saving: boolean
}>()
const emit = defineEmits<{
  cancel: []
  save: [input: RumAlertInput]
  retryChannels: []
}>()
const { t } = useI18n()
const channelMode = shallowRef<'all' | 'selected'>('all')
const form = reactive({
  name: '',
  metric: 'ERROR_COUNT' as RumAlertMetric,
  scope: 'APP' as RumAlertScope,
  groupId: '',
  eventName: '',
  threshold: 1,
  windowMinutes: 5,
  confirmWindows: 1,
  silenceUntil: '',
  channelIds: [] as string[],
  enabled: true,
})

watch(
  () => [props.visible, props.rule] as const,
  ([visible, rule]) => {
    if (!visible) return
    form.name = rule?.name ?? ''
    form.metric = rule?.metric ?? 'ERROR_COUNT'
    form.scope = rule?.scope ?? 'APP'
    form.groupId = rule?.groupId ?? ''
    form.eventName = rule?.eventName === '*' ? '' : (rule?.eventName ?? '')
    form.threshold = rule?.threshold ?? 1
    form.windowMinutes = rule?.windowMinutes ?? 5
    form.confirmWindows = rule?.confirmWindows ?? 1
    form.silenceUntil = rule?.silenceUntil ?? ''
    form.channelIds = [...(rule?.channelIds ?? [])]
    form.enabled = rule?.enabled ?? true
    channelMode.value = form.channelIds.length ? 'selected' : 'all'
  },
  { immediate: true },
)

watch(
  () => form.metric,
  (metric) => {
    if (metric !== 'EVENT_COUNT') form.eventName = ''
    if (metric === 'EVENT_COUNT') form.scope = 'APP'
  },
)

watch(
  () => form.scope,
  (scope) => {
    if (scope === 'APP') form.groupId = ''
  },
)

function submit() {
  const silenceDate = form.silenceUntil ? new Date(form.silenceUntil) : null
  if (silenceDate && Number.isNaN(silenceDate.getTime())) {
    void MessagePlugin.error(t('rum.invalid'))
    return
  }
  const input: RumAlertInput = {
    name: form.name.trim(),
    metric: form.metric,
    scope: form.scope,
    threshold: Number(form.threshold),
    windowMinutes: Number(form.windowMinutes),
    confirmWindows: Number(form.confirmWindows),
    silenceUntil: silenceDate?.toISOString() ?? null,
    channelIds: channelMode.value === 'all' ? [] : [...form.channelIds],
    enabled: form.enabled,
  }
  if (input.metric === 'EVENT_COUNT')
    input.eventName = form.eventName.trim() || '*'
  if (input.scope === 'ERROR_GROUP') input.groupId = form.groupId.trim()
  if (
    !input.name ||
    input.name.length > 100 ||
    !Number.isInteger(input.threshold) ||
    input.threshold < 1 ||
    input.threshold > 1_000_000 ||
    !Number.isInteger(input.windowMinutes) ||
    input.windowMinutes < 1 ||
    input.windowMinutes > 1440 ||
    !Number.isInteger(input.confirmWindows) ||
    (input.confirmWindows ?? 0) < 1 ||
    (input.confirmWindows ?? 0) > 10 ||
    (input.scope === 'ERROR_GROUP' && !input.groupId) ||
    (channelMode.value === 'selected' &&
      (input.channelIds.length === 0 || input.channelIds.length > 20)) ||
    (input.eventName && !/^[A-Za-z0-9._:*:-]{1,100}$/.test(input.eventName))
  ) {
    void MessagePlugin.error(t('rum.invalid'))
    return
  }
  emit('save', input)
}
</script>

<template>
  <t-dialog
    :visible="visible"
    :header="t(rule ? 'rum.edit' : 'rum.create')"
    :confirm-btn="t('rum.save')"
    :cancel-btn="t('rum.cancel')"
    :confirm-loading="saving"
    width="680px"
    @confirm="submit"
    @cancel="emit('cancel')"
    @close="emit('cancel')"
  >
    <div class="alert-form">
      <label>
        {{ t('rum.name') }}
        <t-input
          v-model="form.name"
          maxlength="100"
        />
      </label>
      <div class="alert-form__row">
        <label>
          {{ t('rum.metric') }}
          <t-select
            v-model="form.metric"
            :options="[
              { value: 'ERROR_COUNT', label: t('rum.alertMetric.ERROR_COUNT') },
              { value: 'EVENT_COUNT', label: t('rum.alertMetric.EVENT_COUNT') },
              { value: 'NEW_ERROR', label: t('rum.alertMetric.NEW_ERROR') },
              { value: 'ERROR_RATE', label: t('rum.alertMetric.ERROR_RATE') },
              { value: 'SPIKE', label: t('rum.alertMetric.SPIKE') },
            ]"
          />
        </label>
        <label>
          {{ t('rum.alertScopeLabel') }}
          <t-select
            v-model="form.scope"
            :disabled="form.metric === 'EVENT_COUNT'"
            :options="[
              { value: 'APP', label: t('rum.alertScope.APP') },
              { value: 'ERROR_GROUP', label: t('rum.alertScope.ERROR_GROUP') },
            ]"
          />
        </label>
      </div>
      <t-alert
        theme="info"
        :message="t(`rum.alertMetricHint.${form.metric}`)"
      />
      <label v-if="form.metric === 'EVENT_COUNT'">
        {{ t('rum.eventName') }}
        <t-input
          v-model="form.eventName"
          :placeholder="t('rum.allEvents')"
          maxlength="100"
        />
      </label>
      <label v-if="form.scope === 'ERROR_GROUP'">
        {{ t('rum.errorGroupId') }}
        <t-input
          v-model="form.groupId"
          :placeholder="t('rum.errorGroupIdHint')"
          maxlength="64"
        />
      </label>
      <div class="alert-form__row alert-form__row--three">
        <label>
          {{ t('rum.threshold') }}
          <t-input-number
            v-model="form.threshold"
            :min="1"
            :max="1000000"
          />
        </label>
        <label>
          {{ t('rum.window') }}
          <t-input-number
            v-model="form.windowMinutes"
            :min="1"
            :max="1440"
          />
        </label>
        <label>
          {{ t('rum.confirmWindows') }}
          <t-input-number
            v-model="form.confirmWindows"
            :min="1"
            :max="10"
          />
        </label>
      </div>
      <label>
        {{ t('rum.silenceUntil') }}
        <t-date-picker
          v-model="form.silenceUntil"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          clearable
        />
      </label>
      <label>
        <t-checkbox v-model="form.enabled">{{ t('rum.enabled') }}</t-checkbox>
      </label>
      <fieldset>
        <legend>{{ t('rum.channels') }}</legend>
        <t-radio-group v-model="channelMode">
          <t-radio value="all">{{ t('rum.allChannels') }}</t-radio>
          <t-radio value="selected">{{ t('rum.selectedChannels') }}</t-radio>
        </t-radio-group>
        <RumState
          v-if="channelMode === 'selected'"
          :loading="channelsLoading"
          :error="channelsError"
          @retry="emit('retryChannels')"
        >
          <t-select
            v-model="form.channelIds"
            multiple
            :options="
              channels.map((channel) => ({
                value: channel.id,
                label:
                  channel.name +
                  (channel.enabled ? '' : ` (${t('rum.disabled')})`),
              }))
            "
          />
        </RumState>
      </fieldset>
    </div>
  </t-dialog>
</template>

<style scoped>
.alert-form {
  display: grid;
  gap: 14px;
}

.alert-form label {
  display: grid;
  gap: 6px;
}

.alert-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.alert-form__row--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.alert-form fieldset {
  display: grid;
  gap: 10px;
}

@media (max-width: 640px) {
  .alert-form__row,
  .alert-form__row--three {
    grid-template-columns: 1fr;
  }
}
</style>
