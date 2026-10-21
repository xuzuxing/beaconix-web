<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createAlipayPayment, getOrder } from '@/api'
import type { Order } from '@/api/types/billing'
import AppIcon from '@/components/AppIcon.vue'
import { RefreshIcon } from '@/icons'
import { formatAmount } from '@/utils/billing'
import {
  formatCountdown,
  isOrderPayable,
  orderRemainingMs,
  waitForOrderPaid,
} from '@/utils/payment'
import { toQrCodeDataUrl } from '@/utils/qrcode'

/**
 * 支付宝 Native 扫码支付弹窗。
 *
 * 流程：对订单调用 `POST /orders/:id/pay`（channel=ALIPAY）拿到支付链接 →
 * 浏览器本地渲染二维码 → 后端异步回调把订单置为 PAID → 这里轮询到 PAID 后
 * 通知父组件刷新套餐/订单。关闭弹窗只停止轮询，订单仍保留在订单管理页。
 *
 * 所有异步结果都带 generation 校验：弹窗关闭、切换订单或刷新二维码后，
 * 上一轮请求的迟到响应不会覆盖当前界面。
 */
defineOptions({ name: 'AlipayQrPayDialog' })

const props = defineProps<{
  /** 待支付订单；为空时弹窗不发起任何请求 */
  order: Order | null
}>()

const visible = defineModel<boolean>('visible', { required: true })

const emit = defineEmits<{ paid: [order: Order] }>()

const { t } = useI18n()

type PayState = 'loading' | 'ready' | 'expired' | 'failed' | 'paid'

const state = ref<PayState>('loading')
const qrCodeUrl = ref('')
const checking = ref(false)
const remainingMs = ref(0)

/** 递增的请求代次：只接受当前代次的异步结果 */
let generation = 0
let controller: AbortController | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

const amount = computed(() => formatAmount(props.order?.amount ?? 0))
const orderNo = computed(() => props.order?.orderNo ?? '')
const countdown = computed(() => formatCountdown(remainingMs.value))
const showCountdown = computed(
  () => state.value === 'ready' && remainingMs.value > 0,
)

function stopTimers() {
  controller?.abort()
  controller = null
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

/** 订单超时后二维码不再可用，需要重新下单 */
function markExpired() {
  stopTimers()
  state.value = 'expired'
  remainingMs.value = 0
}

function startCountdown(expiresAt: string) {
  if (countdownTimer) clearInterval(countdownTimer)

  const tick = () => {
    remainingMs.value = orderRemainingMs({ expiresAt })
    if (remainingMs.value === 0) markExpired()
  }

  tick()
  if (state.value === 'expired') return
  countdownTimer = setInterval(tick, 1000)
}

/** 支付成功：提示、通知父组件并关闭弹窗 */
function completePayment(order: Order) {
  generation++
  stopTimers()
  state.value = 'paid'
  MessagePlugin.success(t('usage.payment.success'))
  emit('paid', order)
  visible.value = false
}

/** 轮询订单状态，等待后端支付回调落库 */
async function poll(order: Order) {
  const token = generation
  controller = new AbortController()

  try {
    const latest = await waitForOrderPaid(order.id, {
      intervalMs: 3000,
      timeoutMs: Math.max(10_000, orderRemainingMs(order)),
      signal: controller.signal,
    })
    // 弹窗已关闭 / 已刷新二维码：丢弃这次结果
    if (token !== generation || controller?.signal.aborted) return

    if (latest.status === 'PAID') {
      completePayment(latest)
      return
    }

    // 订单被取消、退款或已过期：二维码作废
    if (latest.status !== 'PENDING' || !isOrderPayable(latest)) markExpired()
  } catch {
    // 网络抖动不打断扫码流程；二维码仍在有效期内，用户可点「我已支付」重试
  }
}

/** 预下单 + 渲染二维码；同一订单重复调用等价于刷新二维码 */
async function start(order: Order | null) {
  generation++
  stopTimers()
  qrCodeUrl.value = ''
  remainingMs.value = 0

  if (!order) return
  if (!isOrderPayable(order)) {
    markExpired()
    return
  }

  const token = generation
  state.value = 'loading'

  try {
    const params = await createAlipayPayment(order.id)
    if (token !== generation) return

    // precreate 扫码渠道返回 qrCode；缺失说明后端走了收银台模式，无法出码
    const qrCode = params.qrCode
    if (!qrCode) {
      state.value = 'failed'
      return
    }
    const dataUrl = await toQrCodeDataUrl(qrCode, { size: 200 })
    if (token !== generation) return

    qrCodeUrl.value = dataUrl
    state.value = 'ready'
    startCountdown(order.expiresAt)
    void poll(order)
  } catch {
    if (token !== generation) return
    state.value = 'failed'
  }
}

/** 手动确认支付结果（用户付完款不想等轮询时使用） */
async function checkNow() {
  const order = props.order
  if (!order || checking.value) return

  checking.value = true
  try {
    const latest = await getOrder(order.id)
    if (latest.status === 'PAID') {
      completePayment(latest)
      return
    }
    if (latest.status !== 'PENDING' || !isOrderPayable(latest)) {
      markExpired()
      return
    }
    MessagePlugin.info(t('usage.payment.notYetPaid'))
  } catch {
    // 请求层已统一提示错误
  } finally {
    checking.value = false
  }
}

watch(
  () => [visible.value, props.order?.id] as const,
  ([isVisible]) => {
    if (isVisible) {
      void start(props.order)
      return
    }
    generation++
    stopTimers()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  generation++
  stopTimers()
})
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('usage.payment.title')"
    dialog-class-name="alipay-pay-dialog"
    width="min(420px, calc(100vw - 32px))"
    placement="center"
  >
    <div
      v-if="order"
      class="alipay-pay"
    >
      <div class="alipay-pay__summary">
        <strong class="alipay-pay__amount">{{ amount }}</strong>
        <span class="alipay-pay__no">{{
          t('usage.payment.orderNo', { no: orderNo })
        }}</span>
      </div>

      <div class="alipay-pay__code">
        <img
          v-if="state === 'ready'"
          class="alipay-pay__qr"
          :src="qrCodeUrl"
          :alt="t('usage.payment.qrAlt')"
        />
        <t-loading
          v-else-if="state === 'loading'"
          size="24px"
          :text="t('usage.payment.generating')"
        />
        <p
          v-else-if="state === 'expired'"
          class="alipay-pay__state"
        >
          {{ t('usage.payment.expired') }}
        </p>
        <p
          v-else
          class="alipay-pay__state"
        >
          {{ t('usage.payment.failed') }}
        </p>
      </div>

      <p
        v-if="state === 'ready'"
        class="alipay-pay__hint"
      >
        {{ t('usage.payment.scanHint') }}
      </p>
      <p
        v-if="showCountdown"
        class="alipay-pay__countdown"
      >
        {{ t('usage.payment.countdown', { time: countdown }) }}
      </p>
    </div>

    <template #footer>
      <div class="alipay-pay__buttons">
        <t-button
          variant="outline"
          :disabled="state === 'loading'"
          @click="start(order)"
        >
          <template #icon>
            <AppIcon
              :icon="RefreshIcon"
              :size="16"
            />
          </template>
          {{ t('usage.payment.refresh') }}
        </t-button>
        <t-button
          theme="primary"
          :loading="checking"
          :disabled="state === 'loading' || state === 'expired'"
          @click="checkNow"
        >
          {{ t('usage.payment.check') }}
        </t-button>
      </div>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.alipay-pay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 4px 0;

  &__summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  &__amount {
    font-size: 28px;
    font-weight: 600;
    color: @beacon-text-primary;
  }

  &__no {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__code {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 216px;
    height: 216px;
    padding: 8px;
    background-color: #fff;
    border: 1px solid @beacon-border;
  }

  &__qr {
    display: block;
    width: 200px;
    height: 200px;
  }

  &__state {
    margin: 0;
    padding: 0 8px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    text-align: center;
  }

  &__hint {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    text-align: center;
  }

  &__countdown {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
