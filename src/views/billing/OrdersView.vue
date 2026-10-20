<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cancelOrder, listOrders } from '@/api'
import type { Order, OrderStatus } from '@/api/types/billing'
import { useOrganizationStore } from '@/stores'
import {
  formatAmount,
  formatDateTime,
  planCycleLabelKey,
} from '@/utils/billing'
import {
  getWechatOpenid,
  isWechatBrowser,
  payOrder,
  waitForOrderPaid,
} from '@/utils/wechat-pay'

/** 订单管理：当前团队的购买订单，支持对待支付订单发起微信支付或取消 */
defineOptions({ name: 'OrdersView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()

const orgId = computed(() => orgStore.currentOrganizationId)
const orders = ref<Order[]>([])
const loading = ref(false)
const payingId = ref('')
const cancellingId = ref('')

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
    return
  }

  loading.value = true
  try {
    orders.value = await listOrders(id)
  } finally {
    loading.value = false
  }
}

/** 发起微信支付：非微信环境或缺少 openid 时提示到微信内打开 */
async function pay(order: Order) {
  const openid = getWechatOpenid()
  if (!isWechatBrowser() || !openid) {
    MessagePlugin.warning(t('usage.orders.payUnavailable'))
    return
  }

  payingId.value = order.id
  try {
    const outcome = await payOrder(order.id, openid)
    if (outcome === 'cancelled') {
      MessagePlugin.info(t('usage.upgrade.cancelled'))
      return
    }
    if (outcome !== 'success') {
      MessagePlugin.warning(t('usage.orders.payUnavailable'))
      return
    }

    const paid = await waitForOrderPaid(order.id)
    if (paid.status === 'PAID') {
      MessagePlugin.success(t('usage.upgrade.success'))
      await load()
    } else {
      MessagePlugin.warning(t('usage.upgrade.pendingConfirm'))
    }
  } catch {
    // 请求层已统一提示错误
  } finally {
    payingId.value = ''
  }
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

          <div
            v-if="order.status === 'PENDING'"
            class="orders__actions"
          >
            <t-button
              theme="primary"
              size="small"
              :loading="payingId === order.id"
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
