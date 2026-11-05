<script setup lang="ts">
/**
 * RUM 指标卡片行：与云监控的 MonitorKpiGrid 保持同一套视觉
 * （容器底 + 1px 边框 + 24px 数值 + 次要色说明），只是数据来源不同。
 */
defineOptions({ name: 'RumKpiGrid' })

export interface RumKpi {
  key: string
  label: string
  value?: number | string | null
  hint?: string
  tone?: 'success' | 'warning' | 'error'
}

defineProps<{ items: RumKpi[] }>()
</script>

<template>
  <div class="kpi-grid">
    <div
      v-for="item in items"
      :key="item.key"
      class="kpi"
    >
      <div class="kpi__head">
        <span class="kpi__label">{{ item.label }}</span>
      </div>
      <div class="kpi__row">
        <span
          class="kpi__value"
          :class="item.tone ? `kpi__value--${item.tone}` : ''"
        >
          {{ item.value ?? '—' }}
        </span>
      </div>
      <small class="kpi__hint">{{ item.hint }}</small>
    </div>
  </div>
</template>

<style scoped lang="less">
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: @beacon-gap-l;
}

.kpi {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 14px 16px;
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

  &__row {
    display: flex;
    flex: 1;
    align-items: flex-start;
  }

  &__value {
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
    color: @beacon-text-primary;
    font-variant-numeric: tabular-nums;

    &--success {
      color: @beacon-success;
    }

    &--warning {
      color: @beacon-warning;
    }

    &--error {
      color: @beacon-error;
    }
  }

  &__hint {
    display: block;
    min-height: @beacon-line-height;
    margin-top: 4px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}
</style>
