<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdminOrder } from '@/api/types/admin'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import AdminOrderDetailDrawer from '@/components/admin/AdminOrderDetailDrawer.vue'
import {
  useAdminOrders,
  type AdminOrderAction,
} from '@/composables/useAdminOrders'
import { RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import { formatAmount, formatDateTime } from '@/utils/billing'
import {
  isOrderExpired,
  ORDER_STATUSES,
  orderActions,
  orderStatusTheme,
} from '@/utils/admin-presenter'
import { shortId } from '@/utils/team-presenter'

/** 订单管理：全平台订单列表、筛选、详情与三种运营操作（取消 / 标记已支付 / 标记已退款）。仅 SUPER_ADMIN。 */
defineOptions({ name: 'AdminOrdersView' })

const { t } = useI18n()
const userStore = useUserStore()
const {
  orders,
  total,
  loading,
  error,
  page,
  pageSize,
  filters,
  actingId,
  load,
  applyFilters,
  reset,
  changePage,
  act,
} = useAdminOrders()

const statusOptions = computed(() => [
  { label: t('adminPage.order.allStatuses'), value: 'all' },
  ...ORDER_STATUSES.map((status) => ({
    label: t(`adminPage.order.statusLabel.${status}`),
    value: status,
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

const detailVisible = ref(false)
const selected = ref<AdminOrder | null>(null)

function openDetail(order: AdminOrder) {
  selected.value = order
  detailVisible.value = true
}

// ---------- 运营操作确认 ----------
const pending = ref<{ order: AdminOrder; action: AdminOrderAction } | null>(
  null,
)
const confirmVisible = ref(false)

const confirmMessage = computed(() => {
  const target = pending.value
  if (!target) return ''
  const name = { orderNo: target.order.orderNo }
  if (target.action === 'cancel')
    return t('adminPage.order.cancelConfirm', name)
  if (target.action === 'markPaid')
    return t('adminPage.order.markPaidConfirm', name)
  return t('adminPage.order.refundConfirm', name)
})

const confirmSuccess = {
  cancel: 'adminPage.order.cancelSuccess',
  markPaid: 'adminPage.order.markPaidSuccess',
  refund: 'adminPage.order.refundSuccess',
} as const

function ask(order: AdminOrder, action: AdminOrderAction) {
  pending.value = { order, action }
  confirmVisible.value = true
}

async function confirmAction() {
  const target = pending.value
  if (!target) return
  try {
    const updated = await act(target.order, target.action)
    MessagePlugin.success(t(confirmSuccess[target.action]))
    if (selected.value?.id === updated.id) selected.value = updated
    confirmVisible.value = false
    pending.value = null
  } catch {
    // 请求层已统一提示错误
  }
}

function paginate(info: { current: number; pageSize: number }) {
  changePage(info.current, info.pageSize)
}

onMounted(() => {
  if (userStore.isSuperAdmin) void load()
})
</script>

<template>
  <section class="admin-orders">
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

    <t-alert
      v-if="!userStore.isSuperAdmin"
      theme="info"
      :message="t('adminPage.common.noPermission')"
    />

    <t-card
      v-else
      class="admin-orders__panel"
    >
      <template #title>{{ t('adminPage.order.title') }}</template>
      <template #actions>
        <span class="admin-orders__total">
          {{ t('adminPage.order.total') }} {{ total }}
        </span>
      </template>

      <p class="admin-orders__subtitle">{{ t('adminPage.order.subtitle') }}</p>

      <div class="admin-orders__filters">
        <t-select
          v-model="filters.status"
          class="admin-orders__status"
          :options="statusOptions"
          :aria-label="t('adminPage.common.status')"
          @change="applyFilters"
        />
        <t-input
          v-model="filters.orderNo"
          :placeholder="t('adminPage.order.orderNoPlaceholder')"
          :aria-label="t('adminPage.order.orderNo')"
          @enter="applyFilters"
        />
        <t-input
          v-model="filters.organizationId"
          :placeholder="t('adminPage.order.organizationPlaceholder')"
          :aria-label="t('adminPage.order.organization')"
          @enter="applyFilters"
        />
        <t-input
          v-model="filters.userId"
          :placeholder="t('adminPage.order.userPlaceholder')"
          :aria-label="t('adminPage.order.user')"
          @enter="applyFilters"
        />
        <t-input
          v-model="filters.planId"
          :placeholder="t('adminPage.order.planPlaceholder')"
          :aria-label="t('adminPage.order.plan')"
          @enter="applyFilters"
        />
        <t-date-range-picker
          v-model="range"
          class="admin-orders__range"
          format="YYYY-MM-DD"
          clearable
          :aria-label="t('adminPage.order.range')"
        />
        <div class="admin-orders__filter-actions">
          <t-button
            theme="primary"
            :loading="loading"
            @click="applyFilters"
          >
            {{ t('adminPage.order.search') }}
          </t-button>
          <t-button
            variant="outline"
            @click="reset"
          >
            {{ t('adminPage.common.reset') }}
          </t-button>
        </div>
      </div>

      <div
        v-if="error"
        class="admin-orders__state"
      >
        <t-alert
          theme="error"
          :message="error"
        />
        <t-button
          variant="outline"
          @click="load"
          >{{ t('adminPage.common.refresh') }}</t-button
        >
      </div>

      <div
        v-else-if="loading && !orders.length"
        class="admin-orders__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="orders.length">
        <div class="admin-orders__table">
          <div class="admin-orders__table-head">
            <span>{{ t('adminPage.order.orderNo') }}</span>
            <span>{{ t('adminPage.order.organization') }}</span>
            <span>{{ t('adminPage.order.user') }}</span>
            <span>{{ t('adminPage.order.plan') }}</span>
            <span>{{ t('adminPage.order.amount') }}</span>
            <span>{{ t('adminPage.order.duration') }}</span>
            <span>{{ t('adminPage.common.status') }}</span>
            <span>{{ t('adminPage.order.createdAt') }}</span>
            <span>{{ t('adminPage.common.actions') }}</span>
          </div>
          <div
            v-for="order in orders"
            :key="order.id"
            class="admin-orders__row"
          >
            <span class="admin-orders__no">
              <span class="admin-orders__no-text">{{ order.orderNo }}</span>
              <span
                v-if="order.status === 'PENDING' && isOrderExpired(order)"
                class="admin-orders__expired"
              >
                {{ t('adminPage.order.expired') }}
              </span>
            </span>
            <span class="admin-orders__org">
              <span class="admin-orders__org-name">{{
                order.organization?.name ?? shortId(order.organizationId)
              }}</span>
              <span class="admin-orders__org-id">{{
                shortId(order.organizationId)
              }}</span>
            </span>
            <span class="admin-orders__user">
              <span class="admin-orders__user-name">{{
                order.user?.name ?? shortId(order.userId)
              }}</span>
              <span class="admin-orders__user-id">{{
                order.user?.email ?? shortId(order.userId)
              }}</span>
            </span>
            <span class="admin-orders__plan">{{
              order.plan?.name ?? order.planId
            }}</span>
            <span class="admin-orders__amount">{{
              formatAmount(order.amount)
            }}</span>
            <span>{{
              t('adminPage.order.durationDays', { days: order.durationDays })
            }}</span>
            <span>
              <t-tag
                size="small"
                variant="light"
                :theme="orderStatusTheme(order.status)"
              >
                {{ t(`adminPage.order.statusLabel.${order.status}`) }}
              </t-tag>
            </span>
            <span class="admin-orders__time">{{
              formatDateTime(order.createdAt)
            }}</span>
            <span class="admin-orders__actions">
              <t-button
                variant="text"
                size="small"
                @click="openDetail(order)"
              >
                {{ t('adminPage.order.viewDetail') }}
              </t-button>
              <template v-if="orderActions(order).canMarkPaid">
                <t-button
                  variant="text"
                  size="small"
                  :loading="actingId === order.id"
                  @click="ask(order, 'markPaid')"
                >
                  {{ t('adminPage.order.markPaid') }}
                </t-button>
                <t-button
                  variant="text"
                  size="small"
                  @click="ask(order, 'cancel')"
                >
                  {{ t('adminPage.order.cancel') }}
                </t-button>
              </template>
              <t-button
                v-else-if="orderActions(order).canRefund"
                variant="text"
                size="small"
                :loading="actingId === order.id"
                @click="ask(order, 'refund')"
              >
                {{ t('adminPage.order.refund') }}
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

      <div
        v-else
        class="admin-orders__state"
      >
        <p class="admin-orders__empty">{{ t('adminPage.order.empty') }}</p>
      </div>
    </t-card>

    <AdminOrderDetailDrawer
      v-model:visible="detailVisible"
      :order="selected"
      :busy="Boolean(selected && actingId === selected.id)"
      @act="(action: AdminOrderAction) => selected && ask(selected, action)"
    />

    <t-dialog
      v-model:visible="confirmVisible"
      :header="t('adminPage.order.title')"
      width="min(520px, calc(100vw - 32px))"
      :confirm-btn="{
        content: t('adminPage.common.confirm'),
        loading: Boolean(actingId),
      }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="confirmAction"
    >
      <p class="admin-orders__confirm">{{ confirmMessage }}</p>
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.admin-orders {
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
    grid-template-columns:
      170px minmax(160px, 1fr) minmax(160px, 1fr)
      120px 100px 90px 100px 150px 220px;
    gap: 12px;
    align-items: center;
    min-width: 1240px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__no,
  &__org,
  &__user {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__no-text,
  &__org-name,
  &__user-name {
    overflow: hidden;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__expired,
  &__org-id,
  &__user-id,
  &__time {
    overflow: hidden;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__expired {
    color: @beacon-warning;
  }

  &__plan {
    overflow: hidden;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__amount {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
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
  .admin-orders__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-orders__range,
  .admin-orders__filter-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .admin-orders__filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
