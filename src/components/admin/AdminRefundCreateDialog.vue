<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createAdminRefund, getAdminRefundQuote } from '@/api'
import type {
  AdminRefund,
  AdminRefundQuote,
  CreateAdminRefundParams,
  RefundType,
} from '@/api/types/refund'
import { formatAmount } from '@/utils/billing'

/**
 * 后台发起退款：输入订单 ID → 试算 → 提交。
 *
 * 后台发起**直接提交渠道**（不走审批），会写入审计日志。`MANUAL` 必须给金额，
 * 其余情况由后端按政策计算，前端只做上限校验。
 */
defineOptions({ name: 'AdminRefundCreateDialog' })

const props = defineProps<{
  /** 从订单管理跳转过来时预填的订单 ID */
  orderId?: string
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [refund: AdminRefund] }>()

const { t } = useI18n()

type TypeChoice = 'AUTO' | RefundType

const form = ref<{
  orderId: string
  type: TypeChoice
  amountYuan?: number
  reason: string
}>({
  orderId: '',
  type: 'AUTO',
  amountYuan: undefined,
  reason: '',
})

const quote = ref<AdminRefundQuote | null>(null)
const quoting = ref(false)
const submitting = ref(false)
const errorText = ref('')

/** 递增代次：关闭弹窗或改订单后，迟到响应不覆盖界面 */
let generation = 0

const typeOptions = computed(() => [
  { label: t('adminPage.refund.typeAuto'), value: 'AUTO' },
  { label: t('adminPage.refund.type.FULL'), value: 'FULL' },
  { label: t('adminPage.refund.type.PRORATED'), value: 'PRORATED' },
  { label: t('adminPage.refund.type.MANUAL'), value: 'MANUAL' },
])

const isManual = computed(() => form.value.type === 'MANUAL')
const manualAmount = computed(() =>
  Math.round(Number(form.value.amountYuan ?? 0) * 100),
)
const amountError = computed(() => {
  if (!isManual.value) return ''
  if (!Number.isFinite(manualAmount.value) || manualAmount.value <= 0) {
    return t('adminPage.refund.manualAmountRequired')
  }
  if (quote.value && manualAmount.value > quote.value.maxRefundable) {
    return t('adminPage.refund.manualAmountExceeded', {
      amount: formatAmount(quote.value.maxRefundable),
    })
  }
  return ''
})

const canSubmit = computed(
  () =>
    Boolean(quote.value?.eligible && quote.value?.enabled) &&
    !amountError.value &&
    !submitting.value,
)

async function runQuote() {
  const orderId = form.value.orderId.trim()
  const token = ++generation
  quote.value = null
  errorText.value = ''
  if (!orderId) {
    errorText.value = t('adminPage.refund.orderIdRequired')
    return
  }

  quoting.value = true
  try {
    const data = await getAdminRefundQuote(orderId)
    if (token !== generation) return
    quote.value = data
  } catch (cause) {
    if (token !== generation) return
    errorText.value =
      cause instanceof Error ? cause.message : t('adminPage.refund.quoteFailed')
  } finally {
    if (token === generation) quoting.value = false
  }
}

async function submit() {
  const orderId = form.value.orderId.trim()
  if (!orderId || !canSubmit.value) return

  const payload: CreateAdminRefundParams = { orderId }
  if (form.value.type !== 'AUTO') payload.type = form.value.type
  if (isManual.value) payload.amount = manualAmount.value
  if (form.value.reason.trim()) payload.reason = form.value.reason.trim()

  submitting.value = true
  errorText.value = ''
  try {
    const refund = await createAdminRefund(payload)
    MessagePlugin.success(t('adminPage.refund.createSuccess'))
    emit('created', refund)
    visible.value = false
  } catch (cause) {
    // 请求层已统一提示；保留文案在弹窗内方便运营对照
    errorText.value = cause instanceof Error ? cause.message : ''
  } finally {
    submitting.value = false
  }
}

/** 重置表单并在有预填订单时自动试算 */
function reset(prefill?: string) {
  generation++
  form.value = {
    orderId: prefill ?? '',
    type: 'AUTO',
    amountYuan: undefined,
    reason: '',
  }
  quote.value = null
  errorText.value = ''
  quoting.value = false
  if (prefill) void runQuote()
}

watch(
  () => [visible.value, props.orderId] as const,
  ([isVisible]) => {
    if (isVisible) {
      reset(props.orderId)
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
    :header="t('adminPage.refund.createTitle')"
    width="min(560px, calc(100vw - 32px))"
    placement="center"
  >
    <div class="refund-create">
      <p class="refund-create__hint">{{ t('adminPage.refund.createHint') }}</p>

      <div class="refund-create__row">
        <t-input
          v-model="form.orderId"
          :placeholder="t('adminPage.refund.orderIdPlaceholder')"
          :aria-label="t('adminPage.refund.orderId')"
          @enter="runQuote"
        />
        <t-button
          variant="outline"
          :loading="quoting"
          @click="runQuote"
        >
          {{ t('adminPage.refund.quote') }}
        </t-button>
      </div>

      <t-alert
        v-if="quote && !quote.enabled"
        theme="warning"
        :message="t('adminPage.refund.enabledOff')"
      />
      <t-alert
        v-if="quote && !quote.eligible"
        theme="info"
        :message="quote.reason || t('adminPage.refund.notEligible')"
      />

      <template v-if="quote">
        <dl class="refund-create__details">
          <div>
            <dt>{{ t('adminPage.refund.policy') }}</dt>
            <dd>{{ t(`adminPage.refund.policyCode.${quote.policyCode}`) }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.refund.amount') }}</dt>
            <dd>{{ formatAmount(quote.amount) }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.refund.limit') }}</dt>
            <dd>{{ formatAmount(quote.maxRefundable) }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.refund.usedDays') }}</dt>
            <dd>{{ t('adminPage.refund.days', { days: quote.usedDays }) }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.refund.remainingDays') }}</dt>
            <dd>
              {{ t('adminPage.refund.days', { days: quote.remainingDays }) }}
            </dd>
          </div>
        </dl>

        <t-form-item
          :label="t('adminPage.refund.typeLabel')"
          class="refund-create__field"
        >
          <t-select
            v-model="form.type"
            :options="typeOptions"
          />
        </t-form-item>

        <t-form-item
          v-if="isManual"
          :label="t('adminPage.refund.manualAmount')"
          class="refund-create__field"
        >
          <t-input-number
            v-model="form.amountYuan"
            :min="0"
            :decimal-places="2"
            :step="1"
            theme="normal"
          />
          <p
            v-if="amountError"
            class="refund-create__error"
          >
            {{ amountError }}
          </p>
        </t-form-item>

        <t-form-item
          :label="t('adminPage.refund.reasonLabel')"
          class="refund-create__field"
        >
          <t-input
            v-model="form.reason"
            :maxlength="200"
            :placeholder="t('adminPage.refund.reasonPlaceholder')"
          />
        </t-form-item>
      </template>

      <t-alert
        v-if="errorText"
        theme="error"
        :message="errorText"
      />
    </div>

    <template #footer>
      <div class="refund-create__buttons">
        <t-button
          variant="outline"
          @click="visible = false"
        >
          {{ t('adminPage.common.cancel') }}
        </t-button>
        <t-button
          theme="primary"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ t('adminPage.refund.submit') }}
        </t-button>
      </div>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.refund-create {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__hint {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.t-input) {
      flex: 1;
    }
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

  &__field {
    display: block;
  }

  &__error {
    margin: 4px 0 0;
    font-size: @beacon-font-size-caption;
    color: @beacon-error;
  }

  &__buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
