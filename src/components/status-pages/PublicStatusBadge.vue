<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MonitorStatus } from '@/api/types'
import { monitorStatusTone } from '@/utils/status-page-presenter'

/**
 * 公开页的状态徽章：语义色圆点 + 文案。
 *
 * 比控制台内的状态标签更大更醒目（对外页面需要一眼看出结论），
 * 颜色全部走 TDesign 色阶令牌，明暗主题自动跟随；状态不只用颜色表达，
 * 文案始终保留（无障碍要求）。
 */
defineOptions({ name: 'PublicStatusBadge' })

const props = withDefaults(defineProps<{ status: MonitorStatus; size?: 'default' | 'large' }>(), {
  size: 'default',
})
const { t } = useI18n()
const tone = computed(() => monitorStatusTone(props.status))
</script>

<template>
  <span class="status-badge" :class="[`status-badge--${tone}`, `status-badge--${size}`]">
    <span class="status-badge__dot" aria-hidden="true" />
    <span class="status-badge__text">{{ t(`workspace.monitor.status.${status}`) }}</span>
  </span>
</template>

<style scoped lang="less">
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: @beacon-font-size-base;
  font-weight: 500;
  white-space: nowrap;

  &--success {
    color: var(--td-success-color);
    background: var(--td-success-color-1);
  }

  &--warning {
    color: var(--td-warning-color);
    background: var(--td-warning-color-1);
  }

  &--danger {
    color: var(--td-error-color);
    background: var(--td-error-color-1);
  }

  &--neutral {
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &--large {
    gap: 8px;
    padding: 6px 14px;
    font-size: 14px;
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  &--large &__dot {
    width: 8px;
    height: 8px;
  }
}
</style>
