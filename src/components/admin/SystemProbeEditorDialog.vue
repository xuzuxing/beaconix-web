<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CreateSystemProbeParams, ProbeProvider, SystemProbe } from '@/api/types/admin'
import { PROBE_PROVIDERS, probeProviderLabelKey } from '@/utils/admin-presenter'

/**
 * 系统探针的新建 / 编辑表单。
 * 提交由父组件完成（创建成功需要接管「密钥仅展示一次」弹窗），
 * 这里只负责校验与组装参数，通过 submitting / error 两个 prop 回显状态。
 */
defineOptions({ name: 'SystemProbeEditorDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{
  /** 传 null 表示新建 */
  probe: SystemProbe | null
  submitting?: boolean
  error?: string
}>()
const emit = defineEmits<{ submit: [data: CreateSystemProbeParams] }>()
const { t } = useI18n()

const form = reactive({
  name: '',
  provider: 'TENCENT' as ProbeProvider,
  region: '',
  callbackUrl: '',
  enabled: true,
  maxTenants: 0,
  priority: 0,
})

const localError = ref('')

const providerOptions = computed(() =>
  PROBE_PROVIDERS.map((provider) => ({
    label: t(probeProviderLabelKey(provider)),
    value: provider,
  })),
)

const header = computed(() =>
  props.probe ? t('adminPage.probe.editTitle') : t('adminPage.probe.createTitle'),
)

const message = computed(() => props.error || localError.value)

watch(
  visible,
  (value) => {
    localError.value = ''
    if (!value) return
    const probe = props.probe
    form.name = probe?.name ?? ''
    form.provider = probe?.provider ?? 'TENCENT'
    form.region = probe?.region ?? ''
    form.callbackUrl = probe?.callbackUrl ?? ''
    form.enabled = probe?.enabled ?? true
    form.maxTenants = probe?.maxTenants ?? 0
    form.priority = probe?.priority ?? 0
  },
  { flush: 'sync' },
)

function validate(): string {
  if (!form.name.trim() || !form.region.trim() || !form.callbackUrl.trim()) {
    return t('adminPage.probe.required')
  }
  if (!/^https?:\/\/.+/i.test(form.callbackUrl.trim())) {
    return t('adminPage.probe.invalidCallbackUrl')
  }
  return ''
}

function submit() {
  if (props.submitting) return
  const error = validate()
  localError.value = error
  if (error) return

  emit('submit', {
    name: form.name.trim(),
    provider: form.provider,
    region: form.region.trim(),
    callbackUrl: form.callbackUrl.trim(),
    enabled: form.enabled,
    maxTenants: Number(form.maxTenants) || 0,
    priority: Number(form.priority) || 0,
  })
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="header"
    width="min(560px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('adminPage.common.confirm'), loading: submitting }"
    :cancel-btn="t('adminPage.common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert v-if="message" theme="error" :message="message" class="probe-editor__error" />

    <t-form label-align="top" :colon="false" :data="form">
      <t-form-item :label="t('adminPage.probe.formName')">
        <t-input v-model="form.name" :maxlength="100" :placeholder="t('adminPage.probe.formNamePlaceholder')" />
      </t-form-item>

      <t-form-item :label="t('adminPage.probe.formProvider')">
        <t-select v-model="form.provider" :options="providerOptions" />
      </t-form-item>

      <t-form-item :label="t('adminPage.probe.formRegion')">
        <t-input v-model="form.region" :placeholder="t('adminPage.probe.formRegionPlaceholder')" />
      </t-form-item>

      <t-form-item :label="t('adminPage.probe.formCallbackUrl')">
        <t-input v-model="form.callbackUrl" :placeholder="t('adminPage.probe.formCallbackUrlPlaceholder')" />
      </t-form-item>

      <t-form-item>
        <t-space direction="vertical" size="4px">
          <t-checkbox v-model="form.enabled">{{ t('adminPage.probe.formEnabled') }}</t-checkbox>
        </t-space>
      </t-form-item>

      <t-form-item :label="t('adminPage.probe.maxTenants')" :help="t('adminPage.probe.formMaxTenants')">
        <t-input-number v-model="form.maxTenants" :min="0" theme="normal" />
      </t-form-item>

      <t-form-item :label="t('adminPage.probe.priority')" :help="t('adminPage.probe.formPriority')">
        <t-input-number v-model="form.priority" :min="0" theme="normal" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.probe-editor {
  &__error {
    margin-bottom: 16px;
  }
}
</style>
