<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Plan, QuotaSummary } from '@/api/types/billing'
import AppIcon from '@/components/AppIcon.vue'
import { ArrowRight01Icon, CheckmarkCircle02Icon, FlashIcon } from '@/icons'
import {
  formatAmount,
  formatDate,
  cheapestTerm,
  planTier,
} from '@/utils/billing'

/**
 * 套餐用量页顶部的套餐信息卡（对齐 CloudBase 套餐卡）：
 * 左侧独立卡片展示当前套餐概况与核心额度，右侧并列「当前套餐能力」与「升级解锁更多能力」，
 * 更细的用量指标在其下方单独展示。
 */
defineOptions({ name: 'PackageInfoCard' })

const props = defineProps<{
  /** 生效套餐，无生效订阅时为 null（等同免费版） */
  plan: Plan | null
  /** 生效订阅的到期时间 */
  expiresAt: string | null
  /** 套餐目录（GET /plans），用于推算「升级解锁」的目标套餐 */
  plans?: Plan[]
  /** 当前套餐用量（用于左侧核心额度与进度条） */
  quota?: QuotaSummary | null
  loading?: boolean
}>()

const emit = defineEmits<{ upgrade: [] }>()

const { t } = useI18n()

const isFree = computed(() => !props.plan || props.plan.price <= 0)

const name = computed(() => props.plan?.name ?? t('usage.package.freePlan'))

const price = computed(() => {
  if (!props.plan || props.plan.price <= 0) return t('usage.package.free')
  // 订阅栈接口的 plan 不带 terms：price 是「最便宜启用档」的镜像，按「起」展示
  const term = cheapestTerm(props.plan)
  return t('usage.package.priceFrom', {
    price: formatAmount(props.plan.price),
    days: term?.durationDays ?? props.plan.durationDays,
  })
})

const validUntil = computed(() =>
  props.expiresAt
    ? `${t('usage.package.validUntil')} ${formatDate(props.expiresAt)}`
    : t('usage.package.noExpiry'),
)

/** 左侧核心额度：以监控项用量作为套餐额度概览 */
const monitorQuota = computed(() => props.quota?.resources.monitors ?? null)

/** 按 sortOrder 升序的套餐目录 */
const sortedPlans = computed(() =>
  [...(props.plans ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  ),
)

/** 升级目标：当前套餐之后的下一个套餐；已是最高的则无 */
const upgradePlan = computed(() => {
  const current = props.plan
  if (!current) return sortedPlans.value[0] ?? null
  return (
    sortedPlans.value.find((item) => item.sortOrder > current.sortOrder) ?? null
  )
})

function seconds(value: number) {
  return t('usage.package.seconds', { value })
}

function yesNo(value: boolean | undefined) {
  return value ? t('usage.package.allowed') : t('usage.package.notAllowed')
}

/** 当前套餐能力：数量上限 + 特性开关 */
const currentAbilities = computed(() => {
  const plan = props.plan
  return [
    `${t('usage.package.limit.monitors')} ${plan?.maxMonitors ?? 0}`,
    `${t('usage.package.limit.probes')} ${plan?.maxProbes ?? 0}`,
    `${t('usage.package.limit.members')} ${plan?.maxMembers ?? 0}`,
    `${t('usage.package.limit.channels')} ${plan?.maxChannels ?? 0}`,
    `${t('usage.package.minInterval')} ${seconds(plan?.minInterval ?? 0)}`,
    `${t('usage.package.feature.tenantProbe')} ${yesNo(plan?.allowTenantProbe)}`,
    `${t('usage.package.feature.statusPage')} ${yesNo(plan?.allowStatusPage)}`,
  ]
})

/** 升级特权：只列出相对当前套餐确有提升的项 */
const privileges = computed(() => {
  const next = upgradePlan.value
  if (!next) return []

  const current = props.plan
  const rows: string[] = []

  const limits = [
    {
      labelKey: 'usage.package.limit.monitors',
      from: current?.maxMonitors ?? 0,
      to: next.maxMonitors,
    },
    {
      labelKey: 'usage.package.limit.probes',
      from: current?.maxProbes ?? 0,
      to: next.maxProbes,
    },
    {
      labelKey: 'usage.package.limit.members',
      from: current?.maxMembers ?? 0,
      to: next.maxMembers,
    },
    {
      labelKey: 'usage.package.limit.channels',
      from: current?.maxChannels ?? 0,
      to: next.maxChannels,
    },
  ]
  limits.forEach(({ labelKey, from, to }) => {
    if (to > from) rows.push(`${t(labelKey)} ${from} → ${to}`)
  })

  // 检测间隔越小越好
  const fromInterval = current?.minInterval ?? 0
  if (fromInterval > next.minInterval) {
    rows.push(
      `${t('usage.package.minInterval')} ${seconds(fromInterval)} → ${seconds(next.minInterval)}`,
    )
  }

  const features = [
    {
      labelKey: 'usage.package.feature.tenantProbe',
      from: current?.allowTenantProbe,
      to: next.allowTenantProbe,
    },
    {
      labelKey: 'usage.package.feature.statusPage',
      from: current?.allowStatusPage,
      to: next.allowStatusPage,
    },
  ]
  features.forEach(({ labelKey, from, to }) => {
    if (!from && to) rows.push(`${t(labelKey)} ${yesNo(from)} → ${yesNo(to)}`)
  })

  return rows
})
</script>

<template>
  <div
    v-loading="loading"
    class="package"
  >
    <!-- 左侧：当前套餐概况 -->
    <div class="package__card">
      <div class="package__head">
        <span
          class="package__name beacon-plan-badge"
          :class="`beacon-plan--${planTier(plan)}`"
          >{{ name }}</span
        >
        <span
          v-if="isFree"
          class="package__badge beacon-plan-badge beacon-plan--free"
          >{{ t('usage.package.freeBadge') }}</span
        >
        <router-link
          class="package__billing"
          :to="{ name: 'billing-orders' }"
        >
          {{ t('usage.package.orders') }}
          <AppIcon
            :icon="ArrowRight01Icon"
            :size="14"
          />
        </router-link>
      </div>

      <div class="package__time">
        <span>{{ validUntil }}</span>
        <span class="package__divider" />
        <span class="package__price">{{ price }}</span>
      </div>

      <template v-if="monitorQuota">
        <div class="package__quota">
          <strong class="package__quota-label">{{
            t('usage.package.quotaLabel')
          }}</strong>
          <span class="package__quota-value">{{ monitorQuota.used }}</span>
          <span class="package__quota-total">/ {{ monitorQuota.limit }}</span>
        </div>

        <t-progress
          class="package__progress"
          theme="line"
          :percentage="monitorQuota.percent"
          :label="false"
        />
      </template>

      <p
        v-if="isFree"
        class="package__note"
      >
        {{ t('usage.package.noAutoRenew') }}
      </p>

      <div class="package__actions">
        <t-button
          theme="primary"
          size="small"
          :disabled="!upgradePlan"
          @click="emit('upgrade')"
        >
          <template #icon
            ><AppIcon
              :icon="FlashIcon"
              :size="14"
          /></template>
          {{ t('usage.package.upgrade') }}
        </t-button>
        <t-button
          variant="outline"
          size="small"
          @click="emit('upgrade')"
        >
          {{ t('usage.package.compare') }}
        </t-button>
      </div>
    </div>

    <!-- 右侧：当前能力 + 升级解锁 -->
    <div class="package__panels">
      <section class="package__block">
        <h3 class="package__block-title">
          {{ t('usage.package.currentTitle') }}
        </h3>
        <ul class="package__abilities">
          <li
            v-for="(item, index) in currentAbilities"
            :key="index"
          >
            <AppIcon
              class="package__ability-icon"
              :icon="CheckmarkCircle02Icon"
              :size="14"
            />
            <span>{{ item }}</span>
          </li>
        </ul>
      </section>

      <section class="package__block">
        <h3 class="package__block-title">
          {{ t('usage.package.nextTitle') }}
          <span
            v-if="upgradePlan"
            class="package__target beacon-plan-badge"
            :class="`beacon-plan--${planTier(upgradePlan)}`"
            >{{ upgradePlan.name }}</span
          >
        </h3>

        <ul
          v-if="privileges.length"
          class="package__abilities"
        >
          <li
            v-for="(item, index) in privileges"
            :key="index"
          >
            <AppIcon
              class="package__ability-icon is-upgrade"
              :icon="CheckmarkCircle02Icon"
              :size="14"
            />
            <span>{{ item }}</span>
          </li>
        </ul>

        <p
          v-else
          class="package__empty"
        >
          {{ t('usage.package.topPlan') }}
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="less">
.package {
  display: flex;
  gap: 32px;
  padding: 20px;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  // ---------- 左侧套餐卡片 ----------
  &__card {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 12px;
    width: 300px;
    padding: 16px;
    border: 1px solid @beacon-border;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__name {
    padding: 2px 8px;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    overflow-wrap: anywhere;
  }

  // 免费版徽标
  &__badge {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    font-weight: 400;
    line-height: 20px;
  }

  &__billing {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 2px;
    margin-left: auto;
    font-size: @beacon-font-size-base;
    font-weight: 400;
    color: @beacon-text-secondary;

    &:hover {
      color: @beacon-brand;
    }
  }

  &__time {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__divider {
    width: 1px;
    height: 12px;
    background-color: @beacon-border-strong;
  }

  &__price {
    color: @beacon-text-primary;
  }

  // 核心额度：大号数字
  &__quota {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }

  &__quota-label {
    font-weight: @beacon-font-weight-medium;
  }

  &__quota-value {
    font-size: 20px;
    line-height: 28px;
  }

  &__quota-total {
    color: @beacon-text-tertiary;
  }

  &__progress {
    margin: 0;
  }

  &__note {
    margin: 0;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-tertiary;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  // ---------- 右侧能力对比 ----------
  &__panels {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 32px;
    min-width: 0;
  }

  &__block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  &__block-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  // 升级目标套餐名
  &__target {
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    font-weight: 400;
    line-height: 20px;
  }

  // 能力列表：每条前面一个勾选图标
  &__abilities {
    display: flex;
    flex-direction: column;
    gap: 8px;

    li {
      display: flex;
      gap: 6px;
      font-size: @beacon-font-size-base;
      line-height: 20px;
      color: @beacon-text-secondary;
    }
  }

  &__ability-icon {
    flex: none;
    margin-top: 3px;
    color: @beacon-text-tertiary;

    // 升级提升项：品牌色
    &.is-upgrade {
      color: @beacon-brand;
    }
  }

  &__empty {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}
</style>
