<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import MiniTrend from '@/components/charts/MiniTrend.vue'
import { ArrowDown01Icon, ArrowUp01Icon, InformationCircleIcon } from '@/icons'
import type { MonitorKpi } from '@/utils/monitoring-adapter'

/** 核心指标卡片行：数值 + 环比 + 迷你趋势 */
defineOptions({ name: 'MonitorKpiGrid' })

defineProps<{ kpis: MonitorKpi[] }>()

const { t } = useI18n()
</script>

<template>
  <div class="kpi-grid">
    <div v-for="kpi in kpis" :key="kpi.key" class="kpi">
      <div class="kpi__head">
        <span class="kpi__label">{{ t(kpi.labelKey) }}</span>
        <t-tooltip v-if="kpi.tipKey" :content="t(kpi.tipKey)" placement="top">
          <AppIcon class="kpi__tip" :icon="InformationCircleIcon" />
        </t-tooltip>
      </div>

      <div class="kpi__row">
        <span class="kpi__value">
          {{ kpi.value }}
          <span v-if="kpi.unitKey" class="kpi__unit">{{ t(kpi.unitKey) }}</span>
        </span>
        <span v-if="kpi.deltaText" class="kpi__delta" :class="kpi.good ? 'kpi__delta--good' : 'kpi__delta--bad'">
          <AppIcon :icon="kpi.deltaText.startsWith('-') ? ArrowDown01Icon : ArrowUp01Icon" :size="12" />
          {{ kpi.deltaText }}
        </span>
      </div>

      <div class="kpi__trend">
        <MiniTrend :values="kpi.trend" :tone="kpi.tone" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: @beacon-gap-l;
  @media (max-width: 1200px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (max-width: 600px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.kpi {
  display: flex;
  flex-direction: column;
  height: 116px;
  padding: 14px 16px 0;
  overflow: hidden;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  &__head {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
    margin-bottom: 8px;
  }

  &__label {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tip {
    color: @beacon-text-tertiary;
    cursor: help;
  }

  &__row {
    display: flex;
    flex: none;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__value {
    font-size: 24px;
    font-weight: @beacon-font-weight-medium;
    line-height: 30px;
    color: @beacon-text-primary;
  }

  &__unit {
    margin-left: 2px;
    font-size: @beacon-font-size-base;
    font-weight: 400;
    color: @beacon-text-secondary;
  }

  &__delta {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: @beacon-font-size-base;

    &--good {
      color: @beacon-success;
    }

    &--bad {
      color: @beacon-error;
    }
  }

  // 迷你趋势贴卡片底边，形成「指标 + 走向」的观感
  &__trend {
    flex: 1;
    min-height: 0;
    margin: 4px -16px 0;
  }
}
</style>
