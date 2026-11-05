<script setup lang="ts">
import { computed, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getQuotaSummary, listPlans } from '@/api'
import type { Order, Plan, QuotaSummary } from '@/api/types/billing'
import AlipayQrPayDialog from '@/components/billing/AlipayQrPayDialog.vue'
import PackageInfoCard from '@/components/usage/PackageInfoCard.vue'
import MonitorCapacityCard from '@/components/usage/MonitorCapacityCard.vue'
import QuotaUsageCard from '@/components/usage/QuotaUsageCard.vue'
import UpgradePlanDialog from '@/components/usage/UpgradePlanDialog.vue'
import { useOrganizationStore } from '@/stores'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { useRefreshOnActivate } from '@/composables/useRefreshOnActivate'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  sessionEpoch,
} from '@/utils/access-context'

/** 套餐用量页：顶部套餐概况与升级特权，下方才是用量指标，升级走弹窗 */
defineOptions({ name: 'UsageView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()
const { canManage } = useOrganizationRole()
const capacityCard = useTemplateRef('capacityCard')
const error = ref('')
let generation = 0
onScopeDispose(() => {
  generation++
})

const orgId = computed(() => orgStore.currentOrganizationId)
const plans = ref<Plan[]>([])
const quota = ref<QuotaSummary | null>(null)
const loading = ref(false)
const upgradeVisible = ref(false)
/** 下单完成、等待扫码支付的订单 */
const pendingOrder = ref<Order | null>(null)
const payVisible = ref(false)

/** 套餐来自 store（顶栏共用），套餐目录与用量单独拉取；切换团队时一并刷新 */
async function load() {
  const token = ++generation
  const context = accessContext()
  const id = orgId.value
  if (!id || !canManage.value) {
    plans.value = []
    quota.value = null
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  try {
    const [catalog, usage] = await Promise.all([
      listPlans(),
      getQuotaSummary(id),
      orgStore.loadSubscription(id),
    ])
    if (token !== generation || !isCurrentContext(context)) return
    plans.value = catalog
    quota.value = usage
  } catch (cause) {
    if (token === generation && isCurrentContext(context))
      error.value =
        cause instanceof Error ? cause.message : t('monitorCapacity.loadFailed')
  } finally {
    if (token === generation) loading.value = false
  }
}

/** 升级成功：套餐已变更，重新拉取套餐与用量 */
function onPaid() {
  pendingOrder.value = null
  void load()
  void capacityCard.value?.load()
}

function refresh() {
  void load()
  if (!capacityCard.value?.dirty && !capacityCard.value?.saving)
    void capacityCard.value?.load()
}
useRefreshOnActivate(refresh)

/** 下单完成：接管支付，用支付宝扫码弹窗完成付款 */
function onPay(order: Order) {
  pendingOrder.value = order
  payVisible.value = true
}

watch(
  [orgId, canManage, permissionEpoch, sessionEpoch],
  () => {
    plans.value = []
    quota.value = null
    pendingOrder.value = null
    payVisible.value = false
    upgradeVisible.value = false
    error.value = ''
    void load()
  },
  { immediate: true, flush: 'sync' },
)
</script>

<template>
  <div class="usage">
    <div class="usage__bar">
      <span class="usage__scope">{{
        orgStore.currentOrganization?.name ?? '—'
      }}</span>
      <t-button
        variant="outline"
        size="small"
        :loading="loading"
        @click="refresh"
      >
        {{ t('usage.refresh') }}
      </t-button>
    </div>

    <t-alert
      v-if="error"
      theme="error"
      :message="error"
    />

    <PackageInfoCard
      :plan="orgStore.currentPlan"
      :expires-at="orgStore.currentPlanExpiresAt"
      :plans="plans"
      :quota="quota"
      :loading="loading"
      @upgrade="upgradeVisible = true"
    />

    <MonitorCapacityCard
      ref="capacityCard"
      @upgrade="upgradeVisible = true"
    />

    <QuotaUsageCard
      :quota="quota"
      :loading="loading"
    />

    <UpgradePlanDialog
      v-model:visible="upgradeVisible"
      :plans="plans"
      :loading="loading"
      @pay="onPay"
    />

    <AlipayQrPayDialog
      v-model:visible="payVisible"
      :order="pendingOrder"
      @paid="onPaid"
    />
  </div>
</template>

<style scoped lang="less">
.usage {
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
}
</style>
