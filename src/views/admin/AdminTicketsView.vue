<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { getAdminTicket } from '@/api'
import type { Ticket, TicketDetail, UpdateTicketParams } from '@/api/types/ticket'
import AdminTicketDetailDrawer from '@/components/admin/AdminTicketDetailDrawer.vue'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { useAdminTickets } from '@/composables/useAdminTickets'
import { useTicketCategories } from '@/composables/useTicketCategories'
import { RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  ticketAssigneeLabel,
  ticketAuthorLabel,
  ticketCategoryLabel,
  ticketNumberLabel,
  ticketPriorityLabelKey,
  ticketPriorityRows,
  ticketPriorityTheme,
  ticketStatsRows,
  ticketStatusLabelKey,
  ticketStatusTheme,
} from '@/utils/ticket-presenter'
import { shortId } from '@/utils/team-presenter'

/**
 * 管理后台 · 工单管理（仅 SUPER_ADMIN）。
 * 全平台工单列表 + 状态 / 优先级计数，筛选后进详情抽屉做状态流转、指派、回复与删除。
 */
defineOptions({ name: 'AdminTicketsView' })

const { t } = useI18n()
const userStore = useUserStore()
const {
  tickets,
  total,
  loading,
  error,
  page,
  pageSize,
  filters,
  actingId,
  stats,
  statsLoading,
  statsError,
  load,
  loadStats,
  update,
  reply,
  remove,
  applyFilters,
  reset,
  changePage,
} = useAdminTickets()
const { categories, options: categoryOptions, load: loadCategories } = useTicketCategories()

const statusOptions = computed(() => [
  { label: t('adminPage.ticket.allStatuses'), value: 'all' },
  ...TICKET_STATUSES.map((status) => ({
    label: t(ticketStatusLabelKey(status)),
    value: status,
  })),
])

const priorityOptions = computed(() => [
  { label: t('adminPage.ticket.allPriorities'), value: 'all' },
  ...TICKET_PRIORITIES.map((priority) => ({
    label: t(ticketPriorityLabelKey(priority)),
    value: priority,
  })),
])

const filterCategoryOptions = computed(() => [
  { label: t('adminPage.ticket.allCategories'), value: '' },
  ...categoryOptions.value,
])

const statRows = computed(() => ticketStatsRows(stats.value))
const priorityStatRows = computed(() => ticketPriorityRows(stats.value))

// ---------- 详情抽屉 ----------
const detailVisible = ref(false)
const detail = ref<TicketDetail | null>(null)
const detailLoading = ref(false)
/** 回复成功的时间戳：抽屉据此清空回复草稿 */
const sentAt = ref(0)
let detailRequest = 0

async function loadDetail(ticketId: string) {
  const token = ++detailRequest
  detailLoading.value = true
  try {
    const result = await getAdminTicket(ticketId)
    if (token !== detailRequest) return
    detail.value = result
  } catch {
    if (token !== detailRequest) return
    detail.value = null
  } finally {
    if (token === detailRequest) detailLoading.value = false
  }
}

function openDetail(ticket: Ticket) {
  detail.value = null
  detailVisible.value = true
  void loadDetail(ticket.id)
}

async function handleUpdate(patch: UpdateTicketParams) {
  const current = detail.value
  if (!current) return
  const updated = await update(current.id, patch)
  if (!updated) return
  MessagePlugin.success(t('adminPage.ticket.updated'))
  // 状态流转会在时间线里留下记录，重新拉一次详情
  void loadDetail(updated.id)
}

async function handleReply(payload: { body: string; isInternalNote: boolean }) {
  const current = detail.value
  if (!current) return
  const done = await reply(current.id, payload.body, payload.isInternalNote)
  if (!done) return
  sentAt.value = Date.now()
  MessagePlugin.success(t('adminPage.ticket.replyDone'))
  void loadDetail(current.id)
}

// ---------- 删除确认 ----------
const removeVisible = ref(false)
const removeTarget = ref<Ticket | null>(null)

function askRemove(ticket: Ticket) {
  removeTarget.value = ticket
  removeVisible.value = true
}

async function confirmRemove() {
  const target = removeTarget.value
  removeVisible.value = false
  if (!target) return
  const done = await remove(target.id)
  if (!done) return
  MessagePlugin.success(t('adminPage.ticket.deleted'))
  if (detail.value?.id === target.id) {
    detailVisible.value = false
    detail.value = null
  }
}

function paginate(info: { current: number; pageSize: number }) {
  changePage(info.current, info.pageSize)
}

onMounted(() => {
  if (!userStore.isSuperAdmin) return
  void load()
  void loadStats()
  void loadCategories()
})
</script>

<template>
  <section class="admin-tickets">
    <HeaderActions>
      <t-tooltip :content="t('adminPage.common.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading || statsLoading"
          :disabled="!userStore.isSuperAdmin"
          :aria-label="t('adminPage.common.refresh')"
          @click="
            () => {
              void load()
              void loadStats()
            }
          "
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
    </HeaderActions>

    <t-alert
      v-if="!userStore.isSuperAdmin"
      theme="info"
      :message="t('adminPage.common.noPermission')"
    />

    <template v-else>
      <t-card class="admin-tickets__stats-card">
        <template #title>{{ t('adminPage.ticket.statsTitle') }}</template>
        <template #actions>
          <span class="admin-tickets__total">
            {{ t('adminPage.ticket.total') }} {{ stats.total }}
          </span>
        </template>

        <t-alert v-if="statsError" theme="error" :message="statsError" />

        <div v-else class="admin-tickets__stats">
          <div v-for="row in statRows" :key="row.status" class="admin-tickets__stat">
            <t-tag size="small" variant="light" :theme="ticketStatusTheme(row.status)">
              {{ t(ticketStatusLabelKey(row.status)) }}
            </t-tag>
            <strong class="admin-tickets__count">{{ row.count }}</strong>
          </div>
          <div v-for="row in priorityStatRows" :key="row.priority" class="admin-tickets__stat">
            <t-tag size="small" variant="light" :theme="ticketPriorityTheme(row.priority)">
              {{ t(ticketPriorityLabelKey(row.priority)) }}
            </t-tag>
            <strong class="admin-tickets__count">{{ row.count }}</strong>
          </div>
        </div>
      </t-card>

      <t-card class="admin-tickets__panel">
        <template #title>{{ t('adminPage.ticket.title') }}</template>
        <template #actions>
          <span class="admin-tickets__total"> {{ t('adminPage.ticket.total') }} {{ total }} </span>
        </template>

        <p class="admin-tickets__subtitle">{{ t('adminPage.ticket.subtitle') }}</p>

        <div class="admin-tickets__filters">
          <t-select
            v-model="filters.status"
            :options="statusOptions"
            :aria-label="t('adminPage.common.status')"
            @change="applyFilters"
          />
          <t-select
            v-model="filters.priority"
            :options="priorityOptions"
            :aria-label="t('ticketPage.priority')"
            @change="applyFilters"
          />
          <t-select
            v-model="filters.categoryId"
            :options="filterCategoryOptions"
            :aria-label="t('ticketPage.category')"
            @change="applyFilters"
          />
          <t-input
            v-model="filters.assigneeId"
            :placeholder="t('adminPage.ticket.assigneeFilterPlaceholder')"
            :aria-label="t('ticketPage.assignee')"
            @enter="applyFilters"
          />
          <t-input
            v-model="filters.q"
            :placeholder="t('adminPage.ticket.qPlaceholder')"
            :aria-label="t('adminPage.ticket.q')"
            @enter="applyFilters"
          />
          <t-checkbox v-model="filters.unassigned" @change="applyFilters">
            {{ t('adminPage.ticket.unassignedOnly') }}
          </t-checkbox>
          <div class="admin-tickets__filter-actions">
            <t-button theme="primary" :loading="loading" @click="applyFilters">
              {{ t('adminPage.common.search') }}
            </t-button>
            <t-button variant="outline" @click="reset">
              {{ t('adminPage.common.reset') }}
            </t-button>
          </div>
        </div>

        <div v-if="error" class="admin-tickets__state">
          <t-alert theme="error" :message="error" />
          <t-button variant="outline" @click="load">{{ t('adminPage.common.refresh') }}</t-button>
        </div>

        <div v-else-if="loading && !tickets.length" class="admin-tickets__state">
          <t-loading :text="t('common.loading')" />
        </div>

        <template v-else-if="tickets.length">
          <div class="admin-tickets__table">
            <div class="admin-tickets__table-head">
              <span>{{ t('ticketPage.number') }}</span>
              <span>{{ t('ticketPage.subject') }}</span>
              <span>{{ t('ticketPage.author') }}</span>
              <span>{{ t('adminPage.common.status') }}</span>
              <span>{{ t('ticketPage.priority') }}</span>
              <span>{{ t('ticketPage.category') }}</span>
              <span>{{ t('ticketPage.assignee') }}</span>
              <span>{{ t('ticketPage.updatedAt') }}</span>
              <span>{{ t('adminPage.common.actions') }}</span>
            </div>
            <div v-for="ticket in tickets" :key="ticket.id" class="admin-tickets__row">
              <span class="admin-tickets__number">{{ ticketNumberLabel(ticket.number) }}</span>
              <span class="admin-tickets__subject" :title="ticket.subject">
                {{ ticket.subject }}
              </span>
              <span class="admin-tickets__author" :title="ticket.authorId">
                {{ ticketAuthorLabel(ticket) || shortId(ticket.authorId) }}
              </span>
              <span>
                <t-tag size="small" variant="light" :theme="ticketStatusTheme(ticket.status)">
                  {{ t(ticketStatusLabelKey(ticket.status)) }}
                </t-tag>
              </span>
              <span>
                <t-tag size="small" variant="light" :theme="ticketPriorityTheme(ticket.priority)">
                  {{ t(ticketPriorityLabelKey(ticket.priority)) }}
                </t-tag>
              </span>
              <span class="admin-tickets__muted">{{ ticketCategoryLabel(ticket) || '—' }}</span>
              <span class="admin-tickets__muted">
                {{ ticketAssigneeLabel(ticket) || t('ticketPage.unassigned') }}
              </span>
              <span class="admin-tickets__muted">{{ formatDateTime(ticket.updatedAt) }}</span>
              <span class="admin-tickets__actions">
                <t-button variant="text" size="small" @click="openDetail(ticket)">
                  {{ t('adminPage.ticket.viewDetail') }}
                </t-button>
                <t-button
                  variant="text"
                  size="small"
                  theme="danger"
                  :loading="actingId === ticket.id"
                  @click="askRemove(ticket)"
                >
                  {{ t('adminPage.ticket.delete') }}
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

        <div v-else class="admin-tickets__state">
          <p class="admin-tickets__empty">{{ t('adminPage.ticket.empty') }}</p>
        </div>
      </t-card>
    </template>

    <AdminTicketDetailDrawer
      v-model:visible="detailVisible"
      :detail="detail"
      :categories="categories"
      :loading="detailLoading"
      :busy="Boolean(detail && actingId === detail.id)"
      :sent-at="sentAt"
      @update="handleUpdate"
      @reply="handleReply"
      @remove="detail && askRemove(detail)"
    />

    <t-dialog
      v-model:visible="removeVisible"
      :header="t('adminPage.ticket.delete')"
      width="min(520px, calc(100vw - 32px))"
      :confirm-btn="{ content: t('adminPage.common.confirm'), theme: 'danger' }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="confirmRemove"
    >
      <p class="admin-tickets__confirm">
        {{
          t('adminPage.ticket.deleteConfirm', {
            number: ticketNumberLabel(removeTarget?.number),
          })
        }}
      </p>
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.admin-tickets {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;

  &__panel,
  &__stats-card {
    min-width: 0;
  }

  &__total,
  &__subtitle,
  &__muted {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 16px;
  }

  &__stats {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  &__stat {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 110px;
    padding: 8px 12px;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__count {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__filters {
    display: grid;
    grid-template-columns: 150px 140px 160px minmax(140px, 1fr) minmax(160px, 1fr) auto auto;
    gap: 8px;
    align-items: center;
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
    grid-template-columns:
      90px minmax(220px, 1fr) minmax(140px, 1fr)
      100px 100px 120px 140px 150px 160px;
    gap: 12px;
    align-items: center;
    min-width: 1180px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__number {
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-secondary;
  }

  &__subject,
  &__author {
    overflow: hidden;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__author {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
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

  &__confirm {
    margin: 0;
    color: @beacon-text-primary;
  }

  :deep(.t-pagination) {
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 16px;
  }
}

@media (max-width: 1200px) {
  .admin-tickets__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-tickets__filter-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .admin-tickets__filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
