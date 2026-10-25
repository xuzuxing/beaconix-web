<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AuditLog } from '@/api/types/team'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import AuditLogDetailDrawer from '@/components/team/AuditLogDetailDrawer.vue'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { useTeamAuditLogs } from '@/composables/useTeamAuditLogs'
import { RefreshIcon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import {
  AUDIT_ACTIONS,
  auditActionTheme,
  shortId,
} from '@/utils/team-presenter'

/**
 * 团队管理 → 审计日志。
 * 只读列表：按动作 / 实体 / 操作人 / 实体 ID / 时间范围过滤，后端分页，条目进详情抽屉。
 * 接口仅 ADMIN+ 可读，角色不足时只给出提示且不发请求。
 */
defineOptions({ name: 'TeamAuditLogsView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()
const { canManage } = useOrganizationRole()

const orgId = computed(() => orgStore.currentOrganizationId)
const {
  logs,
  total,
  loading,
  error,
  page,
  pageSize,
  filters,
  load,
  applyFilters,
  reset,
  changePage,
} = useTeamAuditLogs(orgId, canManage)

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
</script>

<template>
  <section class="audit-logs">
    <HeaderActions>
      <t-tooltip :content="t('workspace.teamSelect.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!orgId || !canManage"
          :aria-label="t('workspace.teamSelect.refresh')"
          @click="load"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
    </HeaderActions>

    <t-alert
      v-if="!canManage"
      theme="info"
      :message="t('workspace.auditLog.noPermission')"
    />

    <t-card class="audit-logs__panel">
      <template #title>{{ t('workspace.auditLog.title') }}</template>
      <template #actions>
        <span class="audit-logs__scope">{{
          orgStore.currentOrganization?.name ?? '—'
        }}</span>
      </template>

      <p class="audit-logs__subtitle">{{ t('workspace.auditLog.subtitle') }}</p>

      <template v-if="canManage">
        <div class="audit-logs__filters">
          <t-select
            v-model="filters.action"
            class="audit-logs__action"
            :options="actionOptions"
            :aria-label="t('workspace.auditLog.action')"
            @change="applyFilters"
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
            class="audit-logs__range"
            format="YYYY-MM-DD"
            clearable
            :aria-label="t('workspace.auditLog.createdAt')"
          />
          <div class="audit-logs__filter-actions">
            <t-button
              theme="primary"
              :loading="loading"
              @click="applyFilters"
            >
              {{ t('workspace.auditLog.search') }}
            </t-button>
            <t-button
              variant="outline"
              @click="reset"
            >
              {{ t('workspace.auditLog.reset') }}
            </t-button>
          </div>
        </div>

        <div
          v-if="error"
          class="audit-logs__state"
        >
          <t-alert
            theme="error"
            :message="error"
          />
          <t-button
            variant="outline"
            @click="load"
            >{{ t('workspace.auditLog.search') }}</t-button
          >
        </div>

        <div
          v-else-if="loading && !logs.length"
          class="audit-logs__state"
        >
          <t-loading :text="t('common.loading')" />
        </div>

        <template v-else-if="logs.length">
          <div class="audit-logs__table">
            <div class="audit-logs__table-head">
              <span>{{ t('workspace.auditLog.createdAt') }}</span>
              <span>{{ t('workspace.auditLog.action') }}</span>
              <span>{{ t('workspace.auditLog.entity') }}</span>
              <span>{{ t('workspace.auditLog.actor') }}</span>
              <span>{{ t('workspace.auditLog.detail') }}</span>
            </div>
            <article
              v-for="log in logs"
              :key="log.id"
              class="audit-row"
            >
              <span class="audit-row__time">{{
                formatDateTime(log.createdAt)
              }}</span>
              <span class="audit-row__action">
                <t-tag
                  size="small"
                  variant="light"
                  :theme="auditActionTheme(log.action)"
                >
                  {{ actionLabel(log.action) }}
                </t-tag>
              </span>
              <span class="audit-row__entity">
                <span class="audit-row__entity-name">{{ log.entity }}</span>
                <span
                  class="audit-row__entity-id"
                  :title="log.entityId"
                >
                  {{ shortId(log.entityId) }}
                </span>
              </span>
              <span
                class="audit-row__actor"
                :title="log.actorId ?? ''"
              >
                {{ log.actorId ? shortId(log.actorId) : '—' }}
              </span>
              <span class="audit-row__detail">
                <t-button
                  variant="text"
                  size="small"
                  @click="openDetail(log)"
                >
                  {{ t('workspace.auditLog.detail') }}
                </t-button>
              </span>
            </article>
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

        <div
          v-else
          class="audit-logs__state"
        >
          <p class="audit-logs__empty">{{ t('workspace.auditLog.empty') }}</p>
        </div>
      </template>

      <div
        v-else
        class="audit-logs__state"
      >
        <p class="audit-logs__empty">
          {{ t('workspace.auditLog.noPermission') }}
        </p>
      </div>
    </t-card>

    <AuditLogDetailDrawer
      v-model:visible="detailVisible"
      :log="selected"
    />
  </section>
</template>

<style scoped lang="less">
.audit-logs {
  min-width: 0;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__filters {
    display: grid;
    grid-template-columns:
      160px minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr)
      240px auto;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__filter-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .audit-row {
    display: grid;
    grid-template-columns: 150px 120px minmax(180px, 1fr) 140px 96px;
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
    gap: 16px;
    min-height: 200px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

.audit-row {
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
    font-weight: 600;
    color: @beacon-text-primary;
  }

  &__entity-id,
  &__actor {
    overflow: hidden;
    font-size: 12px;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__detail {
    display: flex;
    justify-content: flex-end;
  }
}

@media (max-width: 1200px) {
  .audit-logs__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .audit-logs__range,
  .audit-logs__filter-actions {
    grid-column: 1 / -1;
  }

  .audit-logs__table-head,
  .audit-logs .audit-row {
    grid-template-columns: 140px 110px minmax(140px, 1fr) 96px;
  }

  .audit-logs__table-head > :nth-child(4),
  .audit-row__actor {
    display: none;
  }
}

@media (max-width: 600px) {
  .audit-logs__filters {
    grid-template-columns: minmax(0, 1fr);
  }

  .audit-logs__table-head {
    display: none;
  }

  .audit-logs .audit-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .audit-row__detail {
    justify-content: flex-start;
  }
}
</style>
