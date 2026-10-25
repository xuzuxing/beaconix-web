<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { enableTwoFactor, setupTwoFactor } from '@/api'
import type { TwoFactorSetup } from '@/api/types'
import AppIcon from '@/components/AppIcon.vue'
import { Copy01Icon } from '@/icons'
import {
  extractOtpauthSecret,
  isTotpCode,
  normalizeSecondFactor,
} from '@/utils/security-presenter'

/**
 * 开启两步验证：三步走 —— 校验当前密码 → 扫描二维码并输入动态验证码 → 展示恢复码。
 * 密钥在最后一步成功前不会落库，中途关闭不改变账号状态。
 */
defineOptions({ name: 'TwoFactorSetupDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ enabled: [] }>()
const { t } = useI18n()

type Step = 'password' | 'scan' | 'codes'

const step = ref<Step>('password')
const password = ref('')
const code = ref('')
const setup = ref<TwoFactorSetup | null>(null)
const codes = ref<string[]>([])
const submitting = ref(false)
const error = ref('')
let generation = 0

const steps = computed(() => [
  t('workspace.security.stepPassword'),
  t('workspace.security.stepScan'),
  t('workspace.security.stepCodes'),
])
const activeStep = computed(() =>
  step.value === 'password' ? 0 : step.value === 'scan' ? 1 : 2,
)
const secret = computed(() =>
  setup.value ? extractOtpauthSecret(setup.value.otpauthUrl) : '',
)

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    step.value = 'password'
    password.value = ''
    code.value = ''
    setup.value = null
    codes.value = []
    if (!value) return
  },
  { flush: 'sync' },
)

async function startSetup() {
  if (submitting.value) return
  if (!password.value) {
    error.value = t('workspace.security.validation.passwordRequired')
    return
  }

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    const result = await setupTwoFactor({ currentPassword: password.value })
    if (token !== generation) return
    setup.value = result
    step.value = 'scan'
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : ''
  } finally {
    if (token === generation) submitting.value = false
  }
}

async function confirmEnable() {
  if (submitting.value || !setup.value) return
  if (!isTotpCode(code.value)) {
    error.value = t('workspace.security.validation.totpInvalid')
    return
  }

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    const result = await enableTwoFactor({
      setupToken: setup.value.setupToken,
      code: normalizeSecondFactor(code.value),
    })
    if (token !== generation) return
    codes.value = result.recoveryCodes ?? []
    step.value = 'codes'
    MessagePlugin.success(t('workspace.security.enabled'))
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : ''
  } finally {
    if (token === generation) submitting.value = false
  }
}

async function copySecret() {
  try {
    await navigator.clipboard.writeText(secret.value)
    MessagePlugin.success(t('workspace.security.secretCopied'))
  } catch {
    MessagePlugin.warning(t('workspace.security.copyFailed'))
  }
}

async function copyCodes() {
  try {
    await navigator.clipboard.writeText(codes.value.join('\n'))
    MessagePlugin.success(t('workspace.security.copied'))
  } catch {
    MessagePlugin.warning(t('workspace.security.copyFailed'))
  }
}

function finish() {
  visible.value = false
  emit('enabled')
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.security.setupTitle')"
    width="min(520px, calc(100vw - 32px))"
    :footer="false"
    :close-on-overlay-click="!submitting"
    :close-on-esc-keydown="!submitting"
  >
    <ol class="two-factor-setup__steps">
      <li
        v-for="(label, index) in steps"
        :key="label"
        class="two-factor-setup__step"
        :class="{ 'two-factor-setup__step--active': index <= activeStep }"
      >
        <span class="two-factor-setup__step-index">{{ index + 1 }}</span>
        <span>{{ label }}</span>
      </li>
    </ol>

    <t-alert
      v-if="error"
      theme="error"
      :message="error"
      class="two-factor-setup__error"
    />

    <template v-if="step === 'password'">
      <p class="two-factor-setup__hint">
        {{ t('workspace.security.setupPasswordHint') }}
      </p>
      <t-form
        label-align="top"
        :colon="false"
        :data="{ password }"
      >
        <t-form-item :label="t('workspace.security.currentPassword')">
          <t-input
            v-model="password"
            type="password"
            :placeholder="t('workspace.security.currentPasswordPlaceholder')"
            @enter="startSetup"
          />
        </t-form-item>
      </t-form>
      <div class="two-factor-setup__actions">
        <t-button
          variant="outline"
          :disabled="submitting"
          @click="visible = false"
        >
          {{ t('common.cancel') }}
        </t-button>
        <t-button
          :loading="submitting"
          @click="startSetup"
          >{{ t('common.confirm') }}</t-button
        >
      </div>
    </template>

    <template v-else-if="step === 'scan'">
      <p class="two-factor-setup__hint">
        {{ t('workspace.security.scanHint') }}
      </p>

      <div class="two-factor-setup__qr">
        <img
          v-if="setup"
          :src="setup.qrCodeDataUrl"
          :alt="t('workspace.security.setupTitle')"
          width="180"
          height="180"
        />
      </div>

      <div
        v-if="secret"
        class="two-factor-setup__secret"
      >
        <span class="two-factor-setup__secret-label">{{
          t('workspace.security.manualSecret')
        }}</span>
        <code class="two-factor-setup__secret-value">{{ secret }}</code>
        <t-button
          variant="text"
          size="small"
          @click="copySecret"
        >
          <template #icon><AppIcon :icon="Copy01Icon" /></template>
          {{ t('workspace.security.copySecret') }}
        </t-button>
      </div>

      <t-form
        label-align="top"
        :colon="false"
        :data="{ code }"
      >
        <t-form-item :label="t('workspace.security.enterCode')">
          <t-input
            v-model="code"
            :maxlength="6"
            :placeholder="t('workspace.security.codePlaceholder')"
            @enter="confirmEnable"
          />
        </t-form-item>
      </t-form>

      <div class="two-factor-setup__actions">
        <t-button
          variant="outline"
          :disabled="submitting"
          @click="visible = false"
        >
          {{ t('common.cancel') }}
        </t-button>
        <t-button
          :loading="submitting"
          @click="confirmEnable"
        >
          {{ t('workspace.security.verifyAndEnable') }}
        </t-button>
      </div>
    </template>

    <template v-else>
      <p class="two-factor-setup__hint">
        {{ t('workspace.security.recoveryIntro') }}
      </p>

      <ul class="two-factor-setup__codes">
        <li
          v-for="item in codes"
          :key="item"
        >
          <code>{{ item }}</code>
        </li>
      </ul>

      <t-alert
        theme="warning"
        :message="t('workspace.security.recoveryOnce')"
        class="two-factor-setup__warning"
      />

      <div class="two-factor-setup__actions">
        <t-button
          variant="outline"
          @click="copyCodes"
        >
          <template #icon><AppIcon :icon="Copy01Icon" /></template>
          {{ t('workspace.security.copyAll') }}
        </t-button>
        <t-button @click="finish">{{
          t('workspace.security.savedConfirm')
        }}</t-button>
      </div>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.two-factor-setup {
  &__steps {
    display: flex;
    gap: 16px;
    padding: 0;
    margin: 0 0 16px;
    list-style: none;
  }

  &__step {
    display: flex;
    align-items: center;
    gap: 6px;
    color: @beacon-text-tertiary;

    &--active {
      color: @beacon-text-primary;
    }
  }

  &__step-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    font-size: 12px;
    border: 1px solid currentColor;
    border-radius: 50%;
  }

  &__error,
  &__warning {
    margin: 0 0 16px;
  }

  &__hint {
    margin: 0 0 16px;
    color: @beacon-text-secondary;
  }

  &__qr {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  &__secret {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__secret-label {
    color: @beacon-text-tertiary;
  }

  &__secret-value {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    color: @beacon-text-primary;
  }

  &__codes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
    padding: 12px;
    margin: 0 0 16px;
    list-style: none;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }

  &__codes code {
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    color: @beacon-text-primary;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
