<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorStatus } from '@/api/types'
import type { MonitorRange } from '@/api/types/monitoring'
import MetricChartCard from '@/components/overview/MetricChartCard.vue'
import MonitorKpiGrid from '@/components/monitor/MonitorKpiGrid.vue'
import { useMonitorList } from '@/composables/useMonitorList'
import { useMonitorRuntime } from '@/composables/useMonitorRuntime'
import { useMonitoringDashboard } from '@/composables/useMonitoringDashboard'
import { useOrganizationStore } from '@/stores'
import { adaptKpis, adaptTimeline } from '@/utils/monitoring-adapter'
import { summarizeMonitors } from '@/utils/monitor-presenter'

/**
 * 云监控 → 概览：监控项状态分布 + 核心指标 + 数据概览。
 * 顶部状态统计只承担导航职责（点击跳到监控管理并带筛选），
 * 时间范围只作用于核心指标与数据概览。
 */
defineOptions({ name: 'MonitorOverviewView' })

const { t } = useI18n()
const org = useOrganizationStore()
const { now } = useMonitorRuntime()
const projectId = computed(() => org.currentProjectId)
const {
  monitors,
  loading: monitorsLoading,
  error: monitorsError,
  load: loadMonitors,
} = useMonitorList(projectId)

const range = ref<MonitorRange>('1h')
const tz = ref(
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
)
const RANGE_OPTIONS = [
  { value: '1h', labelKey: 'dashboard.range.h1' },
  { value: 'today', labelKey: 'dashboard.range.today' },
  { value: '7d', labelKey: 'dashboard.range.d7' },
  { value: '30d', labelKey: 'dashboard.range.d30' },
] as const
// 概览只消费大盘数据，可用性与状态码按需再加
const {
  dashboard,
  loading: dashboardLoading,
  error: dashboardError,
  refresh,
} = useMonitoringDashboard(projectId, range, tz, { withAvailability: false })

const kpis = computed(() =>
  dashboard.value ? adaptKpis(dashboard.value) : undefined,
)
const timeline = computed(() =>
  dashboard.value ? adaptTimeline(dashboard.value) : undefined,
)
/** 数据概览：轻量 SVG 指标卡（检查次数、失败检查、平均耗时、可用率） */
const metrics = computed(() => {
  const series = timeline.value
  if (!series) return []
  return [
    {
      key: 'checks',
      title: t('dashboard.dataOverview.checks'),
      tip: t('dashboard.dataOverview.checksTip'),
      values: series.checks,
      labels: series.labels,
    },
    {
      key: 'failures',
      title: t('dashboard.dataOverview.failures'),
      tip: t('dashboard.dataOverview.failuresTip'),
      values: series.failures,
      labels: series.labels,
    },
    {
      key: 'latency',
      title: t('dashboard.dataOverview.latency'),
      values: series.avgLatency,
      labels: series.labels,
    },
    {
      key: 'availability',
      title: t('dashboard.dataOverview.availability'),
      values: series.availability,
      labels: series.labels,
      autoScale: true,
    },
  ]
})
const retry = () => {
  void loadMonitors()
  refresh()
}

const statuses: MonitorStatus[] = [
  'UP',
  'DOWN',
  'DEGRADED',
  'PAUSED',
  'UNKNOWN',
]
const summary = computed(() =>
  summarizeMonitors(monitors.value, now.value.getTime()),
)
const items = computed(() => [
  {
    key: 'all',
    label: t('monitorPage.total'),
    value: summary.value.total,
    status: undefined,
  },
  ...statuses.map((status) => ({
    key: status,
    label: t(`workspace.monitor.status.${status}`),
    value: summary.value[status],
    status,
  })),
])
const target = (status?: MonitorStatus) => ({
  name: 'monitor',
  query: status ? { status } : {},
})
</script>

<template>
  <section class="monitor-overview">
    <t-card class="monitor-overview__card">
      <template #title>{{ t('monitorPage.statusOverview') }}</template>
      <template #actions>
        <span class="monitor-overview__scope">
          {{ org.currentOrganization?.name ?? '-' }} /
          {{ org.currentProject?.name ?? '-' }}
        </span>
      </template>

      <div
        v-if="monitorsError"
        class="monitor-overview__state"
      >
        <t-alert
          theme="error"
          :message="monitorsError"
        />
        <t-button @click="loadMonitors">{{ t('monitorPage.retry') }}</t-button>
      </div>
      <div
        v-else-if="monitorsLoading"
        class="monitor-overview__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>
      <div
        v-else-if="!projectId"
        class="monitor-overview__state"
      >
        {{ t('monitorPage.noProjectData') }}
      </div>
      <div
        v-else
        class="monitor-overview__grid"
      >
        <RouterLink
          v-for="item in items"
          :key="item.key"
          class="monitor-overview__cell"
          :to="target(item.status)"
        >
          <span class="monitor-overview__label">{{ item.label }}</span>
          <strong
            class="monitor-overview__value"
            :class="`monitor-overview__value--${item.key.toLowerCase()}`"
          >
            {{ item.value }}
          </strong>
        </RouterLink>
      </div>
    </t-card>

    <t-card
      v-if="dashboardError"
      class="monitor-overview__card"
    >
      <div class="monitor-overview__state">
        <t-alert
          theme="error"
          :message="dashboardError"
        />
        <t-button @click="retry">{{ t('monitorPage.retry') }}</t-button>
      </div>
    </t-card>
    <t-card
      v-else-if="dashboardLoading"
      class="monitor-overview__card"
    >
      <div class="monitor-overview__state">
        <t-loading :text="t('common.loading')" />
      </div>
    </t-card>
    <template v-else-if="dashboard">
      <section class="monitor-overview__section">
        <div class="monitor-overview__section-head">
          <h3 class="monitor-overview__section-title">
            {{ t('dashboard.section.kpi') }}
          </h3>
          <t-radio-group
            v-model="range"
            variant="default-filled"
            size="small"
          >
            <t-radio-button
              v-for="option in RANGE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ t(option.labelKey) }}
            </t-radio-button>
          </t-radio-group>
        </div>
        <MonitorKpiGrid
          v-if="kpis"
          :kpis="kpis"
        />
      </section>

      <section class="monitor-overview__section">
        <div class="monitor-overview__section-head">
          <h3 class="monitor-overview__section-title">
            {{ t('dashboard.section.dataOverview') }}
          </h3>
        </div>
        <div class="monitor-overview__charts">
          <MetricChartCard
            v-for="metric in metrics"
            :key="metric.key"
            :title="metric.title"
            :tip="metric.tip"
            :values="metric.values"
            :labels="metric.labels"
            :auto-scale="metric.autoScale"
          />
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped lang="less">
.monitor-overview {
  min-width: 0;

  &__card {
    margin-bottom: 16px;
  }

  &__scope {
    color: @beacon-text-secondary;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 160px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  // 状态格子只做导航，不再套一层边框，避免与卡片边框重复
  &__cell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 4px 0;
    color: @beacon-text-secondary;

    &:hover .monitor-overview__value {
      color: @beacon-brand;
    }
  }

  &__label {
    font-size: @beacon-font-size-base;
  }

  &__value {
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
    color: @beacon-text-primary;
    font-variant-numeric: tabular-nums;

    &--down {
      color: @beacon-error;
    }

    &--degraded {
      color: @beacon-warning;
    }
  }

  // 核心指标与数据概览：卡片自带白底与边框，这里只提供区块标题与网格
  &__section {
    display: flex;
    flex-direction: column;
    gap: @beacon-gap-l;
    margin-bottom: 16px;
  }

  &__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @beacon-gap-l;
    flex-wrap: wrap;
  }

  &__section-title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
  }

  &__charts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }
}

@media (max-width: 1200px) {
  .monitor-overview__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .monitor-overview__charts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .monitor-overview__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .monitor-overview__charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
