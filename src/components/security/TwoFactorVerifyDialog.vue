<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { disableTwoFactor, regenerateRecoveryCodes } from '@/api'
import { isSecondFactorCode, normalizeSecondFactor } from '@/utils/security-presenter'

/**
 * 两步验证的敏感操作确认弹窗：
 * - regenerate：重置恢复码，成功后返回新码（由页面弹「仅展示一次」弹窗）
 * - disable：关闭两步验证，后端会吊销所有会话，由页面提示并退出登录
 * 两者都需要当前密码 + 一个一次性验证码（动态码或恢复码）。
 */
defineOptions({ name: 'TwoFactorVerifyDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ mode: 'disable' | 'regenerate' }>()
const emit = defineEmits<{ disabled: []; regenerated: [codes: string[]] }>()
const { t } = useI18n()

const password = ref('')
const code = ref('')
const submitting = ref(false)
const error = ref('')
let generation = 0

const titleKey = computed(() =>
  props.mode === 'disable'
    ? 'workspace.security.disableTitle'
    : 'workspace.security.regenerateTitle',
)
const hintKey = computed(() =>
  props.mode === 'disable'
    ? 'workspace.security.disableHint'
    : 'workspace.security.regenerateHint',
)
const confirmTheme = computed(() => (props.mode === 'disable' ? 'danger' : 'primary'))

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    password.value = ''
    code.value = ''
    if (!value) return
  },
  { flush: 'sync' },
)

async function submit() {
  if (submitting.value) return
  if (!password.value) {
    error.value = t('workspace.security.validation.passwordRequired')
    return
  }
  if (!isSecondFactorCode(code.value)) {
    error.value = t('workspace.security.validation.secondFactorInvalid')
    return
  }

  const payload = {
    currentPassword: password.value,
    code: normalizeSecondFactor(code.value),
  }
  const token = generation
  submitting.value = true
  error.value = ''
  try {
    if (props.mode === 'disable') {
      await disableTwoFactor(payload)
      if (token !== generation) return
      visible.value = false
      emit('disabled')
    } else {
      const result = await regenerateRecoveryCodes(payload)
      if (token !== generation) return
      visible.value = false
      MessagePlugin.success(t('workspace.security.regenerated'))
      emit('regenerated', result.recoveryCodes ?? [])
    }
  } catch (cause) {
    if (token === generation) error.value = cause instanceof Error ? cause.message : ''
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t(titleKey)"
    width="min(520px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), theme: confirmTheme, loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert v-if="error" theme="error" :message="error" class="two-factor-verify__error" />

    <p class="two-factor-verify__hint">{{ t(hintKey) }}</p>

    <t-form label-align="top" :colon="false" :data="{ password, code }">
      <t-form-item :label="t('workspace.security.currentPassword')">
        <t-input
          v-model="password"
          type="password"
          :placeholder="t('workspace.security.currentPasswordPlaceholder')"
        />
      </t-form-item>

      <t-form-item :label="t('workspace.security.secondFactorCode')">
        <t-input
          v-model="code"
          :placeholder="t('workspace.security.secondFactorPlaceholder')"
          @enter="submit"
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.two-factor-verify {
  &__error {
    margin-bottom: 16px;
  }

  &__hint {
    margin: 0 0 16px;
    color: @beacon-text-secondary;
  }
}
</style>
