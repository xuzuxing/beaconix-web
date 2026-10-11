<script setup lang="ts">
import dayjs from 'dayjs'
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createPersonalAccessToken } from '@/api'
import type { PersonalAccessTokenScope } from '@/api/types/personal-access-token'
import { formatDateTime } from '@/utils/billing'
import {
  PAT_SCOPES,
  patDefaultExpiry,
  patScopeLabelKey,
  validatePatCreate,
} from '@/utils/personal-access-token-presenter'

/**
 * 创建个人访问令牌：名称 + 权限范围（仅作标记）+ 过期时间（默认 30 天或自定义）。
 * 创建成功后由父组件接管令牌的「仅展示一次」弹窗。
 */
defineOptions({ name: 'PersonalAccessTokenCreateDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [token: string] }>()
const { t } = useI18n()

const form = reactive({
  name: '',
  scopes: ['monitors:read'] as PersonalAccessTokenScope[],
  expiry: 'default' as 'default' | 'custom',
  expiresAt: '',
})
const submitting = ref(false)
const error = ref('')
let generation = 0

const scopeOptions = computed(() =>
  PAT_SCOPES.map((scope) => ({ label: t(patScopeLabelKey(scope)), value: scope })),
)
const defaultExpiry = computed(() => formatDateTime(patDefaultExpiry()))

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    form.name = ''
    form.scopes = ['monitors:read']
    form.expiry = 'default'
    form.expiresAt = ''
    if (!value) return
  },
  { flush: 'sync' },
)

async function submit() {
  if (submitting.value) return
  const code = validatePatCreate(form)
  if (code) {
    error.value = t(`workspace.pat.validation.${code}`)
    return
  }

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    const result = await createPersonalAccessToken({
      name: form.name.trim(),
      scopes: [...form.scopes],
      ...(form.expiry === 'custom' ? { expiresAt: dayjs(form.expiresAt).toISOString() } : {}),
    })
    if (token !== generation) return
    MessagePlugin.success(t('workspace.pat.created'))
    visible.value = false
    emit('created', result.token ?? '')
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('workspace.pat.createFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.pat.createTitle')"
    width="min(520px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('workspace.pat.create'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert v-if="error" theme="error" :message="error" class="pat-create__error" />

    <t-form label-align="top" :colon="false" :data="form">
      <t-form-item :label="t('workspace.pat.name')">
        <t-input
          v-model="form.name"
          :maxlength="100"
          :placeholder="t('workspace.pat.namePlaceholder')"
        />
      </t-form-item>

      <t-form-item :label="t('workspace.pat.scopes')" :help="t('workspace.pat.scopesHint')">
        <t-checkbox-group v-model="form.scopes" :options="scopeOptions" />
      </t-form-item>

      <t-form-item :label="t('workspace.pat.expiresAt')">
        <div class="pat-create__expiry">
          <t-radio-group v-model="form.expiry">
            <t-radio value="default">{{ t('workspace.pat.expiresDefault') }}</t-radio>
            <t-radio value="custom">{{ t('workspace.pat.expiresCustom') }}</t-radio>
          </t-radio-group>
          <p v-if="form.expiry === 'default'" class="pat-create__hint">
            {{ t('workspace.pat.expiresDefaultHint', { time: defaultExpiry }) }}
          </p>
          <t-date-picker
            v-else
            v-model="form.expiresAt"
            enable-time-picker
            format="YYYY-MM-DD HH:mm"
            :placeholder="t('workspace.pat.expiresAt')"
          />
        </div>
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.pat-create {
  &__error {
    margin-bottom: 16px;
  }

  &__expiry {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  &__hint {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
