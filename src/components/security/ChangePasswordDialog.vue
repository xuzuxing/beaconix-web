<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { changePassword } from '@/api'
import { validatePasswordChange } from '@/utils/security-presenter'

/**
 * 修改登录密码：当前密码 + 新密码 + 确认，成功后提示（会话保持有效）。
 */
defineOptions({ name: 'ChangePasswordDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const submitting = ref(false)
const error = ref('')
let generation = 0

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    form.currentPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    if (!value) return
  },
  { flush: 'sync' },
)

async function submit() {
  if (submitting.value) return
  const code = validatePasswordChange(form)
  if (code) {
    error.value = t(`workspace.security.validation.${code}`)
    return
  }

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    await changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    })
    if (token !== generation) return
    MessagePlugin.success(t('workspace.security.passwordChanged'))
    visible.value = false
    emit('changed')
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : ''
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.security.changePasswordTitle')"
    width="min(520px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert
      v-if="error"
      theme="error"
      :message="error"
      class="change-password__error"
    />

    <t-form
      label-align="top"
      :colon="false"
      :data="form"
    >
      <t-form-item :label="t('workspace.security.currentPassword')">
        <t-input
          v-model="form.currentPassword"
          type="password"
          :placeholder="t('workspace.security.currentPasswordPlaceholder')"
        />
      </t-form-item>

      <t-form-item
        :label="t('workspace.security.newPassword')"
        :help="t('workspace.security.passwordRule')"
      >
        <t-input
          v-model="form.newPassword"
          type="password"
          :placeholder="t('workspace.security.newPasswordPlaceholder')"
        />
      </t-form-item>

      <t-form-item :label="t('workspace.security.confirmPassword')">
        <t-input
          v-model="form.confirmPassword"
          type="password"
          :placeholder="t('workspace.security.confirmPasswordPlaceholder')"
          @enter="submit"
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.change-password {
  &__error {
    margin-bottom: 16px;
  }
}
</style>
