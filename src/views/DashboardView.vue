<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useOrganizationStore, useUserStore } from '@/stores'

/** 概览：当前团队 / 项目的落地页，监控概览在后续阶段接入 */
defineOptions({ name: 'DashboardView' })

const { t } = useI18n()
const userStore = useUserStore()
const orgStore = useOrganizationStore()

const displayName = computed(() => userStore.user?.name ?? '')
</script>

<template>
  <div class="dashboard">
    <h2 class="dashboard__title">{{ t('dashboard.welcome', { name: displayName }) }}</h2>
    <p class="dashboard__desc">{{ t('dashboard.desc') }}</p>

    <div class="dashboard__grid">
      <div class="dashboard__card">
        <span class="dashboard__label">{{ t('menu.team') }}</span>
        <span class="dashboard__value">{{ orgStore.currentOrganization?.name ?? '—' }}</span>
        <span class="dashboard__meta">{{ orgStore.currentOrganization?.slug ?? '' }}</span>
      </div>

      <div class="dashboard__card">
        <span class="dashboard__label">{{ t('menu.project') }}</span>
        <span class="dashboard__value">{{ orgStore.currentProject?.name ?? '—' }}</span>
        <span class="dashboard__meta">{{ orgStore.currentProject?.key ?? '' }}</span>
      </div>

      <div class="dashboard__card">
        <span class="dashboard__label">{{ t('menu.monitor') }}</span>
        <span class="dashboard__value">—</span>
        <span class="dashboard__meta">{{ t('workspace.monitor.pending') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__title {
    margin: 0;
    font-size: @beacon-font-size-title;
    font-weight: 700;
    line-height: 40px;
    color: @beacon-text-primary;
  }

  &__desc {
    margin: 0 0 24px;
    color: @beacon-text-secondary;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__label {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__value {
    overflow: hidden;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
