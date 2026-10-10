<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { register as registerApi, resetPassword as resetPasswordApi } from '@/api'
import loginBackground from '@/assets/login-background.jpg'
import defaultIcon from '@/assets/logo/icon.png'
import AppIcon from '@/components/AppIcon.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { APP_TITLE, HOME_PATH } from '@/config'
import { LockPasswordIcon, UserIcon } from '@/icons'
import { useUserStore } from '@/stores'

/** 登录页的三种模式：登录 / 注册 / 找回密码 */
type LoginMode = 'login' | 'register' | 'reset'

/**
 * 登录页：版式对齐参考页（浅蓝背景 + 品牌条 + 居中卡片），
 * 只保留主区（去掉参考页右侧的客户案例栏），卡片内为表单。
 */
defineOptions({ name: 'LoginView' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const mode = ref<LoginMode>('login')
const submitting = ref(false)

const form = reactive({
  account: '',
  password: '',
  confirmPassword: '',
})

const errors = reactive({
  account: '',
  password: '',
  confirmPassword: '',
})

const title = computed(() => t(`login.title.${mode.value}`))
const subtitle = computed(() => t(`login.subtitle.${mode.value}`))
const submitText = computed(() => t(`login.action.${mode.value}`))

/** 找回密码只需账号，注册才需要确认密码 */
const showPasswordField = computed(() => mode.value !== 'reset')
const showConfirmField = computed(() => mode.value === 'register')

const accountPlaceholder = computed(() =>
  mode.value === 'reset' ? t('login.placeholder.resetAccount') : t('login.placeholder.account'),
)

function clearErrors() {
  errors.account = ''
  errors.password = ''
  errors.confirmPassword = ''
}

/** 切换模式并清空敏感输入 */
function switchMode(next: LoginMode) {
  mode.value = next
  form.password = ''
  form.confirmPassword = ''
  clearErrors()
}

function validate() {
  clearErrors()

  if (!form.account.trim()) {
    errors.account = t('login.validate.accountRequired')
  }

  if (showPasswordField.value) {
    if (!form.password) {
      errors.password = t('login.validate.passwordRequired')
    } else if (form.password.length < 6 || form.password.length > 32) {
      errors.password = t('login.validate.passwordLength')
    }
  }

  if (showConfirmField.value) {
    if (!form.confirmPassword) {
      errors.confirmPassword = t('login.validate.confirmRequired')
    } else if (form.confirmPassword !== form.password) {
      errors.confirmPassword = t('login.validate.confirmMismatch')
    }
  }

  return !errors.account && !errors.password && !errors.confirmPassword
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

async function onSubmit() {
  if (submitting.value || !validate()) return

  submitting.value = true
  const account = form.account.trim()

  try {
    if (mode.value === 'login') {
      await userStore.login({ username: account, password: form.password })
      MessagePlugin.success(t('login.message.loginSuccess'))
      await router.replace(resolveRedirect())
      return
    }

    if (mode.value === 'register') {
      await registerApi({ username: account, password: form.password })
      MessagePlugin.success(t('login.message.registerSuccess'))
    } else {
      await resetPasswordApi({ username: account })
      MessagePlugin.success(t('login.message.resetSent'))
    }

    // 注册 / 重置成功后回到登录态，保留刚填的账号
    switchMode('login')
    form.account = account
  } catch {
    // 请求层已统一弹出错误提示，这里只清空密码避免误重试
    form.password = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-page__main">
      <div class="auth-page__bg" aria-hidden="true">
        <img class="auth-page__bg-image" :src="loginBackground" alt="" />
      </div>

      <header class="auth-page__brand">
        <div class="auth-page__brand-left">
          <img class="auth-page__brand-logo" :src="defaultIcon" :alt="APP_TITLE" />
          <span class="auth-page__brand-text">{{ APP_TITLE }}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <div class="auth-page__card-wrap">
        <div class="auth-page__card">
          <h1 class="auth-card__title">{{ title }}</h1>
          <p class="auth-card__subtitle">{{ subtitle }}</p>

          <form class="auth-form" novalidate @submit.prevent="onSubmit">
            <div class="auth-field">
              <label class="auth-field__label" for="account">
                {{ t('login.field.account') }}
              </label>
              <t-input
                id="account"
                v-model="form.account"
                size="large"
                autocomplete="username"
                :status="errors.account ? 'error' : 'default'"
                :placeholder="accountPlaceholder"
                @input="errors.account = ''"
              >
                <template #prefix-icon>
                  <AppIcon :icon="UserIcon" />
                </template>
              </t-input>
              <p v-if="errors.account" class="auth-field__error">{{ errors.account }}</p>
            </div>

            <div v-if="showPasswordField" class="auth-field">
              <label class="auth-field__label" for="password">
                {{ t('login.field.password') }}
              </label>
              <t-input
                id="password"
                v-model="form.password"
                size="large"
                type="password"
                :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
                :status="errors.password ? 'error' : 'default'"
                :placeholder="t('login.placeholder.password')"
                @input="errors.password = ''"
              >
                <template #prefix-icon>
                  <AppIcon :icon="LockPasswordIcon" />
                </template>
              </t-input>
              <p v-if="errors.password" class="auth-field__error">{{ errors.password }}</p>
            </div>

            <div v-if="showConfirmField" class="auth-field">
              <label class="auth-field__label" for="confirm-password">
                {{ t('login.field.confirmPassword') }}
              </label>
              <t-input
                id="confirm-password"
                v-model="form.confirmPassword"
                size="large"
                type="password"
                autocomplete="new-password"
                :status="errors.confirmPassword ? 'error' : 'default'"
                :placeholder="t('login.placeholder.confirmPassword')"
                @input="errors.confirmPassword = ''"
              >
                <template #prefix-icon>
                  <AppIcon :icon="LockPasswordIcon" />
                </template>
              </t-input>
              <p v-if="errors.confirmPassword" class="auth-field__error">
                {{ errors.confirmPassword }}
              </p>
            </div>

            <t-button
              class="auth-submit"
              block
              size="large"
              theme="primary"
              type="submit"
              :loading="submitting"
            >
              {{ submitText }}
            </t-button>
          </form>

          <div class="auth-card__footer">
            <template v-if="mode === 'login'">
              <button type="button" class="auth-link" @click="switchMode('register')">
                {{ t('login.link.toRegister') }}
              </button>
              <button type="button" class="auth-link" @click="switchMode('reset')">
                {{ t('login.link.toReset') }}
              </button>
            </template>

            <template v-else-if="mode === 'register'">
              <button type="button" class="auth-link" @click="switchMode('login')">
                {{ t('login.link.hasAccount') }}
              </button>
            </template>

            <template v-else>
              <button type="button" class="auth-link" @click="switchMode('login')">
                {{ t('login.link.toLogin') }}
              </button>
            </template>
          </div>

          <p class="auth-card__agreement">
            {{ t('login.link.agreement') }}
            <a href="#">{{ t('login.link.terms') }}</a>
            <span class="auth-card__sep">·</span>
            <a href="#">{{ t('login.link.privacy') }}</a>
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

  &__brand-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__brand-logo {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  &__brand-text {
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    color: @beacon-text-primary;
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
    box-shadow:
      0 2px 4px rgb(0 0 0 / 5%),
      0 2px 8px rgb(0 0 0 / 5%);
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

  &__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: @beacon-text-tertiary;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      color: @beacon-text-primary;
    }
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
}
</style>
