<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AuditLog } from '@/api/types/team'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import AuditLogDetailDrawer from '@/components/team/AuditLogDetailDrawer.vue'
import { useAdminAuditLogs } from '@/composables/useAdminAuditLogs'
import { RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import { AUDIT_ACTIONS, auditActionTheme } from '@/utils/team-presenter'
import { shortId } from '@/utils/team-presenter'

/** 跨租户审计日志：后端分页 + 过滤，条目进详情抽屉（复用团队模块的抽屉）。仅 SUPER_ADMIN。 */
defineOptions({ name: 'AdminAuditLogsView' })

const { t } = useI18n()
const userStore = useUserStore()
const { logs, total, loading, error, page, pageSize, filters, load, applyFilters, reset, changePage } =
  useAdminAuditLogs()

const detailVisible = ref(false)
const selected = ref<AuditLog | null>(null)

const actionOptions = computed(() => [
  { label: t('workspace.auditLog.allActions'), value: 'all' },
  ...AUDIT_ACTIONS.map((action) => ({
    label: t(`workspace.auditLog.actionName.${action}`),
    value: action,
  })),
])

/** 时间范围（本地日期字符串），变更即查询 */
const range = computed<string[]>({
  get: () => filters.range ?? [],
  set: (value) => {
    const [from, to] = Array.isArray(value) ? value : []
    filters.range = from && to ? [from, to] : null
    applyFilters()
  },
})

function actionLabel(action: AuditLog['action']) {
  return t(`workspace.auditLog.actionName.${action}`)
}

function openDetail(log: AuditLog) {
  selected.value = log
  detailVisible.value = true
}

function paginate(info: { current: number; pageSize: number }) {
  changePage(info.current, info.pageSize)
}

onMounted(() => {
  if (userStore.isSuperAdmin) void load()
})
</script>

<template>
  <section class="admin-audit-logs">
    <HeaderActions>
      <t-tooltip :content="t('adminPage.common.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!userStore.isSuperAdmin"
          :aria-label="t('adminPage.common.refresh')"
          @click="load"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
    </HeaderActions>

    <t-alert v-if="!userStore.isSuperAdmin" theme="info" :message="t('adminPage.common.noPermission')" />

    <t-card v-else class="admin-audit-logs__panel">
      <template #title>{{ t('adminPage.auditLog.title') }}</template>
      <p class="admin-audit-logs__subtitle">{{ t('adminPage.auditLog.subtitle') }}</p>

      <div class="admin-audit-logs__filters">
        <t-select
          v-model="filters.action"
          class="admin-audit-logs__action"
          :options="actionOptions"
          :aria-label="t('workspace.auditLog.action')"
          @change="applyFilters"
        />
        <t-input
          v-model="filters.organizationId"
          :placeholder="t('adminPage.auditLog.organizationPlaceholder')"
          :aria-label="t('adminPage.auditLog.organization')"
          @enter="applyFilters"
        />
        <t-input
          v-model="filters.entity"
          :placeholder="t('workspace.auditLog.entityPlaceholder')"
          :aria-label="t('workspace.auditLog.entity')"
          @enter="applyFilters"
        />
        <t-input
          v-model="filters.actorId"
          :placeholder="t('workspace.auditLog.actorPlaceholder')"
          :aria-label="t('workspace.auditLog.actor')"
          @enter="applyFilters"
        />
        <t-input
          v-model="filters.entityId"
          :placeholder="t('workspace.auditLog.entityIdPlaceholder')"
          :aria-label="t('workspace.auditLog.entityId')"
          @enter="applyFilters"
        />
        <t-date-range-picker
          v-model="range"
          class="admin-audit-logs__range"
          format="YYYY-MM-DD"
          clearable
          :aria-label="t('workspace.auditLog.createdAt')"
        />
        <div class="admin-audit-logs__filter-actions">
          <t-button theme="primary" :loading="loading" @click="applyFilters">
            {{ t('adminPage.common.search') }}
          </t-button>
          <t-button variant="outline" @click="reset">
            {{ t('adminPage.common.reset') }}
          </t-button>
        </div>
      </div>

      <div v-if="error" class="admin-audit-logs__state">
        <t-alert theme="error" :message="error" />
        <t-button variant="outline" @click="load">{{ t('adminPage.common.refresh') }}</t-button>
      </div>

      <div v-else-if="loading && !logs.length" class="admin-audit-logs__state">
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="logs.length">
        <div class="admin-audit-logs__table">
          <div class="admin-audit-logs__table-head">
            <span>{{ t('workspace.auditLog.createdAt') }}</span>
            <span>{{ t('workspace.auditLog.action') }}</span>
            <span>{{ t('workspace.auditLog.entity') }}</span>
            <span>{{ t('adminPage.auditLog.organization') }}</span>
            <span>{{ t('workspace.auditLog.actor') }}</span>
            <span>{{ t('adminPage.common.detail') }}</span>
          </div>
          <div v-for="log in logs" :key="log.id" class="admin-audit-logs__row">
            <span class="admin-audit-logs__time">{{ formatDateTime(log.createdAt) }}</span>
            <span>
              <t-tag size="small" variant="light" :theme="auditActionTheme(log.action)">
                {{ actionLabel(log.action) }}
              </t-tag>
            </span>
            <span class="admin-audit-logs__entity">
              <span class="admin-audit-logs__entity-name">{{ log.entity }}</span>
              <span class="admin-audit-logs__entity-id" :title="log.entityId">
                {{ shortId(log.entityId) }}
              </span>
            </span>
            <span class="admin-audit-logs__org" :title="log.organizationId ?? ''">
              {{ log.organizationId ? shortId(log.organizationId) : '—' }}
            </span>
            <span class="admin-audit-logs__actor" :title="log.actorId ?? ''">
              {{ log.actorId ? shortId(log.actorId) : '—' }}
            </span>
            <span class="admin-audit-logs__detail">
              <t-button variant="text" size="small" @click="openDetail(log)">
                {{ t('adminPage.common.detail') }}
              </t-button>
            </span>
          </div>
        </div>

        <t-pagination
          :total="total"
          :current="page"
          :page-size="pageSize"
          :page-size-options="[25, 50, 100]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>

      <div v-else class="admin-audit-logs__state">
        <p class="admin-audit-logs__empty">{{ t('adminPage.auditLog.empty') }}</p>
      </div>
    </t-card>

    <AuditLogDetailDrawer v-model:visible="detailVisible" :log="selected" />
  </section>
</template>

<style scoped lang="less">
.admin-audit-logs {
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__subtitle {
    margin: 0 0 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__filters {
    display: grid;
    grid-template-columns: 160px repeat(4, minmax(140px, 1fr)) 240px auto;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__filter-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  &__table {
    overflow-x: auto;
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns: 150px 120px minmax(180px, 1fr) 140px 140px 96px;
    gap: 16px;
    align-items: center;
    min-width: 900px;
    padding: 12px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__time {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__entity {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__entity-name {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__entity-id,
  &__org,
  &__actor {
    overflow: hidden;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__detail {
    display: flex;
    justify-content: flex-end;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  :deep(.t-pagination) {
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 16px;
  }
}

@media (max-width: 1200px) {
  .admin-audit-logs__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-audit-logs__range,
  .admin-audit-logs__filter-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .admin-audit-logs__filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
