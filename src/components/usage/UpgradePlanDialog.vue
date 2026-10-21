<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createOrder } from '@/api'
import type { Order, Plan, PlanCycle } from '@/api/types/billing'
import AppIcon from '@/components/AppIcon.vue'
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  FlashIcon,
  Layers01Icon,
  TeamWorkIcon,
  UserIcon,
} from '@/icons'
import { useOrganizationStore } from '@/stores'
import {
  cheapestTerm,
  enabledTerms,
  formatAmount,
  planCycleLabelKey,
  planTagTheme,
  planTier,
  termMonthlyPrice,
} from '@/utils/billing'
/**
 * 套餐升级弹窗：拉取套餐目录 → 选择套餐与计费周期 → 创建订单 → 交给支付宝扫码支付。
 *
 * 金额与时长由后端按所选周期档位决定：前端只提交 `planId` + `cycle`，
 * 不允许传价格或天数。下单成功后本组件把订单抛给父页面，由父页面托管
 * `AlipayQrPayDialog`；未支付的订单保留在订单管理页，可随时继续支付。
 */
defineOptions({ name: 'UpgradePlanDialog' })

const props = defineProps<{
  /** 套餐目录，由页面统一加载后传入 */
  plans?: Plan[]
  /** 套餐目录加载中 */
  loading?: boolean
}>()

const visible = defineModel<boolean>('visible', { required: true })

const emit = defineEmits<{ pay: [order: Order] }>()

const { t } = useI18n()
const orgStore = useOrganizationStore()
const dialogId = useId()

const selectedPlanId = ref('')
const selectedCycle = ref<PlanCycle | null>(null)
const submitting = ref(false)

const comparisonPlans = computed(() =>
  (props.plans ?? [])
    .filter((plan) => plan.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder),
)

/** 免费版仅用于对比，后端不支持为 FREE 创建订单。 */
const purchasablePlans = computed(() =>
  comparisonPlans.value.filter(
    (plan) => plan.code.trim().toUpperCase() !== 'FREE',
  ),
)

const selectedPlan = computed(
  () =>
    purchasablePlans.value.find((plan) => plan.id === selectedPlanId.value) ??
    null,
)

/** 选中套餐的可购买周期档位（目录接口只给启用档，这里再兜一层） */
const selectedTerms = computed(() => enabledTerms(selectedPlan.value))

/** 当前选中的档位；套餐没有可用档位时为 null */
const selectedTerm = computed(
  () =>
    selectedTerms.value.find((term) => term.cycle === selectedCycle.value) ??
    null,
)

/** 应付金额取自所选档位，不能用 plan.price（那是「起」价） */
const total = computed(() => formatAmount(selectedTerm.value?.price ?? 0))

const busy = computed(() => submitting.value)
const canSubmit = computed(
  () =>
    !!selectedPlan.value &&
    !!selectedTerm.value &&
    !!orgStore.currentOrganizationId &&
    !props.loading,
)

/** 卡片主价格：最便宜启用档（后端把同值镜像到 plan.price，档位缺失时回退） */
function displayPrice(plan: Plan): string {
  return formatAmount(cheapestTerm(plan)?.price ?? plan.price)
}

/** 卡片价格后缀：最便宜档的周期名 */
function displayCycle(plan: Plan): string {
  const term = cheapestTerm(plan)
  return term ? t(planCycleLabelKey(term.cycle)) : ''
}

/** 档位的折合月均价文案，仅作展示参考 */
function monthlyHint(term: { price: number; durationDays: number }): string {
  return formatAmount(termMonthlyPrice(term))
}
function abilities(plan: Plan) {
  // limit 为 0 表示该资源在当前套餐下不可用（后端语义），因此 allowed 跟随上限
  return [
    {
      key: 'monitors',
      label: t('usage.package.limit.monitors'),
      value: plan.maxMonitors,
      allowed: plan.maxMonitors > 0,
    },
    {
      key: 'probes',
      label: t('usage.package.limit.probes'),
      value: plan.maxProbes,
      allowed: plan.maxProbes > 0,
    },
    {
      key: 'apiKeys',
      label: t('usage.package.limit.apiKeys'),
      value: plan.maxApiKeys ?? 0,
      allowed: (plan.maxApiKeys ?? 0) > 0,
    },
    {
      key: 'members',
      label: t('usage.package.limit.members'),
      value: plan.maxMembers,
      allowed: plan.maxMembers > 0,
    },
    {
      key: 'channels',
      label: t('usage.package.limit.channels'),
      value: plan.maxChannels,
      allowed: plan.maxChannels > 0,
    },
    {
      key: 'interval',
      label: t('usage.package.minInterval'),
      value: t('usage.package.seconds', { value: plan.minInterval }),
      allowed: true,
    },
    {
      key: 'tenantProbe',
      label: t('usage.package.feature.tenantProbe'),
      value: t(
        plan.allowTenantProbe
          ? 'usage.package.allowed'
          : 'usage.package.notAllowed',
      ),
      allowed: plan.allowTenantProbe,
    },
    {
      key: 'statusPage',
      label: t('usage.package.feature.statusPage'),
      value: t(
        plan.allowStatusPage
          ? 'usage.package.allowed'
          : 'usage.package.notAllowed',
      ),
      allowed: plan.allowStatusPage,
    },
  ]
}

const submitText = computed(() =>
  submitting.value ? t('usage.upgrade.submitting') : t('usage.upgrade.pay'),
)

function selectPlan(plan: Plan) {
  if (busy.value || !purchasablePlans.value.some((item) => item.id === plan.id))
    return
  selectedPlanId.value = plan.id
  // 默认选中第一个档位（后端已按 sortOrder 排好）
  selectedCycle.value = enabledTerms(plan)[0]?.cycle ?? null
}

function onPlanKeydown(event: KeyboardEvent, planId: string) {
  const list = purchasablePlans.value
  const index = list.findIndex((plan) => plan.id === planId)
  let next = index
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    next = (index + 1) % list.length
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    next = (index + list.length - 1) % list.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = list.length - 1
  else return

  event.preventDefault()
  const plan = list[next]
  if (!plan || busy.value || props.loading) return
  selectPlan(plan)
  const button = event.currentTarget as HTMLButtonElement
  button
    .closest('.upgrade__plans')
    ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    [next]?.focus()
}

/** 下单成功后关闭本弹窗，把订单交给页面打开支付宝扫码支付 */
async function submit() {
  const plan = selectedPlan.value
  const orgId = orgStore.currentOrganizationId
  if (!plan || !orgId || !canSubmit.value || busy.value) return

  submitting.value = true
  try {
    const order = await createOrder(orgId, {
      planId: plan.id,
      cycle: selectedCycle.value ?? undefined,
    })

    visible.value = false
    emit('pay', order)
  } catch {
    // 请求层已统一提示错误
  } finally {
    submitting.value = false
  }
}

// 套餐目录就绪（或变化）后确保有一个选中项
watch(
  purchasablePlans,
  (list) => {
    if (!list.length) {
      selectedPlanId.value = ''
      selectedCycle.value = null
      return
    }
    const first = list[0]
    if (first && !list.some((plan) => plan.id === selectedPlanId.value)) {
      selectPlan(first)
    }
  },
  { immediate: true },
)

// 档位变化（切换套餐或目录刷新）后，落回第一个可用档位，避免提交空 cycle
watch(selectedTerms, (terms) => {
  if (!terms.some((term) => term.cycle === selectedCycle.value)) {
    selectedCycle.value = terms[0]?.cycle ?? null
  }
})
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('usage.upgrade.title')"
    dialog-class-name="upgrade-dialog"
    width="min(950px, calc(100vw - 32px))"
    placement="center"
    :close-btn="!busy"
    :close-on-esc-keydown="!busy"
    :close-on-overlay-click="!busy"
  >
    <p class="upgrade__desc">{{ t('usage.upgrade.desc') }}</p>

    <div
      v-loading="loading"
      class="upgrade__content"
      :aria-busy="loading"
    >
      <div
        v-if="comparisonPlans.length"
        class="upgrade__plans"
        role="radiogroup"
        :aria-label="t('usage.upgrade.selectPlan')"
      >
        <article
          v-for="plan in comparisonPlans"
          :key="plan.id"
          class="upgrade__card"
          :class="[
            `beacon-plan--${planTier(plan)}`,
            { 'is-active': plan.id === selectedPlanId },
          ]"
        >
          <button
            v-if="plan.code.trim().toUpperCase() !== 'FREE'"
            type="button"
            role="radio"
            class="upgrade__plan-select"
            :aria-checked="plan.id === selectedPlanId"
            :aria-labelledby="`${dialogId}-name-${plan.id}`"
            :aria-describedby="`${dialogId}-price-${plan.id}`"
            :tabindex="plan.id === selectedPlanId ? 0 : -1"
            :disabled="busy || loading"
            @click="selectPlan(plan)"
            @keydown="onPlanKeydown($event, plan.id)"
          />
          <header class="upgrade__card-head">
            <div class="upgrade__card-title">
              <AppIcon
                class="upgrade__card-icon"
                :icon="
                  planTier(plan) === 'free'
                    ? UserIcon
                    : planTier(plan) === 'team'
                      ? TeamWorkIcon
                      : Layers01Icon
                "
                :size="24"
              />
              <h3
                :id="`${dialogId}-name-${plan.id}`"
                class="upgrade__card-name"
              >
                {{ plan.name }}
              </h3>
            </div>
            <p
              v-if="plan.description"
              class="upgrade__plan-desc"
            >
              {{ plan.description }}
            </p>
            <t-tag
              v-if="plan.id === orgStore.currentPlan?.id"
              class="upgrade__current beacon-plan-badge"
              :theme="planTagTheme(plan)"
              variant="light"
            >
              {{ t('usage.upgrade.currentPlan') }}
            </t-tag>
          </header>
          <ul class="upgrade__abilities">
            <li
              v-for="ability in abilities(plan)"
              :key="ability.key"
              class="upgrade__ability"
            >
              <AppIcon
                class="upgrade__ability-icon"
                :class="{ 'is-unavailable': !ability.allowed }"
                :icon="ability.allowed ? CheckmarkCircle02Icon : Cancel01Icon"
                :size="16"
              />
              <span>{{ ability.label }}</span>
              <strong>{{ ability.value }}</strong>
            </li>
          </ul>
          <div
            :id="`${dialogId}-price-${plan.id}`"
            class="upgrade__price"
          >
            <strong>{{ displayPrice(plan) }}</strong>
            <template v-if="plan.code.trim().toUpperCase() !== 'FREE'">
              <span class="upgrade__price-from">{{
                t('usage.upgrade.priceFrom')
              }}</span>
              <span v-if="displayCycle(plan)">/ {{ displayCycle(plan) }}</span>
            </template>
            <span v-else>{{ t('usage.package.freeBadge') }}</span>
          </div>
          <span
            v-if="plan.id === selectedPlanId"
            class="upgrade__selected"
            aria-hidden="true"
          >
            <AppIcon
              :icon="CheckmarkCircle02Icon"
              :size="14"
            />
          </span>
        </article>
      </div>

      <div
        v-if="selectedPlan"
        class="upgrade__form"
      >
        <div class="upgrade__form-row">
          <span
            :id="`${dialogId}-cycle-label`"
            class="upgrade__form-label"
          >
            {{ t('usage.upgrade.cycle') }}
          </span>
          <div class="upgrade__cycle">
            <t-alert
              v-if="!selectedTerms.length"
              theme="warning"
              :message="t('usage.upgrade.cycleEmpty')"
            />
            <template v-else>
              <p
                class="upgrade__selection"
                aria-live="polite"
              >
                {{
                  t('usage.upgrade.selectedTerm', {
                    cycle: selectedTerm
                      ? t(planCycleLabelKey(selectedTerm.cycle))
                      : '',
                    days: selectedTerm?.durationDays ?? 0,
                  })
                }}
              </p>
              <t-radio-group
                v-if="selectedTerms.length > 1"
                v-model="selectedCycle"
                class="upgrade__cycle-options"
                variant="outline"
                :disabled="busy || loading"
                :aria-labelledby="`${dialogId}-cycle-label`"
              >
                <t-radio-button
                  v-for="term in selectedTerms"
                  :key="term.cycle"
                  :value="term.cycle"
                >
                  <span class="upgrade__cycle-name">{{
                    t(planCycleLabelKey(term.cycle))
                  }}</span>
                  <span class="upgrade__cycle-price">{{
                    formatAmount(term.price)
                  }}</span>
                </t-radio-button>
              </t-radio-group>
              <ul
                v-if="selectedTerm && selectedTerms.length > 1"
                class="upgrade__cycle-meta"
              >
                <li>
                  {{
                    t('usage.upgrade.termDays', {
                      days: selectedTerm.durationDays,
                    })
                  }}
                </li>
                <li>
                  {{
                    t('usage.upgrade.termMonthly', {
                      price: monthlyHint(selectedTerm),
                    })
                  }}
                </li>
              </ul>
            </template>
          </div>
        </div>

        <div class="upgrade__form-row upgrade__amount-row">
          <span class="upgrade__form-label">{{
            t('usage.upgrade.total')
          }}</span>
          <div class="upgrade__amount">
            <strong
              class="upgrade__total"
              aria-live="polite"
              >{{ total }}</strong
            >
            <span class="upgrade__note">{{
              t('usage.upgrade.amountNote')
            }}</span>
          </div>
        </div>
      </div>

      <div
        v-else
        class="upgrade__empty"
        role="status"
      >
        <AppIcon
          :icon="Layers01Icon"
          :size="32"
        />
        <p>
          {{ t(loading ? 'usage.upgrade.loading' : 'usage.upgrade.empty') }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="upgrade__buttons">
        <t-button
          variant="outline"
          :disabled="busy"
          @click="visible = false"
        >
          {{ t('common.cancel') }}
        </t-button>
        <t-button
          theme="primary"
          :loading="busy"
          :disabled="!canSubmit"
          @click="submit"
        >
          <template #icon>
            <AppIcon
              :icon="FlashIcon"
              :size="16"
            />
          </template>
          {{ submitText }}
        </t-button>
      </div>
    </template>
  </t-dialog>
</template>

<style lang="less">
.t-dialog__ctx .t-dialog__position:has(.upgrade-dialog) {
  padding: 16px 0;
}

.upgrade-dialog {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 32px);
  padding: 20px;
  overflow: hidden;
  background-color: @beacon-bg-page;

  .t-dialog__header {
    flex: none;
    padding-right: 32px;
    font-size: @beacon-font-size-section;
  }

  .t-dialog__body {
    min-height: 0;
    padding: 16px 0 0;
    overflow-y: auto;
  }

  .t-dialog__footer {
    flex: none;
    padding: 20px;
    margin: 0;
    background-color: @beacon-bg-container;
  }

  @media (max-width: 600px) {
    padding: 16px;

    .t-dialog__footer {
      padding: 16px;
    }
  }
}
</style>

<style scoped lang="less">
.upgrade {
  &__desc {
    margin: 0 0 20px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
  }

  &__content {
    min-height: 160px;
  }

  &__plans {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: 16px;
  }

  &__card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border-strong;
    border-radius: @beacon-radius-m;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:has(.upgrade__plan-select:hover:not(:disabled)) {
      border-color: @beacon-brand;
    }

    &.is-active {
      border-color: @beacon-brand;
      box-shadow: 0 0 0 1px @beacon-brand;
    }

    &:has(.upgrade__plan-select:focus-visible) {
      outline: 2px solid @beacon-brand;
      outline-offset: 3px;
    }
  }

  // 全卡可选，同时保留标题与权益的文档语义，避免将列表嵌入按钮。
  &__plan-select {
    position: absolute;
    z-index: 1;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: inherit;

    &:focus-visible {
      outline: none;
    }

    &:disabled {
      cursor: not-allowed;
    }
  }

  &__card-head {
    min-height: 136px;
    padding: 20px 16px 16px;
    background-color: var(--beacon-plan-bg);
    background-image: linear-gradient(
      180deg,
      var(--beacon-plan-bg),
      @beacon-bg-container
    );
  }

  &__card-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__card-icon {
    flex: none;
    color: var(--beacon-plan-color);
  }

  &__card-name {
    min-width: 0;
    margin: 0;
    font-size: 18px;
    font-weight: @beacon-font-weight-medium;
    line-height: 26px;
    color: var(--beacon-plan-color);
    overflow-wrap: anywhere;
  }

  &__plan-desc {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 20px;
    color: var(--beacon-plan-color);
    overflow-wrap: anywhere;
  }

  &__current {
    margin-top: 10px;
  }

  &__abilities {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    padding: 16px 16px 24px;
  }

  &__ability {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    align-items: start;
    gap: 6px;
    font-size: 12px;
    line-height: 20px;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;

    strong {
      max-width: 80px;
      font-weight: @beacon-font-weight-medium;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  }

  &__ability-icon {
    margin-top: 2px;
    color: @beacon-success;

    &.is-unavailable {
      color: @beacon-text-secondary;
    }
  }

  &__price {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    min-height: 72px;
    padding: 16px 24px 16px 16px;
    color: @beacon-text-secondary;
    border-top: 1px solid @beacon-border;

    strong {
      font-size: 24px;
      font-weight: 500;
      line-height: 36px;
      color: @beacon-warning;
      font-variant-numeric: tabular-nums;
    }
  }

  &__selected {
    position: absolute;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    width: 28px;
    height: 28px;
    padding: 2px;
    color: #fff;
    pointer-events: none;
    background-color: @beacon-brand;
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px 0;
  }

  &__form-row {
    display: grid;
    grid-template-columns: 80px minmax(0, 1fr);
    gap: 16px;
  }

  &__form-label {
    padding-top: 2px;
    font-size: @beacon-font-size-base;
    line-height: 22px;
    color: @beacon-text-secondary;
  }

  &__price-from {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__cycle {
    min-width: 0;
  }

  &__selection {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    line-height: 22px;
    color: @beacon-text-primary;
  }

  &__cycle-options {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    height: auto;

    :deep(.t-radio-button) {
      display: flex;
      flex: 1;
      justify-content: center;
      min-width: 96px;
      min-height: 36px;
    }
  }

  &__cycle-name {
    font-weight: 500;
  }

  &__cycle-price {
    margin-left: 6px;
    font-variant-numeric: tabular-nums;
  }

  &__cycle-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    padding: 0;
    margin: 12px 0 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    list-style: none;
  }

  &__amount-row {
    align-items: center;
  }

  &__amount {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }

  &__total {
    font-size: 24px;
    font-weight: 500;
    line-height: 32px;
    color: @beacon-warning;
    font-variant-numeric: tabular-nums;
  }

  &__note {
    flex: 1 1 240px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    padding: 24px;
    color: @beacon-text-secondary;
    background-color: @beacon-bg-container;
  }

  &__buttons {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;

    :deep(.t-button) {
      min-width: 108px;
    }
  }

  @media (max-width: 600px) {
    &__desc {
      margin-bottom: 16px;
    }

    &__plans {
      grid-template-columns: minmax(0, 1fr);
    }

    &__card-head {
      min-height: 0;
      padding: 16px;
    }

    &__abilities {
      gap: 10px;
    }

    &__ability,
    &__plan-desc {
      font-size: 14px;
      line-height: 22px;
    }

    &__form-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }

    &__cycle-options :deep(.t-radio-button) {
      min-height: 44px;
    }

    &__buttons :deep(.t-button) {
      min-height: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__card {
      transition: none;
    }
  }
}
</style>
