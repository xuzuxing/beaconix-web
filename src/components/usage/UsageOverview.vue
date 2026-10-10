<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { packageSummary, usageGroups } from '@/config/usage'
import { RefreshIcon } from '@/icons'

import UsageGroupCard from './UsageGroupCard.vue'

/** 功能用量概览：工具栏 + 各功能分组用量卡片 */
defineOptions({ name: 'UsageOverview' })

const { t } = useI18n()

const summary = packageSummary

/** 按量付费开关与周期选择目前为占位，接入计费接口后回填 */
const payAsYouGo = ref(false)
const period = ref('current')

const periodOptions = computed(() => [
  { label: t('usage.overview.period'), value: 'current' },
])
</script>

<template>
  <div class="usage-overview">
    <div class="usage-overview__head">
      <div class="usage-overview__titles">
        <h3 class="usage-overview__title">{{ t('usage.overview.title') }}</h3>
        <span class="usage-overview__cost">
          {{ t('usage.overview.cost', { value: summary.usedPoints }) }}
        </span>
      </div>

      <div class="usage-overview__actions">
        <label class="usage-overview__pay">
          {{ t('usage.overview.payAsYouGo') }}
          <t-switch v-model="payAsYouGo" size="small" />
        </label>

        <t-select v-model="period" class="usage-overview__period" :options="periodOptions" size="small" />

        <span class="usage-overview__range">
          {{ summary.periodStart }}
          <span class="usage-overview__sep">{{ t('usage.overview.periodTo') }}</span>
          {{ summary.periodEnd }}
        </span>

        <button type="button" class="usage-overview__refresh" :aria-label="t('usage.overview.refresh')">
          <AppIcon :icon="RefreshIcon" />
        </button>
      </div>
    </div>

    <div class="usage-overview__list">
      <UsageGroupCard v-for="group in usageGroups" :key="group.key" :group="group" />
    </div>
  </div>
</template>

<style scoped lang="less">
.usage-overview {
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

  &__titles {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__cost {
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 16px;
  }

  &__pay {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }

  &__period {
    width: 140px;
  }

  &__range {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__sep {
    margin: 0 4px;
    color: @beacon-text-tertiary;
  }

  &__refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
  }

  // 分组卡片之间留出间距，形成「概览卡内嵌套分组卡」的层级
  &__list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
