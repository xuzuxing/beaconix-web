<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import {
  createProbe,
  createProbeEnrollment,
  updateProbe,
} from '@/api/modules/probe'
import type { TenantProbe, CreateProbeParams } from '@/api/types/probe'
import type { ProbeCredential } from './ProbeCredentialDialog.vue'
import { useProbeActions } from '@/composables/useProbeActions'
import { permissionEpoch, sessionEpoch } from '@/utils/access-context'
import { PROBE_PROVIDERS, probeProviderLabelKey } from '@/utils/admin-presenter'
import {
  probeFormError,
  probeInstallCommand,
  withoutProbeSecret,
} from '@/utils/probe-presenter'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ orgId: string; probe?: TenantProbe }>()
const emit = defineEmits<{
  saved: [probe?: TenantProbe]
  credential: [credential: ProbeCredential]
}>()
const { t } = useI18n()
const mode = ref('install')
const localError = ref('')
const form = reactive<CreateProbeParams>({
  name: '',
  provider: 'CUSTOM',
  region: '',
  callbackUrl: '',
  enabled: true,
})
const { run, busy, error } = useProbeActions(
  computed(() => (visible.value ? props.orgId : '')),
)
watch(
  visible,
  (open) => {
    localError.value = ''
    if (!open) return
    mode.value = props.probe ? 'manual' : 'install'
    Object.assign(form, {
      name: props.probe?.name ?? '',
      provider: props.probe?.provider ?? 'CUSTOM',
      region: props.probe?.region ?? '',
      callbackUrl: props.probe?.callbackUrl ?? '',
      enabled: props.probe?.enabled ?? true,
    })
  },
  { flush: 'sync' },
)
watch(
  () => [
    props.orgId,
    props.probe?.id,
    permissionEpoch.value,
    sessionEpoch.value,
  ],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)
async function save() {
  const install = !props.probe && mode.value === 'install'
  const problem = probeFormError(form, install)
  localError.value = problem ? t(`probePage.${problem}`) : ''
  if (problem || busy.value) return
  const payload = {
    name: form.name.trim(),
    region: form.region.trim(),
    provider: form.provider,
    callbackUrl: form.callbackUrl.trim(),
    enabled: form.enabled,
  }
  const editing = props.probe?.id
  if (install) {
    const result = await run('save', (orgId) =>
      createProbeEnrollment(orgId, {
        name: payload.name,
        provider: payload.provider,
        region: payload.region,
      }),
    )
    if (!result) return
    visible.value = false
    emit('credential', {
      kind: 'install',
      value: probeInstallCommand(result),
      name: payload.name,
      expiresAt: result.expiresAt,
      apiUrl: result.apiUrl,
    })
    MessagePlugin.success(t('probePage.installReady'))
    return
  }
  const result = await run('save', (orgId) =>
    editing
      ? updateProbe(orgId, editing, payload)
      : createProbe(orgId, payload),
  )
  if (!result) return
  const secret = result.secret
  visible.value = false
  emit('saved', withoutProbeSecret(result))
  if (!editing && secret)
    emit('credential', {
      kind: 'secret',
      value: secret,
      probeId: result.id,
      name: result.name,
    })
  else if (!editing) MessagePlugin.warning(t('probePage.secretMissing'))
  MessagePlugin.success(t(editing ? 'probePage.updated' : 'probePage.created'))
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t(probe ? 'probePage.edit' : 'probePage.createTitle')"
    width="min(560px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), loading: !!busy }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!busy"
    destroy-on-close
    @confirm="save"
  >
    <div class="probe-editor">
      <t-radio-group
        v-if="!probe"
        v-model="mode"
        variant="outline"
      >
        <t-radio-button value="install">{{
          t('probePage.install')
        }}</t-radio-button>
        <t-radio-button value="manual">{{
          t('probePage.manual')
        }}</t-radio-button>
      </t-radio-group>
      <t-alert
        v-if="localError || error"
        theme="error"
        :message="localError || error"
      />
      <t-form
        :data="form"
        label-align="top"
        :colon="false"
      >
        <t-form-item>
          <label class="probe-editor__field">
            <span>{{ t('probePage.name') }}</span>
            <t-input
              v-model="form.name"
              :maxlength="100"
              :placeholder="t('probePage.namePlaceholder')"
            />
          </label>
        </t-form-item>
        <t-form-item :label="t('probePage.provider')"
          ><t-select
            v-model="form.provider"
            :aria-label="t('probePage.provider')"
            :options="
              PROBE_PROVIDERS.map((value) => ({
                value,
                label: t(probeProviderLabelKey(value)),
              }))
            "
        /></t-form-item>
        <t-form-item>
          <label class="probe-editor__field">
            <span>{{ t('probePage.region') }}</span>
            <t-input
              v-model="form.region"
              :maxlength="100"
              :placeholder="t('probePage.regionPlaceholder')"
            />
          </label>
        </t-form-item>
        <template v-if="probe || mode === 'manual'">
          <t-form-item>
            <label class="probe-editor__field">
              <span>{{ t('probePage.callbackUrl') }}</span>
              <t-input
                v-model="form.callbackUrl"
                :maxlength="2048"
                :placeholder="t('probePage.urlPlaceholder')"
              />
            </label>
          </t-form-item>
          <t-form-item :label="t('probePage.enabledLabel')"
            ><t-switch v-model="form.enabled"
          /></t-form-item>
        </template>
      </t-form>
    </div>
  </t-dialog>
</template>

<style scoped>
.probe-editor {
  display: grid;
  gap: 16px;
}
.probe-editor__field {
  display: grid;
  gap: 8px;
  width: 100%;
}
</style>
