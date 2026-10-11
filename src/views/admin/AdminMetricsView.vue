<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import AdminKpiGrid from '@/components/admin/AdminKpiGrid.vue'
import AdminSchedulerPanel from '@/components/admin/AdminSchedulerPanel.vue'
import { useAdminMetrics } from '@/composables/useAdminMetrics'
import { RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import {
  adminTenantTheme,
  formatCompactNumber,
  healthLevelTheme,
  schedulerHealthLevel,
} from '@/utils/admin-presenter'

/** 平台指标：整体用量、调度器健康度与逐租户用量。只读页面，仅 SUPER_ADMIN。 */
defineOptions({ name: 'AdminMetricsView' })

const { t } = useI18n()
const userStore = useUserStore()
const { overview, scheduler, tenantMetrics, loading, error, load } = useAdminMetrics()

const keyword = ref('')

const kpis = computed(() => {
  const data = overview.value
  if (!data) return []
  return [
    {
      key: 'tenants',
      label: t('adminPage.metrics.tenants'),
      value: String(data.tenants.total),
      hint: t('adminPage.metrics.tenantsDetail', {
        active: data.tenants.active,
        deleted: data.tenants.deleted,
      }),
    },
    { key: 'users', label: t('adminPage.metrics.users'), value: formatCompactNumber(data.users) },
    {
      key: 'projects',
      label: t('adminPage.metrics.projects'),
      value: formatCompactNumber(data.projects),
    },
    {
      key: 'monitors',
      label: t('adminPage.metrics.monitors'),
      value: formatCompactNumber(data.monitors.total),
      hint: t('adminPage.metrics.monitorsDetail', { enabled: data.monitors.enabled }),
    },
    {
      key: 'probes',
      label: t('adminPage.metrics.probes'),
      value: formatCompactNumber(data.probes.total),
      hint: t('adminPage.metrics.probesDetail', {
        tenant: data.probes.tenant,
        system: data.probes.system,
      }),
    },
    {
      key: 'checks',
      label: t('adminPage.metrics.checkVolume'),
      value: formatCompactNumber(data.checkVolume),
    },
    {
      key: 'notifications',
      label: t('adminPage.metrics.notificationVolume'),
      value: formatCompactNumber(data.notificationVolume),
    },
    {
      key: 'statusPages',
      label: t('adminPage.metrics.statusPages'),
      value: formatCompactNumber(data.statusPages),
    },
    {
      key: 'systemProbeUsage',
      label: t('adminPage.metrics.systemProbeUsage'),
      value: formatCompactNumber(data.systemProbeUsage),
    },
  ]
})

const healthLevel = computed(() => (scheduler.value ? schedulerHealthLevel(scheduler.value) : null))

const healthTag = computed(() => {
  if (!healthLevel.value) return null
  return {
    theme: healthLevelTheme(healthLevel.value),
    label: t(`adminPage.metrics.schedulerLevel.${healthLevel.value}`),
  }
})

/** 逐租户用量：接口不分页，关键词在前端过滤 */
const tenantRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return tenantMetrics.value
  return tenantMetrics.value.filter((row) =>
    [row.name, row.slug, row.organizationId]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(kw)),
  )
})

onMounted(() => {
  if (userStore.isSuperAdmin) void load()
})
</script>

<template>
  <section class="admin-metrics">
    <HeaderActions>
      <t-tooltip :content="t('adminPage.metrics.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!userStore.isSuperAdmin"
          :aria-label="t('adminPage.metrics.refresh')"
          @click="load"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
    </HeaderActions>

    <t-alert v-if="!userStore.isSuperAdmin" theme="info" :message="t('adminPage.common.noPermission')" />

    <t-alert v-else-if="error" theme="error" :message="error">
      <template #operation>
        <t-button variant="outline" size="small" @click="load">
          {{ t('adminPage.common.refresh') }}
        </t-button>
      </template>
    </t-alert>

    <t-loading v-else-if="loading && !overview" :text="t('common.loading')" />

    <template v-else-if="overview">
      <t-card class="admin-metrics__panel">
        <template #title>{{ t('adminPage.metrics.overviewTitle') }}</template>
        <template #actions>
          <span class="admin-metrics__caption">{{ t('adminPage.metrics.overviewSubtitle') }}</span>
        </template>
        <AdminKpiGrid :items="kpis" />
      </t-card>

      <t-card v-if="scheduler" class="admin-metrics__panel">
        <template #title>{{ t('adminPage.metrics.schedulerTitle') }}</template>
        <template #actions>
          <t-tag v-if="healthTag" size="small" variant="light" :theme="healthTag.theme">
            {{ healthTag.label }}
          </t-tag>
        </template>
        <p class="admin-metrics__subtitle">{{ t('adminPage.metrics.schedulerSubtitle') }}</p>
        <AdminSchedulerPanel :health="scheduler" />
      </t-card>

      <t-card class="admin-metrics__panel">
        <template #title>{{ t('adminPage.metrics.tenantTitle') }}</template>
        <p class="admin-metrics__subtitle">{{ t('adminPage.metrics.tenantSubtitle') }}</p>

        <t-input
          v-model="keyword"
          class="admin-metrics__search"
          clearable
          :placeholder="t('adminPage.metrics.tenantSearch')"
          :aria-label="t('adminPage.metrics.tenantSearch')"
        />

        <div v-if="tenantRows.length" class="admin-metrics__table">
          <div class="admin-metrics__table-head">
            <span>{{ t('adminPage.metrics.organization') }}</span>
            <span>{{ t('adminPage.common.status') }}</span>
            <span>{{ t('adminPage.metrics.monitorCount') }}</span>
            <span>{{ t('adminPage.metrics.enabledMonitorCount') }}</span>
            <span>{{ t('adminPage.metrics.tenantProbeCount') }}</span>
            <span>{{ t('adminPage.metrics.tenantSystemProbeUsage') }}</span>
            <span>{{ t('adminPage.metrics.checkVolume') }}</span>
            <span>{{ t('adminPage.metrics.notificationVolume') }}</span>
            <span>{{ t('adminPage.metrics.statusPageCount') }}</span>
          </div>
          <div v-for="row in tenantRows" :key="row.organizationId" class="admin-metrics__row">
            <span class="admin-metrics__tenant">
              <span class="admin-metrics__tenant-name">{{ row.name }}</span>
              <span class="admin-metrics__tenant-slug">{{ row.slug }}</span>
            </span>
            <span>
              <t-tag
                size="small"
                variant="light"
                :theme="adminTenantTheme(row.active ? 'active' : 'deleted')"
              >
                {{
                  row.active
                    ? t('adminPage.tenant.stateActive')
                    : t('adminPage.tenant.stateDeleted')
                }}
              </t-tag>
            </span>
            <span>{{ row.monitorCount }}</span>
            <span>{{ row.enabledMonitorCount }}</span>
            <span>{{ row.tenantProbeCount }}</span>
            <span>{{ row.systemProbeUsage }}</span>
            <span>{{ formatCompactNumber(row.checkVolume) }}</span>
            <span>{{ formatCompactNumber(row.notificationVolume) }}</span>
            <span>{{ row.statusPageCount }}</span>
          </div>
        </div>

        <p v-else class="admin-metrics__empty">
          {{
            tenantMetrics.length ? t('adminPage.common.noMatches') : t('adminPage.common.empty')
          }}
        </p>
      </t-card>
    </template>

    <div v-else-if="userStore.isSuperAdmin" class="admin-metrics__empty-state">
      <p class="admin-metrics__empty">{{ t('adminPage.common.empty') }}</p>
    </div>
  </section>
</template>

<style scoped lang="less">
.admin-metrics {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__caption,
  &__subtitle {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 16px;
  }

  &__search {
    max-width: 360px;
    margin-bottom: 16px;
  }

  &__table {
    overflow-x: auto;
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns: minmax(180px, 1.4fr) 96px repeat(3, 96px) 110px repeat(3, 100px);
    gap: 12px;
    align-items: center;
    min-width: 1080px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__tenant {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__tenant-name {
    overflow: hidden;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tenant-slug {
    overflow: hidden;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__empty,
  &__empty-state {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
  }
}
</style>
