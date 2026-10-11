<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getQuotaSummary, listPlans } from '@/api'
import type { Plan, QuotaSummary } from '@/api/types/billing'
import PackageInfoCard from '@/components/usage/PackageInfoCard.vue'
import QuotaUsageCard from '@/components/usage/QuotaUsageCard.vue'
import UpgradePlanDialog from '@/components/usage/UpgradePlanDialog.vue'
import { useOrganizationStore } from '@/stores'

/** 套餐用量页：顶部套餐概况与升级特权，下方才是用量指标，升级走弹窗 */
defineOptions({ name: 'UsageView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()

const orgId = computed(() => orgStore.currentOrganizationId)
const plans = ref<Plan[]>([])
const quota = ref<QuotaSummary | null>(null)
const loading = ref(false)
const upgradeVisible = ref(false)

/** 套餐来自 store（顶栏共用），套餐目录与用量单独拉取；切换团队时一并刷新 */
async function load() {
  const id = orgId.value
  if (!id) {
    plans.value = []
    quota.value = null
    return
  }

  loading.value = true
  try {
    const plansRequest = listPlans()
    const quotaRequest = getQuotaSummary(id)
    await orgStore.loadSubscription(id)
    plans.value = await plansRequest
    quota.value = await quotaRequest
  } finally {
    loading.value = false
  }
}

/** 升级成功：套餐已变更，重新拉取套餐与用量 */
function onPaid() {
  void load()
}

watch(orgId, load, { immediate: true })
</script>

<template>
  <div class="usage">
    <div class="usage__bar">
      <span class="usage__scope">{{ orgStore.currentOrganization?.name ?? '—' }}</span>
      <t-button variant="outline" size="small" :loading="loading" @click="load">
        {{ t('usage.refresh') }}
      </t-button>
    </div>

    <PackageInfoCard
      :plan="orgStore.currentPlan"
      :expires-at="orgStore.currentPlanExpiresAt"
      :plans="plans"
      :quota="quota"
      :loading="loading"
      @upgrade="upgradeVisible = true"
    />

    <QuotaUsageCard :quota="quota" :loading="loading" />

    <UpgradePlanDialog
      v-model:visible="upgradeVisible"
      :plans="plans"
      :loading="loading"
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
