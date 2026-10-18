<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { CreateTicketParams, Ticket } from '@/api/types/ticket'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import TicketCreateDialog from '@/components/support/TicketCreateDialog.vue'
import { useMyTickets } from '@/composables/useMyTickets'
import { useRefreshOnActivate } from '@/composables/useRefreshOnActivate'
import { useTicketCategories } from '@/composables/useTicketCategories'
import { PlusSignIcon, RefreshIcon } from '@/icons'
import { formatDateTime } from '@/utils/billing'
import {
  TICKET_STATUSES,
  ticketCategoryLabel,
  ticketNumberLabel,
  ticketPriorityLabelKey,
  ticketPriorityTheme,
  ticketStatusLabelKey,
  ticketStatusTheme,
} from '@/utils/ticket-presenter'

/**
 * 我的工单：当前账号提交的工单列表（状态 / 分类筛选 + 分页），
 * 入口在顶栏头像下拉的「我的工单」（不进侧边栏）。
 */
defineOptions({ name: 'MyTicketsView' })

const { t } = useI18n()
const router = useRouter()
const {
  tickets,
  total,
  loading,
  submitting,
  error,
  page,
  pageSize,
  filters,
  load,
  submit,
  applyFilters,
  reset,
  changePage,
} = useMyTickets()
// keep-alive 页面：从别的页面返回时重新拉取工单列表
useRefreshOnActivate(load)
const {
  categories,
  options: categoryOptions,
  loading: categoriesLoading,
  load: loadCategories,
} = useTicketCategories()

void loadCategories()

const createVisible = ref(false)

const statusOptions = computed(() => [
  { label: t('ticketPage.allStatuses'), value: 'all' },
  ...TICKET_STATUSES.map((status) => ({
    label: t(ticketStatusLabelKey(status)),
    value: status,
  })),
])

const filterCategoryOptions = computed(() => [
  { label: t('ticketPage.allCategories'), value: '' },
  ...categoryOptions.value,
])

/** 提交成功：关闭弹窗、提示并停留在列表（composable 已回到第一页刷新） */
async function handleCreate(payload: CreateTicketParams) {
  const created = await submit(payload)
  if (!created) return
  createVisible.value = false
  MessagePlugin.success(t('ticketPage.submitted'))
}

function openTicket(ticket: Ticket) {
  void router.push(`/tickets/${encodeURIComponent(ticket.id)}`)
}

function paginate(info: { current: number; pageSize: number }) {
  changePage(info.current, info.pageSize)
}
</script>

<template>
  <section class="my-tickets">
    <HeaderActions>
      <t-tooltip :content="t('ticketPage.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :aria-label="t('ticketPage.refresh')"
          @click="load"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
      <t-button theme="primary" @click="createVisible = true">
        <template #icon><AppIcon :icon="PlusSignIcon" /></template>
        {{ t('ticketPage.newTicket') }}
      </t-button>
    </HeaderActions>

    <t-card class="my-tickets__panel">
      <template #title>{{ t('ticketPage.listTitle') }}</template>
      <template #actions>
        <span class="my-tickets__total">{{ t('ticketPage.total') }} {{ total }}</span>
      </template>

      <p class="my-tickets__subtitle">{{ t('ticketPage.listSubtitle') }}</p>

      <div class="my-tickets__filters">
        <t-select
          v-model="filters.status"
          class="my-tickets__status"
          :options="statusOptions"
          :aria-label="t('ticketPage.status')"
          @change="applyFilters"
        />
        <t-select
          v-model="filters.categoryId"
          class="my-tickets__category"
          :options="filterCategoryOptions"
          :loading="categoriesLoading"
          :aria-label="t('ticketPage.category')"
          @change="applyFilters"
        />
        <t-button variant="outline" @click="reset">{{ t('ticketPage.filterReset') }}</t-button>
      </div>

      <div v-if="error" class="my-tickets__state">
        <t-alert theme="error" :message="error" />
        <t-button variant="outline" @click="load">{{ t('ticketPage.refresh') }}</t-button>
      </div>

      <div v-else-if="loading && !tickets.length" class="my-tickets__state">
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="tickets.length">
        <div class="my-tickets__table">
          <div class="my-tickets__table-head">
            <span>{{ t('ticketPage.number') }}</span>
            <span>{{ t('ticketPage.subject') }}</span>
            <span>{{ t('ticketPage.category') }}</span>
            <span>{{ t('ticketPage.priority') }}</span>
            <span>{{ t('ticketPage.status') }}</span>
            <span>{{ t('ticketPage.updatedAt') }}</span>
            <span>{{ t('ticketPage.actions') }}</span>
          </div>
          <article v-for="ticket in tickets" :key="ticket.id" class="ticket-row">
            <span class="ticket-row__number">{{ ticketNumberLabel(ticket.number) }}</span>
            <span class="ticket-row__subject">
              <button type="button" class="ticket-row__link" @click="openTicket(ticket)">
                {{ ticket.subject }}
              </button>
            </span>
            <span class="ticket-row__muted">{{ ticketCategoryLabel(ticket) || '—' }}</span>
            <span>
              <t-tag size="small" variant="light" :theme="ticketPriorityTheme(ticket.priority)">
                {{ t(ticketPriorityLabelKey(ticket.priority)) }}
              </t-tag>
            </span>
            <span>
              <t-tag size="small" variant="light" :theme="ticketStatusTheme(ticket.status)">
                {{ t(ticketStatusLabelKey(ticket.status)) }}
              </t-tag>
            </span>
            <span class="ticket-row__muted">{{ formatDateTime(ticket.updatedAt) }}</span>
            <span class="ticket-row__actions">
              <t-button variant="text" size="small" @click="openTicket(ticket)">
                {{ t('ticketPage.view') }}
              </t-button>
            </span>
          </article>
        </div>

        <t-pagination
          :total="total"
          :current="page"
          :page-size="pageSize"
          :page-size-options="[20, 50, 100]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>

      <div v-else class="my-tickets__state">
        <p class="my-tickets__empty">{{ t('ticketPage.empty') }}</p>
        <t-button theme="primary" @click="createVisible = true">
          {{ t('ticketPage.newTicket') }}
        </t-button>
      </div>
    </t-card>

    <TicketCreateDialog
      v-model:visible="createVisible"
      :categories="categories"
      :submitting="submitting"
      @submit="handleCreate"
    />
  </section>
</template>

<style scoped lang="less">
.my-tickets {
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__total,
  &__subtitle {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 16px;
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__status {
    width: 160px;
  }

  &__category {
    width: 200px;
  }

  &__table {
    overflow-x: auto;
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .ticket-row {
    display: grid;
    grid-template-columns: 90px minmax(200px, 1fr) 130px 90px 100px 150px 80px;
    gap: 12px;
    align-items: center;
    min-width: 900px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
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
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 16px;
  }
}

.ticket-row {
  &__number {
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-secondary;
  }

  &__subject {
    min-width: 0;
  }

  &__link {
    max-width: 100%;
    padding: 0;
    overflow: hidden;
    font-family: inherit;
    font-size: @beacon-font-size-menu;
    color: @beacon-text-primary;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      color: @beacon-brand;
    }
  }

  &__muted {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
  }
}

@media (max-width: 600px) {
  .my-tickets__filters {
    flex-direction: column;
    align-items: stretch;
  }

  .my-tickets__status,
  .my-tickets__category {
    width: 100%;
  }
}
</style>
