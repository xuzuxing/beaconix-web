<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotaResourceKey, QuotaSummary } from '@/api/types/billing'
import AppIcon from '@/components/AppIcon.vue'
import {
  Analytics01Icon,
  ApiIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Notification03Icon,
  ServerIcon,
  type IconData,
  TeamWorkIcon,
} from '@/icons'

/** 当前套餐的配额使用量 / 可用量：受管资源进度 + 特性开关 + 最小检测间隔 */
defineOptions({ name: 'QuotaUsageCard' })

const props = defineProps<{
  quota: QuotaSummary | null
  loading?: boolean
}>()

const { t } = useI18n()

const RESOURCE_ICONS: Record<QuotaResourceKey, IconData> = {
  monitors: Analytics01Icon,
  probes: ServerIcon,
  members: TeamWorkIcon,
  channels: Notification03Icon,
  apiKeys: ApiIcon,
}

const RESOURCE_KEYS: QuotaResourceKey[] = [
  'monitors',
  'probes',
  'members',
  'channels',
  'apiKeys',
]

/** 单项配额：已用 / 上限 / 剩余（上限为 0 表示套餐不包含该资源） */
const resources = computed(() =>
  RESOURCE_KEYS.map((key) => {
    const usage = props.quota?.resources[key]
    const used = usage?.used ?? 0
    const limit = usage?.limit ?? 0
    return {
      key,
      icon: RESOURCE_ICONS[key],
      used,
      limit,
      percent: usage?.percent ?? 0,
      remaining: Math.max(limit - used, 0),
      included: limit > 0,
    }
  }),
)

/** 用量接近或超出上限时切换进度条状态 */
function progressStatus(
  percent: number,
  included: boolean,
): 'active' | 'warning' | 'error' {
  if (!included) return 'active'
  if (percent >= 100) return 'error'
  if (percent >= 80) return 'warning'
  return 'active'
}

const features = computed(() => {
  const data = props.quota
  return [
    { key: 'tenantProbe', enabled: data?.features.allowTenantProbe ?? false },
    { key: 'statusPage', enabled: data?.features.allowStatusPage ?? false },
  ]
})
</script>

<template>
  <div
    v-loading="loading"
    class="quota"
  >
    <div class="quota__head">
      <h3 class="quota__title">{{ t('usage.quota.title') }}</h3>
      <span
        v-if="quota"
        class="quota__interval"
      >
        {{ t('usage.quota.minInterval', { value: quota.minInterval }) }}
      </span>
    </div>

    <div class="quota__grid">
      <div
        v-for="item in resources"
        :key="item.key"
        class="quota__item"
      >
        <div class="quota__item-head">
          <AppIcon
            class="quota__icon"
            :icon="item.icon"
          />
          <span class="quota__name">{{
            t(`usage.quota.resource.${item.key}`)
          }}</span>
          <span
            v-if="!item.included"
            class="quota__excluded"
          >
            {{ t('usage.quota.notIncluded') }}
          </span>
        </div>

        <div class="quota__value">
          <span class="quota__used">{{ item.used }}</span>
          <span class="quota__total">/ {{ item.limit }}</span>
        </div>

        <t-progress
          class="quota__progress"
          theme="line"
          :percentage="item.percent"
          :status="progressStatus(item.percent, item.included)"
          :label="false"
        />

        <span class="quota__remaining">
          {{ t('usage.quota.remaining', { value: item.remaining }) }}
        </span>
      </div>
    </div>

    <div class="quota__features">
      <div
        v-for="item in features"
        :key="item.key"
        class="quota__feature"
      >
        <AppIcon
          :icon="item.enabled ? CheckmarkCircle02Icon : Cancel01Icon"
          :size="14"
          :class="['quota__feature-icon', { 'is-off': !item.enabled }]"
        />
        <span :class="{ 'is-off': !item.enabled }">
          {{ t(`usage.quota.feature.${item.key}`) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.quota {
  padding: 20px;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__interval {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  // 资源卡片：自适应多列
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 16px;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }

  &__item-head {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__icon {
    flex: none;
    color: @beacon-text-secondary;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__excluded {
    flex: none;
    margin-left: auto;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  &__used {
    font-size: 20px;
    line-height: 28px;
    color: @beacon-text-primary;
  }

  &__total {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__progress {
    margin: 0;
  }

  &__remaining {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__features {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    border-top: 1px solid @beacon-border;
  }

  &__feature {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__feature-icon {
    color: @beacon-brand;
  }

  .is-off {
    color: @beacon-text-disabled;
  }
}
</style>
