<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import ChangePasswordDialog from '@/components/security/ChangePasswordDialog.vue'
import RecoveryCodesDialog from '@/components/security/RecoveryCodesDialog.vue'
import TwoFactorSetupDialog from '@/components/security/TwoFactorSetupDialog.vue'
import TwoFactorVerifyDialog from '@/components/security/TwoFactorVerifyDialog.vue'
import { useSecurity } from '@/composables/useSecurity'
import { RefreshIcon } from '@/icons'
import { useOrganizationStore, useUserStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import {
  isRecoveryCodesLow,
  recoveryCodesTheme,
} from '@/utils/security-presenter'

/**
 * 安全：修改登录密码 + 两步验证（开启 / 重置恢复码 / 关闭）。
 * 个人访问令牌是独立页面（/access-tokens），这里只做引导。
 * 关闭 2FA 会吊销全部会话，因此成功后清理本地登录态并回到登录页。
 */
defineOptions({ name: 'SecurityView' })

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const orgStore = useOrganizationStore()

const { status, loading, error, load } = useSecurity()

const passwordVisible = ref(false)
const setupVisible = ref(false)
const verifyVisible = ref(false)
const verifyMode = ref<'disable' | 'regenerate'>('regenerate')
const codesVisible = ref(false)
const recoveryCodes = ref<string[]>([])

const enabled = computed(() => status.value?.enabled === true)
const remaining = computed(() => status.value?.recoveryCodesRemaining ?? 0)

// 弹窗关闭后清空一次性恢复码，缩短明文在内存中的可读窗口
watch(codesVisible, (value) => {
  if (!value) recoveryCodes.value = []
})

onMounted(load)
// 页面被 keep-alive 缓存，重新进入时刷新（例如在别处改动后返回）
onActivated(load)
// 停用时关闭全部弹窗，避免明文凭据随被缓存的页面驻留内存
onDeactivated(() => {
  passwordVisible.value = false
  setupVisible.value = false
  verifyVisible.value = false
  codesVisible.value = false
})

const accessTokensPath = '/access-tokens'

function openVerify(mode: 'disable' | 'regenerate') {
  verifyMode.value = mode
  verifyVisible.value = true
}

function onRegenerated(codes: string[]) {
  recoveryCodes.value = codes
  codesVisible.value = true
  void load()
}

async function onDisabled() {
  MessagePlugin.success(t('workspace.security.disabled'))
  await userStore.logout()
  orgStore.reset()
  await router.replace('/login')
}
</script>

<template>
  <div class="security">
    <section class="security__panel">
      <div class="security__head">
        <h3 class="security__title">{{ t('workspace.security.password') }}</h3>
      </div>

      <p class="security__hint">{{ t('workspace.security.passwordHint') }}</p>

      <div>
        <t-button
          variant="outline"
          size="small"
          @click="passwordVisible = true"
        >
          {{ t('workspace.security.passwordAction') }}
        </t-button>
      </div>
    </section>

    <section class="security__panel">
      <div class="security__head">
        <h3 class="security__title">{{ t('workspace.security.twoFactor') }}</h3>
        <t-tag
          v-if="status"
          size="small"
          variant="light"
          :theme="enabled ? 'success' : 'default'"
        >
          {{
            enabled
              ? t('workspace.security.twoFactorEnabledTag')
              : t('workspace.security.twoFactorDisabledTag')
          }}
        </t-tag>
        <t-tooltip :content="t('workspace.security.refresh')">
          <t-button
            variant="text"
            size="small"
            shape="square"
            :loading="loading"
            :aria-label="t('workspace.security.refresh')"
            @click="load"
          >
            <template #icon><AppIcon :icon="RefreshIcon" /></template>
          </t-button>
        </t-tooltip>
      </div>

      <div
        v-if="error"
        class="security__state"
      >
        <t-alert
          theme="error"
          :message="t('workspace.security.loadFailed')"
        />
        <t-button
          variant="outline"
          size="small"
          @click="load"
        >
          {{ t('workspace.security.refresh') }}
        </t-button>
      </div>

      <div
        v-else-if="loading && !status"
        class="security__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else>
        <p class="security__hint">
          {{
            enabled
              ? t('workspace.security.twoFactorEnabledHint')
              : t('workspace.security.twoFactorHint')
          }}
        </p>

        <div
          v-if="enabled"
          class="security__meta"
        >
          <span
            v-if="status?.enabledAt"
            class="security__meta-item"
          >
            {{
              t('workspace.security.enabledAt', {
                time: formatDateTime(status.enabledAt),
              })
            }}
          </span>
          <t-tag
            size="small"
            variant="light"
            :theme="recoveryCodesTheme(remaining)"
          >
            {{
              t('workspace.security.recoveryRemaining', { count: remaining })
            }}
          </t-tag>
          <span
            v-if="isRecoveryCodesLow(remaining)"
            class="security__warn"
          >
            {{ t('workspace.security.recoveryLow') }}
          </span>
        </div>

        <div class="security__actions">
          <t-button
            v-if="!enabled"
            size="small"
            @click="setupVisible = true"
          >
            {{ t('workspace.security.twoFactorAction') }}
          </t-button>
          <template v-else>
            <t-button
              variant="outline"
              size="small"
              @click="openVerify('regenerate')"
            >
              {{ t('workspace.security.regenerateCodes') }}
            </t-button>
            <t-button
              variant="outline"
              size="small"
              theme="danger"
              @click="openVerify('disable')"
            >
              {{ t('workspace.security.disable') }}
            </t-button>
          </template>
        </div>
      </template>
    </section>

    <section class="security__panel">
      <div class="security__head">
        <h3 class="security__title">
          {{ t('workspace.security.accessTokensTitle') }}
        </h3>
      </div>

      <p class="security__hint">
        {{ t('workspace.security.accessTokensHint') }}
      </p>

      <div>
        <t-button
          variant="outline"
          size="small"
          @click="router.push(accessTokensPath)"
        >
          {{ t('workspace.security.gotoAccessTokens') }}
        </t-button>
      </div>
    </section>

    <ChangePasswordDialog v-model:visible="passwordVisible" />
    <TwoFactorSetupDialog
      v-model:visible="setupVisible"
      @enabled="load"
    />
    <TwoFactorVerifyDialog
      v-model:visible="verifyVisible"
      :mode="verifyMode"
      @regenerated="onRegenerated"
      @disabled="onDisabled"
    />
    <RecoveryCodesDialog
      v-model:visible="codesVisible"
      :codes="recoveryCodes"
    />
  </div>
</template>

<style scoped lang="less">
.security {
  display: flex;
  flex-direction: column;
  gap: @beacon-gap-l;

  &__panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__hint {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__state {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: @beacon-text-secondary;
  }

  &__meta-item {
    color: @beacon-text-tertiary;
  }

  &__warn {
    color: var(--td-warning-color, #e37318);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
