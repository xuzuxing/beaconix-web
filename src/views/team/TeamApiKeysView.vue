<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { revokeApiKey } from '@/api'
import type { ApiKey } from '@/api/types/team'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import ApiKeyCreateDialog from '@/components/team/ApiKeyCreateDialog.vue'
import ApiKeySecretDialog from '@/components/team/ApiKeySecretDialog.vue'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { useTeamApiKeys } from '@/composables/useTeamApiKeys'
import { PlusSignIcon, RefreshIcon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import {
  apiKeyDisplay,
  apiKeyScopeLabelKey,
  apiKeyState,
  apiKeyStateTheme,
  canRevokeApiKey,
} from '@/utils/team-presenter'

/**
 * 团队管理 → API 密钥。
 * 密钥列表（掩码）、创建（完整密钥仅展示一次）与作废；创建与作废需要 ADMIN+。
 */
defineOptions({ name: 'TeamApiKeysView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()
const { canManage } = useOrganizationRole()

const orgId = computed(() => orgStore.currentOrganizationId)
const { keys, loading, error, pendingKey, load, act } = useTeamApiKeys(orgId)

const createVisible = ref(false)
const secretVisible = ref(false)
const secret = ref('')

function scopeSummary(key: ApiKey) {
  return key.scopes.map((scope) => t(apiKeyScopeLabelKey(scope))).join(' · ') || '—'
}

function stateLabel(key: ApiKey) {
  return t(`workspace.apiKey.state.${apiKeyState(key)}`)
}

function onCreated(value: string) {
  if (value) {
    secret.value = value
    secretVisible.value = true
  }
  void load()
}

function revoke(key: ApiKey) {
  void act(key.id, async () => {
    try {
      await revokeApiKey(orgId.value, key.id)
      MessagePlugin.success(t('workspace.apiKey.revoked'))
    } catch {
      // 请求层已统一提示
    } finally {
      await load()
    }
  })
}
</script>

<template>
  <section class="api-keys">
    <t-alert theme="info" :message="t('access.keyHint')" />
    <HeaderActions>
      <t-tooltip :content="t('workspace.teamSelect.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!orgId"
          :aria-label="t('workspace.teamSelect.refresh')"
          @click="load"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
      <t-button v-if="canManage" :disabled="!orgId" @click="createVisible = true"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('workspace.apiKey.create') }}</t-button
      >
    </HeaderActions>

    <t-alert v-if="!canManage" theme="info" :message="t('workspace.apiKey.noPermission')" />

    <t-card class="api-keys__panel">
      <template #title>{{ t('workspace.apiKey.title') }}</template>
      <template #actions>
        <span class="api-keys__scope">{{ orgStore.currentOrganization?.name ?? '—' }}</span>
      </template>

      <p class="api-keys__subtitle">{{ t('workspace.apiKey.subtitle') }}</p>

      <div v-if="error" class="api-keys__state">
        <t-alert theme="error" :message="error" />
        <t-button variant="outline" @click="load">{{ t('workspace.teamSelect.refresh') }}</t-button>
      </div>

      <div v-else-if="loading && !keys.length" class="api-keys__state">
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="keys.length">
        <div class="api-keys__table">
          <div class="api-keys__table-head">
            <span>{{ t('workspace.apiKey.name') }}</span>
            <span>{{ t('workspace.apiKey.listKey') }}</span>
            <span>{{ t('workspace.apiKey.status') }}</span>
            <span>{{ t('workspace.apiKey.lastUsed') }}</span>
            <span>{{ t('workspace.apiKey.revoke') }}</span>
          </div>
          <article v-for="key in keys" :key="key.id" class="api-key-row">
            <div class="api-key-row__identity">
              <span class="api-key-row__name">{{ key.name }}</span>
              <p class="api-key-row__scopes" :title="scopeSummary(key)">{{ scopeSummary(key) }}</p>
            </div>

            <code class="api-key-row__value">{{ apiKeyDisplay(key) }}</code>

            <t-tag size="small" variant="light" :theme="apiKeyStateTheme(apiKeyState(key))">
              {{ stateLabel(key) }}
            </t-tag>

            <span class="api-key-row__used">
              {{
                key.lastUsedAt ? formatDateTime(key.lastUsedAt) : t('workspace.apiKey.neverUsed')
              }}
            </span>

            <div class="api-key-row__actions">
              <t-popconfirm
                v-if="canManage && canRevokeApiKey(key)"
                :content="t('workspace.apiKey.revokeConfirm')"
                @confirm="revoke(key)"
              >
                <t-button
                  variant="text"
                  theme="danger"
                  size="small"
                  :loading="pendingKey === key.id"
                >
                  {{ t('workspace.apiKey.revoke') }}
                </t-button>
              </t-popconfirm>
              <span v-else class="api-key-row__locked">—</span>
            </div>
          </article>
        </div>
      </template>

      <div v-else class="api-keys__state">
        <p class="api-keys__empty">{{ t('workspace.apiKey.empty') }}</p>
        <p class="api-keys__empty-hint">{{ t('workspace.apiKey.emptyHint') }}</p>
        <t-button v-if="canManage" @click="createVisible = true">{{
          t('workspace.apiKey.create')
        }}</t-button>
      </div>
    </t-card>

    <ApiKeyCreateDialog v-model:visible="createVisible" :org-id="orgId" @created="onCreated" />
    <ApiKeySecretDialog v-model:visible="secretVisible" :secret="secret" />
  </section>
</template>

<style scoped lang="less">
.api-keys {
  min-width: 0;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .api-key-row {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 180px 90px 150px 90px;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: 12px;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 200px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__empty-hint {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}

.api-key-row {
  &__identity {
    min-width: 0;
  }

  &__name {
    font-weight: 600;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__scopes {
    margin: 6px 0 0;
    overflow: hidden;
    font-size: 12px;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__value {
    overflow-wrap: anywhere;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__used {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
  }

  &__locked {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}

@media (max-width: 1200px) {
  .api-keys__table-head,
  .api-keys .api-key-row {
    grid-template-columns: minmax(160px, 1fr) 150px 90px 90px;
  }
  .api-keys__table-head > :nth-child(4),
  .api-key-row__used {
    display: none;
  }
}

@media (max-width: 600px) {
  .api-keys__table-head {
    display: none;
  }
  .api-keys .api-key-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .api-key-row__actions {
    justify-content: flex-start;
  }
}
</style>
