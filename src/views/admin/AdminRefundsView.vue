<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import type { PaymentChannel } from '@/api/types/billing'
import type { AdminRefund, RefundStatus } from '@/api/types/refund'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import AdminRefundCreateDialog from '@/components/admin/AdminRefundCreateDialog.vue'
import {
  useAdminRefunds,
  type AdminRefundAction,
} from '@/composables/useAdminRefunds'
import { RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import { formatAmount, formatDateTime } from '@/utils/billing'
import {
  adminRefundActions,
  REFUND_STATUSES,
  refundStatusTheme,
} from '@/utils/refund'
import { shortId } from '@/utils/team-presenter'

/** 退款管理：跨租户退款单的筛选、审批 / 重试 / 关闭、对账统计与后台发起退款。仅 SUPER_ADMIN。 */
defineOptions({ name: 'AdminRefundsView' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const {
  refunds,
  total,
  loading,
  error,
  page,
  pageSize,
  filters,
  actingId,
  stats,
  statsLoading,
  refreshAll,
  applyFilters,
  reset,
  changePage,
  act,
} = useAdminRefunds()

const CHANNELS: PaymentChannel[] = ['WECHAT', 'WECHAT_VIRTUAL', 'ALIPAY']

const statusOptions = computed(() => [
  { label: t('adminPage.refund.allStatuses'), value: 'all' },
  ...REFUND_STATUSES.map((status) => ({
    label: t(`adminPage.refund.status.${status}`),
    value: status,
  })),
])

const channelOptions = computed(() => [
  { label: t('adminPage.refund.allChannels'), value: 'all' },
  ...CHANNELS.map((channel) => ({
    label: t(`adminPage.refund.channel.${channel}`),
    value: channel,
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

function refundStatusLabel(status: RefundStatus): string {
  return t(`adminPage.refund.status.${status}`)
}

function channelLabel(channel: PaymentChannel): string {
  return t(`adminPage.refund.channel.${channel}`)
}

// ---------- 运营操作确认 ----------
const pending = ref<{ refund: AdminRefund; action: AdminRefundAction } | null>(
  null,
)
const confirmVisible = ref(false)
const closeReason = ref('')

const confirmTitle = computed(() => {
  const target = pending.value
  if (!target) return ''
  if (target.action === 'approve') return t('adminPage.refund.approve')
  if (target.action === 'retry') return t('adminPage.refund.retry')
  return t('adminPage.refund.close')
})

const confirmMessage = computed(() => {
  const target = pending.value
  if (!target) return ''
  const name = { refundNo: target.refund.refundNo }
  if (target.action === 'approve')
    return t('adminPage.refund.approveConfirm', name)
  if (target.action === 'retry') return t('adminPage.refund.retryConfirm', name)
  return t('adminPage.refund.closeConfirm', name)
})

const confirmSuccess = {
  approve: 'adminPage.refund.approveSuccess',
  retry: 'adminPage.refund.retrySuccess',
  close: 'adminPage.refund.closeSuccess',
} as const

function ask(refund: AdminRefund, action: AdminRefundAction) {
  pending.value = { refund, action }
  closeReason.value = ''
  confirmVisible.value = true
}

async function confirmAction() {
  const target = pending.value
  if (!target) return
  try {
    await act(
      target.refund,
      target.action,
      target.action === 'close' ? closeReason.value : undefined,
    )
    MessagePlugin.success(t(confirmSuccess[target.action]))
    confirmVisible.value = false
    pending.value = null
  } catch {
    // 请求层已统一提示错误
  }
}

// ---------- 后台发起退款 ----------
const createVisible = ref(false)
const createOrderId = ref('')

function openCreate(orderId = '') {
  createOrderId.value = orderId
  createVisible.value = true
}

function onCreated() {
  void refreshAll()
}

function paginate(info: { current: number; pageSize: number }) {
  changePage(info.current, info.pageSize)
}

onMounted(() => {
  if (!userStore.isSuperAdmin) return
  void refreshAll()
  // 从订单管理跳转过来时直接打开「发起退款」并预填订单
  const orderId =
    typeof route.query.orderId === 'string' ? route.query.orderId : ''
  if (orderId) openCreate(orderId)
})
</script>

<template>
  <section class="admin-refunds">
    <HeaderActions>
      <t-tooltip :content="t('adminPage.common.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!userStore.isSuperAdmin"
          :aria-label="t('adminPage.common.refresh')"
          @click="refreshAll"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
      <t-button
        theme="primary"
        :disabled="!userStore.isSuperAdmin"
        @click="openCreate()"
      >
        {{ t('adminPage.refund.create') }}
      </t-button>
      <t-button
        variant="outline"
        :disabled="!userStore.isSuperAdmin"
        @click="router.push('/admin/orders')"
      >
        {{ t('adminPage.refund.viewOrder') }}
      </t-button>
    </HeaderActions>

    <t-alert
      v-if="!userStore.isSuperAdmin"
      theme="info"
      :message="t('adminPage.common.noPermission')"
    />

    <template v-else>
      <t-card
        class="admin-refunds__panel"
        :bordered="false"
      >
        <template #title>{{ t('adminPage.refund.statsTitle') }}</template>
        <template #actions>
          <t-loading
            v-if="statsLoading"
            size="14px"
          />
        </template>

        <p
          v-if="!stats"
          class="admin-refunds__empty"
        >
          {{ t('adminPage.refund.statsEmpty') }}
        </p>

        <template v-else>
          <div class="admin-refunds__kpi">
            <div class="admin-refunds__kpi-item">
              <span class="admin-refunds__kpi-label">{{
                t('adminPage.refund.total')
              }}</span>
              <strong class="admin-refunds__kpi-value">{{
                stats.total.count
              }}</strong>
            </div>
            <div class="admin-refunds__kpi-item">
              <span class="admin-refunds__kpi-label">{{
                t('adminPage.refund.statsAmount')
              }}</span>
              <strong class="admin-refunds__kpi-value">{{
                formatAmount(stats.total.amount)
              }}</strong>
            </div>
            <div class="admin-refunds__kpi-item">
              <span class="admin-refunds__kpi-label">{{
                t('adminPage.refund.statsSettled')
              }}</span>
              <strong class="admin-refunds__kpi-value">{{
                formatAmount(stats.total.settledAmount)
              }}</strong>
            </div>
          </div>

          <div class="admin-refunds__groups">
            <div class="admin-refunds__group">
              <span class="admin-refunds__group-title">{{
                t('adminPage.refund.statsByStatus')
              }}</span>
              <div class="admin-refunds__tags">
                <t-tag
                  v-for="bucket in stats.byStatus"
                  :key="bucket.status"
                  size="small"
                  variant="light"
                  :theme="refundStatusTheme(bucket.status)"
                >
                  {{ refundStatusLabel(bucket.status) }}
                  {{
                    t('adminPage.refund.statsCount', { count: bucket.count })
                  }}
                  {{ formatAmount(bucket.amount) }}
                </t-tag>
                <span
                  v-if="!stats.byStatus.length"
                  class="admin-refunds__empty"
                  >{{ t('adminPage.common.empty') }}</span
                >
              </div>
            </div>

            <div class="admin-refunds__group">
              <span class="admin-refunds__group-title">{{
                t('adminPage.refund.statsByChannel')
              }}</span>
              <div class="admin-refunds__tags">
                <t-tag
                  v-for="bucket in stats.byChannel"
                  :key="bucket.channel"
                  size="small"
                  variant="outline"
                >
                  {{ channelLabel(bucket.channel) }}
                  {{
                    t('adminPage.refund.statsCount', { count: bucket.count })
                  }}
                  {{ formatAmount(bucket.amount) }}
                </t-tag>
                <span
                  v-if="!stats.byChannel.length"
                  class="admin-refunds__empty"
                  >{{ t('adminPage.common.empty') }}</span
                >
              </div>
            </div>

            <div class="admin-refunds__group">
              <span class="admin-refunds__group-title">{{
                t('adminPage.refund.statsByPolicy')
              }}</span>
              <div class="admin-refunds__tags">
                <t-tag
                  v-for="bucket in stats.byPolicy"
                  :key="bucket.policyCode"
                  size="small"
                  variant="outline"
                >
                  {{ t(`adminPage.refund.policyCode.${bucket.policyCode}`) }}
                  {{
                    t('adminPage.refund.statsCount', { count: bucket.count })
                  }}
                  {{ formatAmount(bucket.amount) }}
                </t-tag>
                <span
                  v-if="!stats.byPolicy.length"
                  class="admin-refunds__empty"
                  >{{ t('adminPage.common.empty') }}</span
                >
              </div>
            </div>
          </div>

          <div
            v-if="stats.failures.length"
            class="admin-refunds__failures"
          >
            <span class="admin-refunds__group-title">{{
              t('adminPage.refund.statsFailures')
            }}</span>
            <ul>
              <li
                v-for="failure in stats.failures.slice(0, 5)"
                :key="failure.reason"
              >
                <span class="admin-refunds__failure-reason">{{
                  failure.reason
                }}</span>
                <span class="admin-refunds__failure-count"
                  >×{{ failure.count }}</span
                >
              </li>
            </ul>
          </div>
        </template>
      </t-card>

      <t-card class="admin-refunds__panel">
        <template #title>{{ t('adminPage.refund.title') }}</template>
        <template #actions>
          <span class="admin-refunds__total">
            {{ t('adminPage.refund.total') }} {{ total }}
          </span>
        </template>

        <p class="admin-refunds__subtitle">
          {{ t('adminPage.refund.subtitle') }}
        </p>

        <div class="admin-refunds__filters">
          <t-select
            v-model="filters.status"
            :options="statusOptions"
            :aria-label="t('adminPage.common.status')"
            @change="applyFilters"
          />
          <t-select
            v-model="filters.channel"
            :options="channelOptions"
            :aria-label="t('adminPage.refund.channelLabel')"
            @change="applyFilters"
          />
          <t-input
            v-model="filters.refundNo"
            :placeholder="t('adminPage.refund.refundNoPlaceholder')"
            :aria-label="t('adminPage.refund.refundNo')"
            @enter="applyFilters"
          />
          <t-input
            v-model="filters.orderId"
            :placeholder="t('adminPage.refund.orderIdPlaceholder')"
            :aria-label="t('adminPage.refund.orderId')"
            @enter="applyFilters"
          />
          <t-input
            v-model="filters.organizationId"
            :placeholder="t('adminPage.refund.organizationPlaceholder')"
            :aria-label="t('adminPage.refund.organization')"
            @enter="applyFilters"
          />
          <t-date-range-picker
            v-model="range"
            class="admin-refunds__range"
            format="YYYY-MM-DD"
            clearable
            :aria-label="t('adminPage.refund.range')"
          />
          <div class="admin-refunds__filter-actions">
            <t-button
              theme="primary"
              :loading="loading"
              @click="applyFilters"
            >
              {{ t('adminPage.refund.search') }}
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
          class="admin-refunds__state"
        >
          <t-alert
            theme="error"
            :message="error"
          />
          <t-button
            variant="outline"
            @click="refreshAll"
            >{{ t('adminPage.common.refresh') }}</t-button
          >
        </div>

        <div
          v-else-if="loading && !refunds.length"
          class="admin-refunds__state"
        >
          <t-loading :text="t('common.loading')" />
        </div>

        <template v-else-if="refunds.length">
          <div class="admin-refunds__table">
            <div class="admin-refunds__table-head">
              <span>{{ t('adminPage.refund.refundNo') }}</span>
              <span>{{ t('adminPage.refund.orderNo') }}</span>
              <span>{{ t('adminPage.refund.organization') }}</span>
              <span>{{ t('adminPage.refund.channelLabel') }}</span>
              <span>{{ t('adminPage.refund.typeLabel') }}</span>
              <span>{{ t('adminPage.common.status') }}</span>
              <span>{{ t('adminPage.refund.amount') }}</span>
              <span>{{ t('adminPage.refund.settledAmount') }}</span>
              <span>{{ t('adminPage.refund.policy') }}</span>
              <span>{{ t('adminPage.refund.daysTitle') }}</span>
              <span>{{ t('adminPage.refund.createdAt') }}</span>
              <span>{{ t('adminPage.common.actions') }}</span>
            </div>
            <div
              v-for="refund in refunds"
              :key="refund.id"
              class="admin-refunds__row"
            >
              <span class="admin-refunds__strong">{{ refund.refundNo }}</span>
              <span class="admin-refunds__muted">{{ refund.orderNo }}</span>
              <span class="admin-refunds__org">
                <span class="admin-refunds__strong">{{
                  shortId(refund.organizationId)
                }}</span>
                <span class="admin-refunds__muted">{{
                  shortId(refund.orderId)
                }}</span>
              </span>
              <span>{{ channelLabel(refund.channel) }}</span>
              <span>{{ t(`adminPage.refund.type.${refund.type}`) }}</span>
              <span>
                <t-tag
                  size="small"
                  variant="light"
                  :theme="refundStatusTheme(refund.status)"
                >
                  {{ refundStatusLabel(refund.status) }}
                </t-tag>
              </span>
              <span class="admin-refunds__strong">{{
                formatAmount(refund.amount)
              }}</span>
              <span>{{
                refund.settledAmount === null
                  ? '—'
                  : formatAmount(refund.settledAmount)
              }}</span>
              <span class="admin-refunds__muted">{{
                t(`adminPage.refund.policyCode.${refund.policyCode}`)
              }}</span>
              <span class="admin-refunds__muted">
                {{
                  t('adminPage.refund.daysPair', {
                    used: refund.usedDays,
                    remaining: refund.remainingDays,
                  })
                }}
              </span>
              <span class="admin-refunds__muted">{{
                formatDateTime(refund.createdAt)
              }}</span>
              <span class="admin-refunds__actions">
                <t-button
                  v-if="adminRefundActions(refund).canApprove"
                  variant="text"
                  size="small"
                  :loading="actingId === refund.id"
                  @click="ask(refund, 'approve')"
                >
                  {{ t('adminPage.refund.approve') }}
                </t-button>
                <t-button
                  v-if="adminRefundActions(refund).canRetry"
                  variant="text"
                  size="small"
                  :loading="actingId === refund.id"
                  @click="ask(refund, 'retry')"
                >
                  {{ t('adminPage.refund.retry') }}
                </t-button>
                <t-button
                  v-if="adminRefundActions(refund).canClose"
                  variant="text"
                  size="small"
                  @click="ask(refund, 'close')"
                >
                  {{ t('adminPage.refund.close') }}
                </t-button>
                <t-tooltip
                  v-if="refund.failureReason"
                  :content="refund.failureReason"
                >
                  <t-tag
                    size="small"
                    variant="outline"
                    theme="danger"
                  >
                    {{ t('adminPage.refund.failureReason') }}
                  </t-tag>
                </t-tooltip>
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
          class="admin-refunds__state"
        >
          <p class="admin-refunds__empty">{{ t('adminPage.refund.empty') }}</p>
        </div>
      </t-card>
    </template>

    <t-dialog
      v-model:visible="confirmVisible"
      :header="confirmTitle"
      width="min(520px, calc(100vw - 32px))"
      :confirm-btn="{
        content: t('adminPage.common.confirm'),
        loading: Boolean(actingId),
      }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="confirmAction"
    >
      <p class="admin-refunds__confirm">{{ confirmMessage }}</p>
      <t-textarea
        v-if="pending?.action === 'close'"
        v-model="closeReason"
        :maxlength="200"
        :placeholder="t('adminPage.refund.closeReasonPlaceholder')"
        :autosize="{ minRows: 2, maxRows: 4 }"
      />
    </t-dialog>

    <AdminRefundCreateDialog
      v-model:visible="createVisible"
      :order-id="createOrderId"
      @created="onCreated"
    />
  </section>
</template>

<style scoped lang="less">
.admin-refunds {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

  &__kpi {
    display: flex;
    flex-wrap: wrap;
    gap: 32px;
    padding-bottom: 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__kpi-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__kpi-label {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
  }

  &__kpi-value {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    padding-top: 12px;
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  &__group-title {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__failures {
    padding-top: 12px;

    ul {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: @beacon-font-size-base;
      color: @beacon-text-secondary;
    }
  }

  &__failure-reason {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__failure-count {
    flex: none;
    color: @beacon-error;
  }

  &__filters {
    display: grid;
    grid-template-columns: 150px 150px repeat(3, minmax(140px, 1fr)) 240px auto;
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
      150px 150px minmax(140px, 1fr) 110px 100px 110px
      100px 100px 140px 120px 140px 200px;
    gap: 12px;
    align-items: center;
    min-width: 1560px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__org {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__strong {
    overflow: hidden;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__muted {
    overflow: hidden;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    min-height: 160px;
  }

  &__empty {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__confirm {
    margin: 0 0 12px;
    color: @beacon-text-primary;
  }

  :deep(.t-pagination) {
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 16px;
  }
}

@media (max-width: 1200px) {
  .admin-refunds__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-refunds__range,
  .admin-refunds__filter-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .admin-refunds__filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
