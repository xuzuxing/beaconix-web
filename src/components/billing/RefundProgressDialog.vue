<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { listOrderRefunds } from '@/api'
import type { Order } from '@/api/types/billing'
import type { Refund } from '@/api/types/refund'
import { formatAmount, formatDateTime } from '@/utils/billing'
import {
  isRefundInFlight,
  latestRefund,
  refundDisplayAmount,
  refundStatusTheme,
  shouldStopRefundPolling,
} from '@/utils/refund'

/**
 * 退款进度弹窗：展示最近一条退款单，并在非终态时轮询。
 *
 * 后端没有 SSE / WebSocket，渠道回调通常几秒到几十秒，因此 5 秒一次、
 * 最多 2 分钟；`SUCCESS` / `FAILED` / `CLOSED` 即停（`FAILED` 由后台重试驱动）。
 * 关窗即停止轮询，迟到的响应不会覆盖界面。
 */
defineOptions({ name: 'RefundProgressDialog' })

const props = defineProps<{ order: Order | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ settled: [refund: Refund] }>()

const { t } = useI18n()

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 120_000

type DialogState = 'loading' | 'ready' | 'empty' | 'failed'

const state = ref<DialogState>('loading')
const refund = ref<Refund | null>(null)
const polling = ref(false)

let generation = 0
let timer: ReturnType<typeof setTimeout> | null = null
let deadline = 0
/** 本轮是否已把终态结果通知父组件，避免每次手动刷新重复触发 */
let settledEmitted = false

const statusLabel = computed(() =>
  refund.value ? t(`usage.refund.status.${refund.value.status}`) : '',
)
const policyLabel = computed(() =>
  refund.value ? t(`usage.refund.policyCode.${refund.value.policyCode}`) : '—',
)
const typeLabel = computed(() =>
  refund.value ? t(`usage.refund.type.${refund.value.type}`) : '—',
)

function stopPolling() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  polling.value = false
}

function settle(latest: Refund) {
  if (settledEmitted) return
  settledEmitted = true
  emit('settled', latest)
}

async function tick(token: number) {
  const order = props.order
  if (!order || token !== generation) return

  try {
    const refunds = await listOrderRefunds(order.id)
    if (token !== generation) return

    const latest = latestRefund(Array.isArray(refunds) ? refunds : [])
    refund.value = latest
    state.value = latest ? 'ready' : 'empty'

    if (!latest) {
      stopPolling()
      return
    }
    if (shouldStopRefundPolling(latest.status)) {
      stopPolling()
      settle(latest)
      return
    }
    if (Date.now() + POLL_INTERVAL_MS > deadline) {
      stopPolling()
      return
    }

    polling.value = true
    timer = setTimeout(() => {
      timer = null
      void tick(token)
    }, POLL_INTERVAL_MS)
  } catch {
    if (token !== generation) return
    // 请求层已统一提示错误；已有数据时保留展示，不再继续轮询
    state.value = refund.value ? 'ready' : 'failed'
    stopPolling()
  }
}

function load(order: Order | null) {
  const token = ++generation
  stopPolling()
  refund.value = null
  settledEmitted = false
  deadline = Date.now() + POLL_TIMEOUT_MS

  if (!order) return
  state.value = 'loading'
  void tick(token)
}

/** 手动刷新：重置轮询预算，便于用户等渠道回调时自己催一次 */
function refreshNow() {
  const token = ++generation
  stopPolling()
  state.value = refund.value ? 'ready' : 'loading'
  deadline = Date.now() + POLL_TIMEOUT_MS
  void tick(token)
}

watch(
  () => [visible.value, props.order?.id] as const,
  ([isVisible]) => {
    if (isVisible) {
      load(props.order)
      return
    }
    generation++
    stopPolling()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  generation++
  stopPolling()
})
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('usage.refund.progressTitle')"
    width="min(480px, calc(100vw - 32px))"
    placement="center"
  >
    <div
      v-if="order"
      class="refund-progress"
    >
      <span class="refund-progress__no">{{
        t('usage.refund.orderNo', { no: order.orderNo })
      }}</span>

      <t-loading
        v-if="state === 'loading'"
        size="20px"
        :text="t('usage.refund.loadingRefund')"
      />

      <p
        v-else-if="state === 'failed'"
        class="refund-progress__hint"
      >
        {{ t('usage.refund.loadFailed') }}
      </p>

      <p
        v-else-if="state === 'empty' || !refund"
        class="refund-progress__hint"
      >
        {{ t('usage.refund.noRefund') }}
      </p>

      <template v-else>
        <div class="refund-progress__head">
          <t-tag
            :theme="refundStatusTheme(refund.status)"
            variant="light"
            size="small"
          >
            {{ statusLabel }}
          </t-tag>
          <strong class="refund-progress__amount">{{
            formatAmount(refundDisplayAmount(refund))
          }}</strong>
          <t-tag
            v-if="refund.status === 'SUCCESS' && refund.settledAmount !== null"
            variant="outline"
            size="small"
          >
            {{ t('usage.refund.settledAmount') }}
            {{ formatAmount(refund.settledAmount) }}
          </t-tag>
        </div>

        <p
          v-if="polling || isRefundInFlight(refund.status)"
          class="refund-progress__hint"
        >
          {{ t('usage.refund.polling') }}
        </p>

        <t-alert
          v-if="refund.status === 'FAILED' && refund.failureReason"
          theme="error"
          :message="`${t('usage.refund.failureReason')}: ${refund.failureReason}`"
        />
        <t-alert
          v-else-if="refund.status === 'CLOSED'"
          theme="info"
          :message="t('usage.refund.closedHint')"
        />

        <dl class="refund-progress__details">
          <div>
            <dt>{{ t('usage.refund.refundNo') }}</dt>
            <dd>{{ refund.refundNo }}</dd>
          </div>
          <div>
            <dt>{{ t('usage.refund.amount') }}</dt>
            <dd>{{ formatAmount(refund.amount) }}</dd>
          </div>
          <div>
            <dt>{{ t('usage.refund.typeLabel') }}</dt>
            <dd>{{ typeLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('usage.refund.policy') }}</dt>
            <dd>{{ policyLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('usage.refund.usedDays') }}</dt>
            <dd>{{ t('usage.refund.days', { days: refund.usedDays }) }}</dd>
          </div>
          <div>
            <dt>{{ t('usage.refund.remainingDays') }}</dt>
            <dd>
              {{ t('usage.refund.days', { days: refund.remainingDays }) }}
            </dd>
          </div>
          <div v-if="refund.reason">
            <dt>{{ t('usage.refund.reasonText') }}</dt>
            <dd>{{ refund.reason }}</dd>
          </div>
          <div>
            <dt>{{ t('usage.refund.createdAt') }}</dt>
            <dd>{{ formatDateTime(refund.createdAt) }}</dd>
          </div>
          <div v-if="refund.refundedAt">
            <dt>{{ t('usage.refund.refundedAt') }}</dt>
            <dd>{{ formatDateTime(refund.refundedAt) }}</dd>
          </div>
        </dl>
      </template>
    </div>

    <template #footer>
      <div class="refund-progress__buttons">
        <t-button
          variant="outline"
          :disabled="state === 'loading'"
          @click="refreshNow"
        >
          {{ t('usage.refund.refresh') }}
        </t-button>
        <t-button
          theme="primary"
          @click="visible = false"
        >
          {{ t('usage.refund.close') }}
        </t-button>
      </div>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.refund-progress {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;

  &__no,
  &__hint {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__hint {
    margin: 0;
    color: @beacon-text-secondary;
  }

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__amount {
    font-size: 24px;
    font-weight: 600;
    color: @beacon-text-primary;
  }

  &__details {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
      word-break: break-word;
    }
  }

  &__buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
