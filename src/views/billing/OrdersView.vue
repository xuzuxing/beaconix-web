<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cancelOrder, listOrders } from '@/api'
import type { Order, OrderStatus } from '@/api/types/billing'
import type { Refund } from '@/api/types/refund'
import AlipayQrPayDialog from '@/components/billing/AlipayQrPayDialog.vue'
import RefundProgressDialog from '@/components/billing/RefundProgressDialog.vue'
import RefundRequestDialog from '@/components/billing/RefundRequestDialog.vue'
import { useOrderRefunds } from '@/composables/useOrderRefunds'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { useOrganizationStore } from '@/stores'
import {
  formatAmount,
  formatDateTime,
  planCycleLabelKey,
} from '@/utils/billing'
import { isOrderPayable } from '@/utils/payment'
import { canManageRefunds, refundStatusTheme } from '@/utils/refund'

/** 订单管理：当前团队的购买订单，支持支付、取消、申请退款与查看退款进度 */
defineOptions({ name: 'OrdersView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()
const { role } = useOrganizationRole()

const orgId = computed(() => orgStore.currentOrganizationId)
const orders = ref<Order[]>([])
const loading = ref(false)
const cancellingId = ref('')
/** 正在扫码支付的订单；由支付宝弹窗接管 */
const payTarget = ref<Order | null>(null)
const payVisible = ref(false)
/** 退款申请弹窗的目标订单（试算与提交都在弹窗内完成） */
const refundTarget = ref<Order | null>(null)
const refundVisible = ref(false)
/** 退款进度弹窗的目标订单 */
const progressTarget = ref<Order | null>(null)
const progressVisible = ref(false)

const { loadMany, latest, clear: clearRefunds } = useOrderRefunds()

/** 只有 OWNER / ADMIN 能提交自助退款；后端仍会二次校验 */
const canRefund = computed(() => canManageRefunds(role.value))

const STATUS_THEME: Record<OrderStatus, 'success' | 'warning' | 'default'> = {
  PENDING: 'warning',
  PAID: 'success',
  CANCELLED: 'default',
  REFUNDED: 'default',
}

async function load() {
  const id = orgId.value
  if (!id) {
    orders.value = []
    clearRefunds()
    return
  }

  loading.value = true
  try {
    orders.value = await listOrders(id)
    // 只有已支付/已退款订单可能有退款单；待支付与已取消不必查询
    await loadMany(
      orders.value
        .filter(
          (order) => order.status === 'PAID' || order.status === 'REFUNDED',
        )
        .map((order) => order.id),
    )
  } finally {
    loading.value = false
  }
}

/** 该订单最近一条退款单；没有退款记录时返回 null */
function refundOf(order: Order): Refund | null {
  return latest(order.id)
}

function refundTagTheme(order: Order) {
  const refund = refundOf(order)
  return refund ? refundStatusTheme(refund.status) : 'default'
}

function refundLabel(order: Order): string {
  const refund = refundOf(order)
  return refund ? t(`usage.refund.status.${refund.status}`) : ''
}

function openRefund(order: Order) {
  refundTarget.value = order
  refundVisible.value = true
}

function openProgress(order: Order) {
  progressTarget.value = order
  progressVisible.value = true
}

/** 申请提交后订单或订阅可能已变化，整页重新加载 */
function onRefundChanged() {
  void load()
}

/** 打开支付宝扫码支付；已超时的订单需要重新下单 */
function pay(order: Order) {
  if (!isOrderPayable(order)) {
    MessagePlugin.warning(t('usage.orders.expired'))
    return
  }

  payTarget.value = order
  payVisible.value = true
}

/** 支付成功：弹窗已提示结果，这里只需刷新订单列表 */
function onPaid() {
  payTarget.value = null
  void load()
}

async function cancel(order: Order) {
  cancellingId.value = order.id
  try {
    await cancelOrder(order.id)
    MessagePlugin.success(t('usage.orders.cancelSuccess'))
    await load()
  } catch {
    // 请求层已统一提示错误
  } finally {
    cancellingId.value = ''
  }
}

watch(orgId, load, { immediate: true })
</script>

<template>
  <div class="orders">
    <div class="orders__bar">
      <span class="orders__scope">{{
        orgStore.currentOrganization?.name ?? '—'
      }}</span>
      <t-button
        variant="outline"
        size="small"
        :loading="loading"
        @click="load"
      >
        {{ t('usage.refresh') }}
      </t-button>
    </div>

    <div
      v-loading="loading"
      class="orders__panel"
    >
      <div
        v-if="orders.length"
        class="orders__list"
      >
        <div
          v-for="order in orders"
          :key="order.id"
          class="orders__item"
        >
          <div class="orders__main">
            <span class="orders__no">{{ order.orderNo }}</span>
            <t-tag
              :theme="STATUS_THEME[order.status]"
              variant="light"
              size="small"
            >
              {{ t(`usage.orders.status.${order.status}`) }}
            </t-tag>
          </div>

          <div class="orders__meta">
            <span class="orders__plan">{{
              order.plan?.name ?? order.planId
            }}</span>
            <span class="orders__amount">{{ formatAmount(order.amount) }}</span>
            <span>{{
              t('usage.orders.cycle', {
                cycle: t(planCycleLabelKey(order.cycle)),
                days: order.durationDays,
              })
            }}</span>
          </div>

          <div class="orders__time">
            <span
              >{{ t('usage.orders.createdAt') }}
              {{ formatDateTime(order.createdAt) }}</span
            >
            <span v-if="order.paidAt">
              {{ t('usage.orders.paidAt') }} {{ formatDateTime(order.paidAt) }}
            </span>
            <span v-else-if="order.status === 'PENDING'">
              {{ t('usage.orders.expiresAt') }}
              {{ formatDateTime(order.expiresAt) }}
            </span>
          </div>

          <div class="orders__actions">
            <template v-if="order.status === 'PENDING'">
              <t-button
                theme="primary"
                size="small"
                @click="pay(order)"
              >
                {{ t('usage.orders.pay') }}
              </t-button>
              <t-popconfirm
                :content="t('usage.orders.cancelConfirm')"
                @confirm="cancel(order)"
              >
                <t-button
                  variant="outline"
                  size="small"
                  :loading="cancellingId === order.id"
                >
                  {{ t('usage.orders.cancel') }}
                </t-button>
              </t-popconfirm>
            </template>

            <template v-else-if="order.status === 'PAID'">
              <t-tag
                v-if="refundOf(order)"
                :theme="refundTagTheme(order)"
                variant="light"
                size="small"
              >
                {{ refundLabel(order) }}
              </t-tag>
              <t-button
                v-if="refundOf(order)"
                variant="text"
                size="small"
                @click="openProgress(order)"
              >
                {{ t('usage.refund.progress') }}
              </t-button>
              <t-button
                v-else-if="canRefund"
                variant="outline"
                size="small"
                @click="openRefund(order)"
              >
                {{ t('usage.refund.apply') }}
              </t-button>
            </template>

            <t-button
              v-else-if="refundOf(order)"
              variant="text"
              size="small"
              @click="openProgress(order)"
            >
              {{ t('usage.refund.progress') }}
            </t-button>
          </div>
        </div>
      </div>

      <p
        v-else-if="!loading"
        class="orders__empty"
      >
        {{ t('usage.orders.empty') }}
      </p>
    </div>

    <AlipayQrPayDialog
      v-model:visible="payVisible"
      :order="payTarget"
      @paid="onPaid"
    />

    <RefundRequestDialog
      v-model:visible="refundVisible"
      :order="refundTarget"
      @submitted="onRefundChanged"
    />

    <RefundProgressDialog
      v-model:visible="progressVisible"
      :order="progressTarget"
      @settled="onRefundChanged"
    />
  </div>
</template>

<style scoped lang="less">
.orders {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  &__scope {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__panel {
    min-height: 120px;
    padding: 20px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__list {
    display: flex;
    flex-direction: column;
  }

  &__item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding: 12px 0;
    border-bottom: 1px solid @beacon-border;

    &:last-child {
      border-bottom: 0;
    }
  }

  &__main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 220px;
  }

  &__no {
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }

  &__meta {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    min-width: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__plan {
    color: @beacon-text-primary;
  }

  &__amount {
    color: @beacon-text-primary;
  }

  &__time {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
