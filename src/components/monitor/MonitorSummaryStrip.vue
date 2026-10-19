<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import {
  Clock01Icon,
  Link01Icon,
  Notification03Icon,
  SecurityCheckIcon,
} from '@/icons'
import type { Summary } from '@/api/types/monitoring'

/**
 * 监控状态条：监控项状态分布、探针在线、待处理告警、证书到期。
 */
defineOptions({ name: 'MonitorSummaryStrip' })

const { t } = useI18n()
const props = defineProps<{ summary: Summary }>()
const monitorSummary = computed(() => ({
  ...props.summary.monitors,
  probes: props.summary.probes,
  alerting: props.summary.alertingCount,
  sslExpiring: props.summary.sslExpiringCount,
}))

const statuses = computed(() => [
  { key: 'up', count: monitorSummary.value.up, tone: 'success' as const },
  { key: 'down', count: monitorSummary.value.down, tone: 'error' as const },
  {
    key: 'degraded',
    count: monitorSummary.value.degraded,
    tone: 'warning' as const,
  },
  {
    key: 'paused',
    count: monitorSummary.value.paused,
    tone: 'default' as const,
  },
  {
    key: 'unknown',
    count: monitorSummary.value.unknown,
    tone: 'default' as const,
  },
])

const certificates = computed(() => props.summary.expiringCertificates)
</script>

<template>
  <div class="strip">
    <div class="strip__block">
      <span class="strip__label">{{ t('dashboard.summary.monitors') }}</span>
      <span class="strip__value">{{ monitorSummary.total }}</span>
      <span class="strip__statuses">
        <span
          v-for="status in statuses"
          :key="status.key"
          class="strip__status"
        >
          <i
            class="strip__dot"
            :class="`strip__dot--${status.tone}`"
          ></i>
          {{ t(`dashboard.summary.status.${status.key}`) }}
          <b>{{ status.count }}</b>
        </span>
      </span>
    </div>

    <div class="strip__block strip__block--narrow">
      <span class="strip__label">
        <AppIcon
          :icon="Link01Icon"
          :size="14"
        />
        {{ t('dashboard.summary.probes') }}
      </span>
      <span class="strip__value">
        {{ monitorSummary.probes.online
        }}<i>/{{ monitorSummary.probes.total }}</i>
      </span>
    </div>

    <div class="strip__block strip__block--narrow">
      <span class="strip__label">
        <AppIcon
          :icon="Notification03Icon"
          :size="14"
        />
        {{ t('dashboard.summary.alerting') }}
      </span>
      <span class="strip__value strip__value--error">{{
        monitorSummary.alerting
      }}</span>
    </div>

    <div class="strip__block strip__block--narrow">
      <span class="strip__label">
        <AppIcon
          :icon="Clock01Icon"
          :size="14"
        />
        {{ t('dashboard.summary.sslExpiring') }}
      </span>
      <span class="strip__value strip__value--warning">{{
        monitorSummary.sslExpiring
      }}</span>
    </div>

    <div class="strip__block strip__block--wide">
      <span class="strip__label">
        <AppIcon
          :icon="SecurityCheckIcon"
          :size="14"
        />
        {{ t('dashboard.summary.certificates') }}
      </span>
      <span class="strip__certs">
        <span
          v-for="item in certificates"
          :key="item.monitorId"
          class="strip__cert"
        >
          <span class="strip__cert-host">{{ item.host }}</span>
          <span class="strip__cert-days">
            {{ t('dashboard.summary.daysLeft', { days: item.daysLeft }) }}
          </span>
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped lang="less">
.strip {
  display: flex;
  align-items: stretch;
  gap: 0;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;
  flex-wrap: wrap;

  &__block {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 12px 16px;

    & + & {
      border-left: 1px solid @beacon-border;
    }

    &--narrow {
      flex: 1;
      min-width: 140px;
    }

    &--wide {
      flex: 1.4;
      min-width: 220px;
    }
  }

  &__label {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__value {
    flex: none;
    font-size: 20px;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;

    i {
      font-size: @beacon-font-size-base;
      font-style: normal;
      font-weight: 400;
      color: @beacon-text-tertiary;
    }

    &--error {
      color: @beacon-error;
    }

    &--warning {
      color: @beacon-warning;
    }
  }

  &__statuses {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    min-width: 0;
  }

  &__status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    white-space: nowrap;

    b {
      font-weight: @beacon-font-weight-medium;
      color: @beacon-text-primary;
    }
  }

  &__dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;

    &--success {
      background-color: @beacon-success;
    }

    &--error {
      background-color: @beacon-error;
    }

    &--warning {
      background-color: @beacon-warning;
    }

    &--default {
      background-color: @beacon-text-disabled;
    }
  }

  &__certs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    min-width: 0;
  }

  &__cert {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: @beacon-font-size-base;
  }

  &__cert-host {
    overflow: hidden;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__cert-days {
    flex: none;
    color: @beacon-warning;
  }

  @media (max-width: 700px) {
    &__block:first-child {
      flex: 1 0 100%;
      flex-wrap: wrap;
      border-bottom: 1px solid @beacon-border;
    }
    &__statuses {
      flex: 1 0 100%;
    }
    &__block--narrow {
      flex: 1 0 50%;
      min-width: 0;
      padding: 12px;
      gap: 8px;
    }
    &__block--wide {
      flex: 1 0 100%;
      min-width: 0;
      flex-wrap: wrap;
      border-top: 1px solid @beacon-border;
    }
  }
}
</style>
