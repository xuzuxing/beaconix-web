<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { AdminOrder } from '@/api/types/admin'
import {
  formatAmount,
  formatDateTime,
  planCycleLabelKey,
} from '@/utils/billing'
import {
  isOrderExpired,
  orderActions,
  orderStatusTheme,
} from '@/utils/admin-presenter'
import { shortId } from '@/utils/team-presenter'

/**
 * 订单详情抽屉：订单字段 + 该订单当前可执行的运营操作入口。
 * 操作本身由页面处理，这里只把可用动作抛出去。
 */
defineOptions({ name: 'AdminOrderDetailDrawer' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ order: AdminOrder | null; busy?: boolean }>()
const emit = defineEmits<{
  act: [action: 'cancel' | 'markPaid' | 'refund']
  /** 打开后台发起退款（真实调用支付渠道），由页面跳转到退款管理 */
  createRefund: []
}>()
const { t } = useI18n()

const actions = () => (props.order ? orderActions(props.order) : null)
</script>

<template>
  <t-drawer
    v-model:visible="visible"
    size="min(560px, 100vw)"
    :header="t('adminPage.order.detailTitle')"
    :footer="false"
  >
    <div
      v-if="order"
      class="order-detail"
    >
      <header class="order-detail__head">
        <span class="order-detail__no">{{ order.orderNo }}</span>
        <t-tag
          size="small"
          variant="light"
          :theme="orderStatusTheme(order.status)"
        >
          {{ t(`adminPage.order.statusLabel.${order.status}`) }}
        </t-tag>
        <t-tag
          v-if="order.status === 'PENDING' && isOrderExpired(order)"
          size="small"
          variant="light"
          theme="default"
        >
          {{ t('adminPage.order.expired') }}
        </t-tag>
      </header>

      <dl class="order-detail__info">
        <div>
          <dt>{{ t('adminPage.order.organization') }}</dt>
          <dd>
            {{ order.organization?.name ?? shortId(order.organizationId) }}
          </dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.organizationId') }}</dt>
          <dd class="order-detail__mono">{{ order.organizationId }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.user') }}</dt>
          <dd>{{ order.user?.name ?? shortId(order.userId) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.userId') }}</dt>
          <dd class="order-detail__mono">{{ order.userId }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.plan') }}</dt>
          <dd>{{ order.plan?.name ?? order.planId }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.amount') }}</dt>
          <dd>{{ formatAmount(order.amount) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.duration') }}</dt>
          <dd>
            {{
              t('adminPage.order.durationDays', { days: order.durationDays })
            }}
          </dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.cycle') }}</dt>
          <dd>{{ t(planCycleLabelKey(order.cycle)) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.createdAt') }}</dt>
          <dd>{{ formatDateTime(order.createdAt) }}</dd>
        </div>
        <div v-if="order.paidAt">
          <dt>{{ t('adminPage.order.paidAt') }}</dt>
          <dd>{{ formatDateTime(order.paidAt) }}</dd>
        </div>
        <div v-if="order.cancelledAt">
          <dt>{{ t('adminPage.order.cancelledAt') }}</dt>
          <dd>{{ formatDateTime(order.cancelledAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.expiresAt') }}</dt>
          <dd>{{ formatDateTime(order.expiresAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.order.orderId') }}</dt>
          <dd class="order-detail__mono">{{ order.id }}</dd>
        </div>
      </dl>

      <div
        v-if="actions()"
        class="order-detail__actions"
      >
        <t-button
          v-if="actions()?.canMarkPaid"
          theme="primary"
          size="small"
          :loading="busy"
          @click="emit('act', 'markPaid')"
        >
          {{ t('adminPage.order.markPaid') }}
        </t-button>
        <t-button
          v-if="actions()?.canCancel"
          variant="outline"
          size="small"
          :loading="busy"
          @click="emit('act', 'cancel')"
        >
          {{ t('adminPage.order.cancel') }}
        </t-button>
        <t-button
          v-if="actions()?.canRefund"
          variant="outline"
          size="small"
          :loading="busy"
          @click="emit('act', 'refund')"
        >
          {{ t('adminPage.order.refund') }}
        </t-button>
        <t-button
          v-if="actions()?.canRefund"
          theme="primary"
          size="small"
          @click="emit('createRefund')"
        >
          {{ t('adminPage.order.createRefund') }}
        </t-button>
      </div>

      <t-alert
        v-if="order.status === 'PENDING'"
        theme="info"
        :message="t('adminPage.order.markPaidHint')"
      />
      <t-alert
        v-else-if="order.status === 'PAID'"
        theme="warning"
        :message="t('adminPage.order.refundHint')"
      />
    </div>
  </t-drawer>
</template>

<style scoped lang="less">
.order-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__no {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__info {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 0;

    div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
    }

    dt {
      flex: none;
      font-size: @beacon-font-size-base;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 0;
      overflow: hidden;
      color: @beacon-text-primary;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__mono {
    font-size: @beacon-font-size-base;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
