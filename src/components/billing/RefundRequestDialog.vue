<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createOrderRefund, getOrderRefundQuote } from '@/api'
import type { Order } from '@/api/types/billing'
import type { Refund, RefundQuote } from '@/api/types/refund'
import { formatAmount } from '@/utils/billing'
import { canSubmitRefund, quoteHasFee, refundStatusTheme } from '@/utils/refund'

/**
 * 退款申请弹窗：先做试算（只读），确认后再提交申请。
 *
 * 金额完全由服务端计算，前端只展示；确认区必须展示 `subscriptionEffect`，
 * 否则用户会以为「退了钱还能继续用到到期」。提交被拒时展示后端返回的原因
 * （例如总开关关闭时的 `Refunds are disabled`），请求层同时会给出提示。
 */
defineOptions({ name: 'RefundRequestDialog' })

const props = defineProps<{ order: Order | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ submitted: [refund: Refund] }>()

const { t } = useI18n()

/** 单次申请的理由长度上限，与后端 DTO 一致 */
const REASON_MAX = 200

type DialogState = 'loading' | 'ready' | 'failed' | 'submitted'

const state = ref<DialogState>('loading')
const quote = ref<RefundQuote | null>(null)
const reason = ref('')
const submitting = ref(false)
const errorText = ref('')
const result = ref<Refund | null>(null)

/** 递增的请求代次：关闭弹窗或切换订单后，迟到响应不覆盖界面 */
let generation = 0

const trimmedReason = computed(() => reason.value.trim())
const reasonTooLong = computed(() => trimmedReason.value.length > REASON_MAX)
const canSubmit = computed(
  () =>
    canSubmitRefund(quote.value, true) &&
    !reasonTooLong.value &&
    !submitting.value,
)
const policyLabel = computed(() =>
  quote.value ? t(`usage.refund.policyCode.${quote.value.policyCode}`) : '—',
)
const effectText = computed(() =>
  quote.value
    ? t(`usage.refund.effect.${quote.value.subscriptionEffect}`, {
        days: quote.value.remainingDays,
      })
    : '',
)
const submittedHint = computed(() => {
  const refund = result.value
  if (!refund) return ''
  if (refund.status === 'PENDING') return t('usage.refund.submittedPending')
  if (refund.status === 'SUCCESS') return t('usage.refund.submittedSuccess')
  return t('usage.refund.submittedProcessing')
})

async function loadQuote(order: Order | null) {
  const token = ++generation
  quote.value = null
  result.value = null
  errorText.value = ''
  reason.value = ''

  if (!order) return
  state.value = 'loading'
  try {
    const data = await getOrderRefundQuote(order.id)
    if (token !== generation) return
    quote.value = data
    state.value = 'ready'
  } catch (cause) {
    if (token !== generation) return
    state.value = 'failed'
    errorText.value = cause instanceof Error ? cause.message : ''
  }
}

async function submit() {
  const order = props.order
  if (!order || !canSubmit.value) return

  submitting.value = true
  errorText.value = ''
  try {
    const refund = await createOrderRefund(
      order.id,
      trimmedReason.value ? { reason: trimmedReason.value } : {},
    )
    result.value = refund
    state.value = 'submitted'
    emit('submitted', refund)
    MessagePlugin.success(t('usage.refund.submitted'))
  } catch (cause) {
    // 请求层已统一提示错误；这里保留文案在弹窗内，方便用户对照处理
    errorText.value =
      cause instanceof Error ? cause.message : t('usage.refund.failed')
  } finally {
    submitting.value = false
  }
}

watch(
  () => [visible.value, props.order?.id] as const,
  ([isVisible]) => {
    if (isVisible) {
      void loadQuote(props.order)
      return
    }
    generation++
  },
  { immediate: true },
)
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('usage.refund.title')"
    width="min(480px, calc(100vw - 32px))"
    placement="center"
  >
    <div
      v-if="order"
      class="refund-request"
    >
      <div class="refund-request__summary">
        <span class="refund-request__no">{{
          t('usage.refund.orderNo', { no: order.orderNo })
        }}</span>
      </div>

      <t-loading
        v-if="state === 'loading'"
        size="20px"
        :text="t('usage.refund.quoting')"
      />

      <template v-else-if="state === 'submitted' && result">
        <div class="refund-request__result">
          <t-tag
            :theme="refundStatusTheme(result.status)"
            variant="light"
            size="small"
          >
            {{ t(`usage.refund.status.${result.status}`) }}
          </t-tag>
          <strong class="refund-request__amount">{{
            formatAmount(result.amount)
          }}</strong>
        </div>
        <p class="refund-request__hint">{{ submittedHint }}</p>
        <p class="refund-request__meta">
          {{ t('usage.refund.refundNo') }} {{ result.refundNo }}
        </p>
      </template>

      <template v-else-if="quote">
        <div
          v-if="quote.eligible && quote.selfServiceEnabled"
          class="refund-request__amounts"
        >
          <span class="refund-request__label">{{
            t('usage.refund.amountLabel')
          }}</span>
          <strong class="refund-request__amount">{{
            formatAmount(quote.amount)
          }}</strong>
          <span
            v-if="quoteHasFee(quote)"
            class="refund-request__meta"
          >
            {{
              t('usage.refund.grossAmount', {
                amount: formatAmount(quote.grossAmount),
              })
            }}
            ·
            {{
              t('usage.refund.fee', { amount: formatAmount(quote.feeAmount) })
            }}
          </span>
        </div>

        <t-alert
          v-if="!quote.eligible"
          theme="warning"
          :message="quote.reason || t('usage.refund.notEligible')"
        />
        <t-alert
          v-else-if="!quote.selfServiceEnabled"
          theme="info"
          :message="t('usage.refund.selfServiceDisabled')"
        />

        <dl class="refund-request__details">
          <div>
            <dt>{{ t('usage.refund.policy') }}</dt>
            <dd>{{ policyLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('usage.refund.usedDays') }}</dt>
            <dd>
              {{ t('usage.refund.days', { days: quote.usedDays }) }}
            </dd>
          </div>
          <div>
            <dt>{{ t('usage.refund.remainingDays') }}</dt>
            <dd>
              {{ t('usage.refund.days', { days: quote.remainingDays }) }}
            </dd>
          </div>
          <div v-if="quote.subscriptionEffect !== 'NONE'">
            <dt>{{ t('usage.refund.effectTitle') }}</dt>
            <dd class="refund-request__effect">{{ effectText }}</dd>
          </div>
        </dl>

        <t-alert
          v-if="quote.eligible && quote.selfServiceEnabled"
          theme="warning"
          :message="effectText"
        />

        <template v-if="quote.eligible && quote.selfServiceEnabled">
          <t-textarea
            v-model="reason"
            :maxlength="REASON_MAX"
            :placeholder="t('usage.refund.reasonPlaceholder')"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
          <p
            v-if="reasonTooLong"
            class="refund-request__error"
          >
            {{ t('usage.refund.reasonTooLong', { max: REASON_MAX }) }}
          </p>
        </template>

        <t-alert
          v-if="errorText"
          theme="error"
          :message="errorText"
        />
      </template>

      <t-alert
        v-else
        theme="error"
        :message="errorText || t('usage.refund.quoteFailed')"
      />
    </div>

    <template #footer>
      <div class="refund-request__buttons">
        <t-button
          variant="outline"
          @click="visible = false"
        >
          {{
            state === 'submitted'
              ? t('usage.refund.close')
              : t('usage.refund.cancel')
          }}
        </t-button>
        <t-button
          v-if="
            state === 'ready' && quote?.eligible && quote?.selfServiceEnabled
          "
          theme="primary"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ t('usage.refund.submit') }}
        </t-button>
      </div>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.refund-request {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__no {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__amounts,
  &__result {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__result {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  &__label,
  &__meta,
  &__hint {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__amount {
    font-size: 26px;
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
      color: @beacon-text-primary;
      text-align: right;
    }
  }

  &__effect {
    max-width: 60%;
  }

  &__error {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-error;
  }

  &__buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
