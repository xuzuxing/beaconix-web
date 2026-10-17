<script setup lang="ts">
import AppMaintenanceBanner from '@/components/AppMaintenanceBanner.vue'

import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  forgotPassword as forgotPasswordApi,
  isTwoFactorChallenge,
  register as registerApi,
  resendVerification as resendVerificationApi,
  resetPassword as resetPasswordApi,
  verifyEmail as verifyEmailApi,
  verifyTwoFactorLogin as verifyTwoFactorLoginApi,
} from '@/api'
import loginBackground from '@/assets/login-background.jpg'
import AppIcon from '@/components/AppIcon.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { HOME_PATH } from '@/config'
import { useBrand } from '@/composables/useBrand'
import { LockPasswordIcon, Mail01Icon, SecurityCheckIcon, UserIcon } from '@/icons'
import { useAppStore, useUserStore } from '@/stores'

/**
 * 登录页模式。
 * register / forgot 各自分两步：先提交信息，再输入邮件收到的 6 位验证码。
 * 登录时若账号启用了两步验证，会额外进入 2FA 步骤。
 */
type LoginMode = 'login' | 'register' | 'forgot'

/**
 * 登录页：版式对齐参考页（背景图 + 品牌条 + 居中卡片，无右侧栏）。
 * 流程对齐后端契约：注册需邮箱 OTP 激活；找回密码用 OTP + 新密码；
 * 启用两步验证的账号登录后需再提交 TOTP / 恢复码。
 */
defineOptions({ name: 'LoginView' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

/** 品牌整标与站点名来自平台配置（暗色下回退到内置白色版） */
const { siteName, logoSrc } = useBrand()

const mode = ref<LoginMode>('login')
/** register / forgot 的第二步（输入邮箱验证码） */
const codeStage = ref(false)
/** 登录返回的 2FA 挑战标识；非空即处于两步验证步骤 */
const challengeId = ref('')
const submitting = ref(false)

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
  newPassword: '',
  twoFactorCode: '',
})

const errors = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
  newPassword: '',
  twoFactorCode: '',
})

const twoFactorStage = computed(() => Boolean(challengeId.value))

const title = computed(() =>
  twoFactorStage.value ? t('login.title.twoFactor') : t(`login.title.${mode.value}`),
)

const subtitle = computed(() =>
  twoFactorStage.value ? t('login.subtitle.twoFactor') : t(`login.subtitle.${mode.value}`),
)

const submitText = computed(() => {
  if (twoFactorStage.value) return t('login.action.verifyTwoFactor')
  if (mode.value === 'login') return t('login.action.login')
  if (mode.value === 'register') {
    return codeStage.value ? t('login.action.verify') : t('login.action.register')
  }
  return codeStage.value ? t('login.action.reset') : t('login.action.sendCode')
})

/** 第二步顶部提示：验证码发到了哪个邮箱 */
const stageHint = computed(() => {
  if (twoFactorStage.value || !codeStage.value) return ''
  const key = mode.value === 'register' ? 'login.hint.verifySent' : 'login.hint.resetSent'
  return t(key, { email: form.email.trim() })
})

const showName = computed(
  () => !twoFactorStage.value && mode.value === 'register' && !codeStage.value,
)
const showEmail = computed(() => !twoFactorStage.value && !codeStage.value)
const showPassword = computed(
  () =>
    !twoFactorStage.value &&
    (mode.value === 'login' || (mode.value === 'register' && !codeStage.value)),
)
const showConfirm = computed(
  () => !twoFactorStage.value && mode.value === 'register' && !codeStage.value,
)
const showCode = computed(() => !twoFactorStage.value && codeStage.value)
const showNewPassword = computed(
  () => !twoFactorStage.value && mode.value === 'forgot' && codeStage.value,
)
const showTwoFactorCode = computed(() => twoFactorStage.value)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clearErrors() {
  errors.name = ''
  errors.email = ''
  errors.password = ''
  errors.confirmPassword = ''
  errors.code = ''
  errors.newPassword = ''
  errors.twoFactorCode = ''
}

/** 切换模式（或回到第一步）并清空敏感输入 */
function resetFlow(next: LoginMode) {
  mode.value = next
  codeStage.value = false
  challengeId.value = ''
  form.password = ''
  form.confirmPassword = ''
  form.code = ''
  form.newPassword = ''
  form.twoFactorCode = ''
  clearErrors()
}

function validate() {
  clearErrors()

  if (showName.value && !form.name.trim()) {
    errors.name = t('login.validate.nameRequired')
  }

  if (showEmail.value) {
    if (!form.email.trim()) {
      errors.email = t('login.validate.emailRequired')
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      errors.email = t('login.validate.emailFormat')
    }
  }

  if (showPassword.value) {
    if (!form.password) {
      errors.password = t('login.validate.passwordRequired')
    } else if (form.password.length < 8 || form.password.length > 72) {
      errors.password = t('login.validate.passwordLength')
    }
  }

  if (showConfirm.value) {
    if (!form.confirmPassword) {
      errors.confirmPassword = t('login.validate.confirmRequired')
    } else if (form.confirmPassword !== form.password) {
      errors.confirmPassword = t('login.validate.confirmMismatch')
    }
  }

  if (showCode.value) {
    if (!form.code.trim()) {
      errors.code = t('login.validate.codeRequired')
    } else if (!/^\d{6}$/.test(form.code.trim())) {
      errors.code = t('login.validate.codeFormat')
    }
  }

  if (showNewPassword.value) {
    if (!form.newPassword) {
      errors.newPassword = t('login.validate.passwordRequired')
    } else if (form.newPassword.length < 8 || form.newPassword.length > 72) {
      errors.newPassword = t('login.validate.passwordLength')
    }
  }

  // 恢复码不是纯数字，这里只要求非空
  if (showTwoFactorCode.value && !form.twoFactorCode.trim()) {
    errors.twoFactorCode = t('login.validate.twoFactorCodeRequired')
  }

  return Object.values(errors).every((message) => !message)
}

/** 登录后的落点：优先回跳来源页，否则进首页 */
function resolveRedirect() {
  const redirect = route.query.redirect
  if (
    typeof redirect === 'string' &&
    redirect.startsWith('/') &&
    !redirect.startsWith('//') &&
    redirect !== '/login'
  ) {
    return redirect
  }
  return HOME_PATH
}

/** 第二步：重新发送邮箱验证码 */
async function onResend() {
  if (submitting.value) return
  submitting.value = true
  try {
    if (mode.value === 'register') {
      await resendVerificationApi({ email: form.email.trim() })
    } else {
      await forgotPasswordApi({ email: form.email.trim() })
    }
    MessagePlugin.success(t('login.message.codeResent'))
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false
  }
}

/** 两步验证：提交 TOTP / 恢复码换取令牌 */
async function verifyTwoFactor() {
  const auth = await verifyTwoFactorLoginApi({
    challengeId: challengeId.value,
    code: form.twoFactorCode.trim(),
  })
  userStore.applyAuth(auth)
  MessagePlugin.success(t('login.message.twoFactorSuccess'))
  await router.replace(resolveRedirect())
}

async function onSubmit() {
  if (submitting.value || !validate()) return

  submitting.value = true
  const email = form.email.trim()

  try {
    if (mode.value === 'login') {
      if (twoFactorStage.value) {
        await verifyTwoFactor()
        return
      }

      const result = await userStore.login({ email, password: form.password })
      // 账号启用了两步验证：切到验证码步骤，等待用户输入
      if (isTwoFactorChallenge(result)) {
        challengeId.value = result.challengeId
        form.password = ''
        return
      }

      MessagePlugin.success(t('login.message.loginSuccess'))
      await router.replace(resolveRedirect())
      return
    }

    if (mode.value === 'register') {
      if (!codeStage.value) {
        await registerApi({ email, password: form.password, name: form.name.trim() })
        MessagePlugin.success(t('login.message.registerSuccess'))
        codeStage.value = true
        return
      }
      // 验证成功即返回令牌，直接进入控制台
      const auth = await verifyEmailApi({ email, code: form.code.trim() })
      userStore.applyAuth(auth)
      MessagePlugin.success(t('login.message.verifySuccess'))
      await router.replace(resolveRedirect())
      return
    }

    if (!codeStage.value) {
      await forgotPasswordApi({ email })
      MessagePlugin.success(t('login.message.codeSent'))
      codeStage.value = true
      return
    }

    await resetPasswordApi({ email, code: form.code.trim(), newPassword: form.newPassword })
    MessagePlugin.success(t('login.message.resetSuccess'))
    resetFlow('login')
  } catch {
    // 请求层已统一提示；清掉验证码/密码避免误重试
    form.code = ''
    form.password = ''
    form.newPassword = ''
    form.twoFactorCode = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page" :class="{ 'auth-page--dark': appStore.isDark }">
    <div class="auth-page__main">
      <div class="auth-page__bg" aria-hidden="true">
        <img class="auth-page__bg-image" :src="loginBackground" alt="" />
      </div>

      <AppMaintenanceBanner />

      <header class="auth-page__brand">
        <img class="auth-page__brand-logo" :src="logoSrc" :alt="siteName" />
        <LanguageSwitcher />
      </header>

      <div class="auth-page__card-wrap">
        <div class="auth-page__card">

          <h1 class="auth-card__title">{{ title }}</h1>
          <p class="auth-card__subtitle">{{ subtitle }}</p>

          <p v-if="stageHint" class="auth-card__hint">
            <AppIcon :icon="Mail01Icon" :size="14" />
            {{ stageHint }}
          </p>

          <form class="auth-form" novalidate @submit.prevent="onSubmit">
            <div v-if="showName" class="auth-field">
              <label class="auth-field__label" for="name">{{ t('login.field.name') }}</label>
              <t-input id="name" v-model="form.name" size="large" autocomplete="name"
                :status="errors.name ? 'error' : 'default'" :placeholder="t('login.placeholder.name')"
                @input="errors.name = ''">
                <template #prefix-icon>
                  <AppIcon :icon="UserIcon" />
                </template>
              </t-input>
              <p v-if="errors.name" class="auth-field__error">{{ errors.name }}</p>
            </div>

            <div v-if="showEmail" class="auth-field">
              <label class="auth-field__label" for="email">{{ t('login.field.email') }}</label>
              <t-input id="email" v-model="form.email" size="large" inputmode="email" autocomplete="email"
                :status="errors.email ? 'error' : 'default'" :placeholder="t('login.placeholder.email')"
                @input="errors.email = ''">
                <template #prefix-icon>
                  <AppIcon :icon="Mail01Icon" />
                </template>
              </t-input>
              <p v-if="errors.email" class="auth-field__error">{{ errors.email }}</p>
            </div>

            <div v-if="showPassword" class="auth-field">
              <label class="auth-field__label" for="password">{{
                t('login.field.password')
                }}</label>
              <t-input id="password" v-model="form.password" size="large" type="password"
                :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
                :status="errors.password ? 'error' : 'default'" :placeholder="t('login.placeholder.password')"
                @input="errors.password = ''">
                <template #prefix-icon>
                  <AppIcon :icon="LockPasswordIcon" />
                </template>
              </t-input>
              <p v-if="errors.password" class="auth-field__error">{{ errors.password }}</p>
            </div>

            <div v-if="showConfirm" class="auth-field">
              <label class="auth-field__label" for="confirm-password">
                {{ t('login.field.confirmPassword') }}
              </label>
              <t-input id="confirm-password" v-model="form.confirmPassword" size="large" type="password"
                autocomplete="new-password" :status="errors.confirmPassword ? 'error' : 'default'"
                :placeholder="t('login.placeholder.confirmPassword')" @input="errors.confirmPassword = ''">
                <template #prefix-icon>
                  <AppIcon :icon="LockPasswordIcon" />
                </template>
              </t-input>
              <p v-if="errors.confirmPassword" class="auth-field__error">
                {{ errors.confirmPassword }}
              </p>
            </div>

            <div v-if="showCode" class="auth-field">
              <label class="auth-field__label" for="code">{{ t('login.field.code') }}</label>
              <t-input id="code" v-model="form.code" size="large" inputmode="numeric" maxlength="6"
                :status="errors.code ? 'error' : 'default'" :placeholder="t('login.placeholder.code')"
                @input="errors.code = ''" />
              <p v-if="errors.code" class="auth-field__error">{{ errors.code }}</p>
            </div>

            <!-- 两步验证：输入身份验证器动态码或恢复码 -->
            <div v-if="showTwoFactorCode" class="auth-field">
              <label class="auth-field__label" for="two-factor-code">
                {{ t('login.field.twoFactorCode') }}
              </label>
              <t-input id="two-factor-code" v-model="form.twoFactorCode" size="large" inputmode="numeric"
                autocomplete="one-time-code" maxlength="32" :status="errors.twoFactorCode ? 'error' : 'default'"
                :placeholder="t('login.placeholder.twoFactorCode')" @input="errors.twoFactorCode = ''">
                <template #prefix-icon>
                  <AppIcon :icon="SecurityCheckIcon" />
                </template>
              </t-input>
              <p v-if="errors.twoFactorCode" class="auth-field__error">
                {{ errors.twoFactorCode }}
              </p>
            </div>

            <div v-if="showNewPassword" class="auth-field">
              <label class="auth-field__label" for="new-password">
                {{ t('login.field.newPassword') }}
              </label>
              <t-input id="new-password" v-model="form.newPassword" size="large" type="password"
                autocomplete="new-password" :status="errors.newPassword ? 'error' : 'default'"
                :placeholder="t('login.placeholder.newPassword')" @input="errors.newPassword = ''">
                <template #prefix-icon>
                  <AppIcon :icon="LockPasswordIcon" />
                </template>
              </t-input>
              <p v-if="errors.newPassword" class="auth-field__error">{{ errors.newPassword }}</p>
            </div>

            <t-button class="auth-submit" block size="large" theme="primary" type="submit" :loading="submitting">
              {{ submitText }}
            </t-button>

            <!-- 第二步 / 两步验证：重发验证码（2FA 无重发）与返回登录 -->
            <div v-if="codeStage || twoFactorStage" class="auth-card__footer">
              <button v-if="codeStage" type="button" class="auth-link" :disabled="submitting" @click="onResend">
                {{ t('login.action.resend') }}
              </button>
              <button type="button" class="auth-link" @click="resetFlow('login')">
                {{ t('login.link.toLogin') }}
              </button>
            </div>
          </form>

          <div v-if="!codeStage && !twoFactorStage" class="auth-card__footer">
            <template v-if="mode === 'login'">
              <button type="button" class="auth-link" @click="resetFlow('register')">
                {{ t('login.link.toRegister') }}
              </button>
              <button type="button" class="auth-link" @click="resetFlow('forgot')">
                {{ t('login.link.toForgot') }}
              </button>
            </template>

            <template v-else-if="mode === 'register'">
              <button type="button" class="auth-link" @click="resetFlow('login')">
                {{ t('login.link.hasAccount') }}
              </button>
            </template>

            <template v-else>
              <button type="button" class="auth-link" @click="resetFlow('login')">
                {{ t('login.link.toLogin') }}
              </button>
            </template>
          </div>

          <p class="auth-card__agreement">
            {{ t('login.link.agreement') }}
            <router-link to="/terms">{{ t('login.link.terms') }}</router-link>
            <span class="auth-card__sep">·</span>
            <router-link to="/privacy">{{ t('login.link.privacy') }}</router-link>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.auth-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100%;
  overflow: hidden auto;
  font-family: @beacon-font-family;
  background-color: @beacon-bg-page;

  &__main {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 100%;

    .maintenance-banner {
      position: relative;
    }
  }

  // 参考页的浅蓝背景位图（从保存页面里提取的内嵌图）
  &__bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    background-color: #eaf2fd;
  }

  &__bg-image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: right top;
  }

  &__brand {
    position: relative;
    z-index: 2;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 32px;
  }

  // 整标（含品牌名），按高度缩放，宽度自适应
  &__brand-logo {
    width: auto;
    height: 24px;
    max-width: 100%;
  }

  &__card-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1 0 auto;
    align-items: center;
    justify-content: center;
    padding: 24px 32px 48px;
  }

  &__card {
    width: 100%;
    max-width: 480px;
    padding: 32px;
    background-color: @beacon-bg-container;
    border-radius: 6px;
    box-shadow: var(--td-shadow-1);
  }

  // 暗色：参考页的浅蓝位图不再适用，退回令牌底色，改用描边区分层级
  &--dark {
    .auth-page__bg {
      background-color: @beacon-bg-page;
    }

    .auth-page__bg-image {
      display: none;
    }

    .auth-page__card {
      border: 1px solid @beacon-border;
      box-shadow: none;
    }
  }
}

.auth-card {
  &__title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    line-height: 34px;
    color: @beacon-text-primary;
  }

  &__subtitle {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 22px;
    color: @beacon-text-secondary;
  }

  // 第二步的提示条：验证码已发往哪个邮箱
  &__hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 16px 0 0;
    padding: 8px 12px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
    background-color: @beacon-bg-page;
    border-radius: @beacon-radius-m;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-top: 16px;
  }

  &__agreement {
    margin: 24px 0 0;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-tertiary;

    a {
      color: @beacon-brand;

      &:hover {
        color: @beacon-brand-hover;
      }
    }
  }

  &__sep {
    margin: 0 4px;
  }
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 24px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__label {
    font-size: 14px;
    line-height: 22px;
    color: @beacon-text-primary;
  }

  // 输入框高度对齐参考页的 44px
  :deep(.t-input) {
    height: 44px;
    border-radius: @beacon-radius-m;
  }

  &__error {
    margin: 0;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-error;
  }
}

.auth-submit {
  height: 44px;
  margin-top: 4px;
}

.auth-link {
  padding: 0;
  font-family: inherit;
  font-size: @beacon-font-size-base;
  line-height: 20px;
  color: @beacon-brand;
  cursor: pointer;
  background-color: transparent;
  border: 0;

  &:hover {
    color: @beacon-brand-hover;
  }

  &:disabled {
    color: @beacon-text-disabled;
    cursor: not-allowed;
  }
}
</style>
