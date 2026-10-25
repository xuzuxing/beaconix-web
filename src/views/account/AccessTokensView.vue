<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { onActivated, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { revokePersonalAccessToken } from '@/api'
import type { PersonalAccessToken } from '@/api/types/personal-access-token'
import PersonalAccessTokenCreateDialog from '@/components/access-tokens/PersonalAccessTokenCreateDialog.vue'
import PersonalAccessTokenSecretDialog from '@/components/access-tokens/PersonalAccessTokenSecretDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { usePersonalAccessTokens } from '@/composables/usePersonalAccessTokens'
import { PlusSignIcon, RefreshIcon } from '@/icons'
import { formatDateTime } from '@/utils/billing'
import {
  canRevokePat,
  patScopeLabelKey,
  patState,
  patStateTheme,
} from '@/utils/personal-access-token-presenter'

/**
 * 个人访问令牌：列表（掩码元信息）、创建（明文仅展示一次）与吊销。
 * 令牌继承当前用户的权限，用于 CI、脚本或本地工具以个人身份调用 Beaconix 接口。
 */
defineOptions({ name: 'AccessTokensView' })

const { t } = useI18n()
const { tokens, loading, error, pendingId, load, act } =
  usePersonalAccessTokens()

const createVisible = ref(false)
const secretVisible = ref(false)
const secret = ref('')

onMounted(load)
// 页面被 keep-alive 缓存，重新进入时刷新
onActivated(load)

function patScopeSummary(token: PersonalAccessToken) {
  return (
    token.scopes.map((scope) => t(patScopeLabelKey(scope))).join(' · ') || '—'
  )
}

function patStateLabel(token: PersonalAccessToken) {
  return t(`workspace.pat.state.${patState(token)}`)
}

function onCreated(value: string) {
  if (value) {
    secret.value = value
    secretVisible.value = true
  }
  void load()
}

function revoke(token: PersonalAccessToken) {
  void act(token.id, async () => {
    try {
      await revokePersonalAccessToken(token.id)
      MessagePlugin.success(t('workspace.pat.revoked'))
    } catch {
      // 请求层已统一提示
    } finally {
      await load()
    }
  })
}
</script>

<template>
  <section class="access-tokens">
    <HeaderActions>
      <t-tooltip :content="t('workspace.security.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :aria-label="t('workspace.security.refresh')"
          @click="load"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
      <t-button @click="createVisible = true"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('workspace.pat.create') }}</t-button
      >
    </HeaderActions>

    <t-card class="access-tokens__panel">
      <template #title>{{ t('workspace.pat.title') }}</template>

      <p class="access-tokens__subtitle">{{ t('access.patHint') }}</p>

      <div
        v-if="error"
        class="access-tokens__state"
      >
        <t-alert
          theme="error"
          :message="t('workspace.pat.loadFailed')"
        />
        <t-button
          variant="outline"
          @click="load"
          >{{ t('workspace.security.refresh') }}</t-button
        >
      </div>

      <div
        v-else-if="loading && !tokens.length"
        class="access-tokens__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>

      <div
        v-else-if="tokens.length"
        class="access-tokens__table"
      >
        <div class="access-tokens__table-head">
          <span>{{ t('workspace.pat.name') }}</span>
          <span>{{ t('workspace.pat.scopes') }}</span>
          <span>{{ t('workspace.pat.expiresAt') }}</span>
          <span>{{ t('workspace.pat.status') }}</span>
          <span>{{ t('workspace.pat.lastUsed') }}</span>
          <span>{{ t('workspace.pat.revoke') }}</span>
        </div>

        <article
          v-for="token in tokens"
          :key="token.id"
          class="access-token-row"
        >
          <span
            class="access-token-row__name"
            :title="token.name"
            >{{ token.name }}</span
          >

          <p
            class="access-token-row__scopes"
            :title="patScopeSummary(token)"
          >
            {{ patScopeSummary(token) }}
          </p>

          <span class="access-token-row__muted">
            {{ token.expiresAt ? formatDateTime(token.expiresAt) : '—' }}
          </span>

          <span>
            <t-tag
              size="small"
              variant="light"
              :theme="patStateTheme(patState(token))"
            >
              {{ patStateLabel(token) }}
            </t-tag>
          </span>

          <span class="access-token-row__muted">
            {{
              token.lastUsedAt
                ? formatDateTime(token.lastUsedAt)
                : t('workspace.pat.neverUsed')
            }}
          </span>

          <div class="access-token-row__actions">
            <t-popconfirm
              v-if="canRevokePat(token)"
              :content="t('workspace.pat.revokeConfirm')"
              @confirm="revoke(token)"
            >
              <t-button
                variant="text"
                theme="danger"
                size="small"
                :loading="pendingId === token.id"
              >
                {{ t('workspace.pat.revoke') }}
              </t-button>
            </t-popconfirm>
            <span
              v-else
              class="access-token-row__locked"
              >—</span
            >
          </div>
        </article>
      </div>

      <div
        v-else
        class="access-tokens__state"
      >
        <p class="access-tokens__empty">{{ t('workspace.pat.empty') }}</p>
        <p class="access-tokens__empty-hint">
          {{ t('workspace.pat.emptyHint') }}
        </p>
        <t-button @click="createVisible = true">{{
          t('workspace.pat.create')
        }}</t-button>
      </div>
    </t-card>

    <PersonalAccessTokenCreateDialog
      v-model:visible="createVisible"
      @created="onCreated"
    />
    <PersonalAccessTokenSecretDialog
      v-model:visible="secretVisible"
      :secret="secret"
    />
  </section>
</template>

<style scoped lang="less">
.access-tokens {
  min-width: 0;

  &__subtitle {
    margin: 0 0 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__state {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-primary;
  }

  &__empty-hint {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .access-token-row {
    display: grid;
    grid-template-columns:
      minmax(140px, 1fr) minmax(160px, 1.4fr)
      140px 80px 130px 80px;
    gap: 16px;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}

.access-token-row {
  &__name {
    min-width: 0;
    overflow: hidden;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__scopes {
    margin: 0;
    overflow: hidden;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__muted {
    color: @beacon-text-tertiary;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
  }

  &__locked {
    color: @beacon-text-tertiary;
  }
}

@media (max-width: 720px) {
  .access-tokens {
    &__table-head {
      display: none;
    }

    .access-token-row {
      grid-template-columns: 1fr;
      gap: 6px;
    }
  }

  .access-token-row__actions {
    justify-content: flex-start;
  }
}
</style>
