<script setup lang="ts">
import dayjs from 'dayjs'
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createApiKey } from '@/api'
import type { ApiKeyScope } from '@/api/types/team'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { permissionEpoch } from '@/utils/access-context'
import { API_KEY_SCOPES, apiKeyScopeLabelKey } from '@/utils/team-presenter'

/**
 * 创建 API 密钥：名称 + 权限范围 + 可选过期时间。
 * 创建成功后由父组件接管密钥的「仅展示一次」弹窗。
 */
defineOptions({ name: 'ApiKeyCreateDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ orgId: string }>()
const emit = defineEmits<{ created: [key: string] }>()
const { t } = useI18n()
const permissions = usePermissionsStore()

const form = reactive({
  name: '',
  scopes: ['monitors:read'] as ApiKeyScope[],
  expiry: 'never' as 'never' | 'custom',
  expiresAt: '',
})
const submitting = ref(false)
const error = ref('')
let generation = 0

const scopeOptions = computed(() =>
  API_KEY_SCOPES.map((scope) => ({ label: t(apiKeyScopeLabelKey(scope)), value: scope })),
)

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    if (!value) return
    form.name = ''
    form.scopes = ['monitors:read']
    form.expiry = 'never'
    form.expiresAt = ''
  },
  { flush: 'sync' },
)

// 切换团队时关闭弹窗，避免把密钥建到上一个团队
watch(
  () => [props.orgId, permissionEpoch.value],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)

function validate(): string {
  if (!form.name.trim()) return t('workspace.apiKey.nameRequired')
  if (!form.scopes.length) return t('workspace.apiKey.scopesRequired')
  if (form.expiry === 'custom') {
    if (!form.expiresAt) return t('workspace.apiKey.expiresInvalid')
    const expires = dayjs(form.expiresAt)
    if (!expires.isValid() || !expires.isAfter(dayjs())) return t('workspace.apiKey.expiresInvalid')
  }
  return ''
}

async function submit() {
  if (submitting.value || !permissions.canOrganization(props.orgId)) return
  const message = validate()
  if (message) {
    error.value = message
    return
  }

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    const id = props.orgId
    await permissions.ensureOrganization(id, true)
    if (token !== generation || !visible.value || !permissions.canOrganization(id)) return
    const result = await createApiKey(id, {
      name: form.name.trim(),
      scopes: [...form.scopes],
      ...(form.expiry === 'custom' ? { expiresAt: dayjs(form.expiresAt).toISOString() } : {}),
    })
    if (token !== generation) return
    MessagePlugin.success(t('workspace.apiKey.created'))
    visible.value = false
    emit('created', result.key ?? '')
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('workspace.apiKey.createFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.apiKey.createTitle')"
    width="min(520px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('workspace.apiKey.create'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert v-if="error" theme="error" :message="error" class="api-key-create__error" />

    <t-form label-align="top" :colon="false" :data="form">
      <t-form-item :label="t('workspace.apiKey.name')">
        <t-input
          v-model="form.name"
          :maxlength="100"
          :placeholder="t('workspace.apiKey.namePlaceholder')"
        />
      </t-form-item>

      <t-form-item :label="t('workspace.apiKey.scopes')" :help="t('workspace.apiKey.scopesHint')">
        <t-checkbox-group v-model="form.scopes" :options="scopeOptions" />
      </t-form-item>

      <t-form-item :label="t('workspace.apiKey.expiresAt')">
        <div class="api-key-create__expiry">
          <t-radio-group v-model="form.expiry">
            <t-radio value="never">{{ t('workspace.apiKey.expiresNever') }}</t-radio>
            <t-radio value="custom">{{ t('workspace.apiKey.expiresCustom') }}</t-radio>
          </t-radio-group>
          <t-date-picker
            v-if="form.expiry === 'custom'"
            v-model="form.expiresAt"
            enable-time-picker
            format="YYYY-MM-DD HH:mm"
            :placeholder="t('workspace.apiKey.expiresAt')"
          />
        </div>
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.api-key-create {
  &__error {
    margin-bottom: 16px;
  }

  &__expiry {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>
