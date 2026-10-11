<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MonitorAvailabilityPanel from '@/components/monitor/MonitorAvailabilityPanel.vue'
import MonitorDetailPanel from '@/components/monitor/MonitorDetailPanel.vue'
import MonitorDistributionCharts from '@/components/monitor/MonitorDistributionCharts.vue'
import MonitorKpiGrid from '@/components/monitor/MonitorKpiGrid.vue'
import MonitorSummaryStrip from '@/components/monitor/MonitorSummaryStrip.vue'
import MonitorTrendCharts from '@/components/monitor/MonitorTrendCharts.vue'
import MetricChartCard from '@/components/overview/MetricChartCard.vue'
import type { MonitorRange } from '@/api/types/monitoring'
import { useMonitoringDashboard } from '@/composables/useMonitoringDashboard'
import { adaptKpis, adaptTimeline } from '@/utils/monitoring-adapter'
import { useOrganizationStore, useUserStore } from '@/stores'
import { planTagTheme, planTier } from '@/utils/billing'

/**
 * 概览：当前团队 / 项目的监控大盘。
 * 按项目和参数加载服务端监控快照。
 */
defineOptions({ name: 'DashboardView' })

const { t } = useI18n()
const userStore = useUserStore()
const orgStore = useOrganizationStore()

const displayName = computed(() => userStore.user?.name ?? '')

/** 当前团队套餐标签：无生效订阅时回退为免费版文案 */
const planLabel = computed(() => orgStore.currentPlan?.name ?? t('usage.package.freePlan'))

// 顶栏通常已加载过套餐，这里只兜底补一次，避免重复请求
onMounted(() => {
  if (!orgStore.subscription) void orgStore.loadSubscription()
})
/** 当前时间范围，切换后时序与 KPI 同步重算 */
const range = ref<MonitorRange>('1h')

const tz = ref(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai')
const RANGE_OPTIONS = [
  { value: '1h', labelKey: 'dashboard.range.h1' },
  { value: 'today', labelKey: 'dashboard.range.today' },
  { value: '7d', labelKey: 'dashboard.range.d7' },
  { value: '30d', labelKey: 'dashboard.range.d30' },
]
const projectId = computed(() => orgStore.currentProjectId || undefined)
const { dashboard, availability, statusCodes, loading, error, refresh } = useMonitoringDashboard(projectId, range, tz)
const timeline = computed(() => dashboard.value ? adaptTimeline(dashboard.value) :
  { labels: [], checks: [], failures: [], avgLatency: [], latencyP50: [], latencyP95: [], latencyP99: [], availability: [] })
const kpis = computed(() => dashboard.value ? adaptKpis(dashboard.value) : [])
const updatedAt = computed(() => dashboard.value ? dashboard.value.asOf.replace('T', ' ').slice(0, 19) : '-')
const truncated = computed(() => dashboard.value && Object.entries(dashboard.value.history).some(([key, value]) =>
  /Current|current|Previous|previous/.test(key) && value === 'TRUNCATED'))

/** 轻量指标卡（纯 SVG 折线），与 echarts 图表混合使用 */
const svgMetrics = computed(() => [
  {
    key: 'checks',
    title: t('dashboard.dataOverview.checks'),
    tip: t('dashboard.dataOverview.checksTip'),
    values: timeline.value.checks,
    labels: timeline.value.labels,
  },
  {
    key: 'failures',
    title: t('dashboard.dataOverview.failures'),
    tip: t('dashboard.dataOverview.failuresTip'),
    values: timeline.value.failures,
    labels: timeline.value.labels,
  },
  {
    key: 'latency',
    title: t('dashboard.dataOverview.latency'),
    values: timeline.value.avgLatency,
    labels: timeline.value.labels,
  },
  {
    key: 'availability',
    title: t('dashboard.dataOverview.availability'),
    values: timeline.value.availability,
    labels: timeline.value.labels,
    autoScale: true,
  },
])
</script>

<template>
  <div class="dashboard">
    <!-- 头部：欢迎语 + 当前团队/项目 + 时间范围切换 -->
    <header class="dashboard__hero">
      <div class="dashboard__hero-main">
        <h2 class="dashboard__title">
          {{ t('dashboard.welcome', { name: displayName }) }}
        </h2>
        <p class="dashboard__desc">{{ t('dashboard.desc') }}</p>

        <div class="dashboard__scope">
          <t-tag variant="light-outline" size="small">
            {{ orgStore.currentOrganization?.name ?? t('dashboard.scope.noOrg') }}
          </t-tag>
          <t-tag class="beacon-plan-badge" :class="`beacon-plan--${planTier(orgStore.currentPlan)}`"
            :theme="planTagTheme(orgStore.currentPlan)" variant="light" size="small">
            {{ planLabel }}
          </t-tag>
          <t-tag variant="light-outline" size="small">
            {{ orgStore.currentProject?.name ?? t('dashboard.scope.noProject') }}
          </t-tag>
          <span class="dashboard__updated">
            {{ t('dashboard.updatedAt', { time: updatedAt }) }}
          </span>
        </div>
      </div>

      <div class="dashboard__range">
        <t-select v-model="tz" :options="['Asia/Shanghai', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', tz].filter((v, i, a) => a.indexOf(v) === i).map(value => ({ label: value, value }))" aria-label="Time zone" style="width: 184px" />
        <span class="dashboard__range-label">{{ t('dashboard.range.label') }}</span>
        <t-radio-group v-model="range" variant="default-filled" size="small">
          <t-radio-button v-for="option in RANGE_OPTIONS" :key="option.value" :value="option.value">
            {{ t(option.labelKey) }}
          </t-radio-button>
        </t-radio-group>
      </div>
    </header>
    <t-loading v-if="loading" :text="t('dashboard.live.loading')" />
    <t-alert v-else-if="error" theme="error" :message="error">
      <template #operation><t-button variant="text" @click="refresh">{{ t('dashboard.live.retry') }}</t-button></template>
    </t-alert>
    <t-empty v-else-if="!projectId" :description="t('dashboard.scope.noProject')" />
    <template v-if="dashboard && availability && statusCodes">
    <t-alert v-if="truncated || availability.history.status === 'TRUNCATED' || statusCodes.history.status === 'TRUNCATED'" theme="warning" :message="t('dashboard.live.truncated')" />

    <!-- 状态条：监控项状态 / 探针 / 告警 / 证书 -->
    <MonitorSummaryStrip :summary="dashboard.summary" />

    <!-- 核心指标 -->
    <section class="dashboard__section">
      <div class="dashboard__section-head">
        <h3 class="dashboard__section-title">{{ t('dashboard.section.kpi') }}</h3>
      </div>
      <MonitorKpiGrid :kpis="kpis" />
    </section>

    <!-- 数据概览：保留原有 SVG 指标卡 -->
    <section class="dashboard__section">
      <div class="dashboard__section-head">
        <h3 class="dashboard__section-title">{{ t('dashboard.section.dataOverview') }}</h3>
      </div>
      <div class="dashboard__charts">
        <MetricChartCard
          v-for="metric in svgMetrics"
          :key="metric.key"
          :title="metric.title"
          :tip="metric.tip"
          :values="metric.values"
          :labels="metric.labels"
          :auto-scale="metric.autoScale"
        />
      </div>
    </section>

    <!-- 性能趋势 -->
    <section class="dashboard__section">
      <div class="dashboard__section-head">
        <h3 class="dashboard__section-title">{{ t('dashboard.section.trend') }}</h3>
        <span class="dashboard__section-extra">
          {{ t('dashboard.section.trendTip') }}
        </span>
      </div>
      <MonitorTrendCharts :timeline="timeline" />
    </section>

    <!-- 可用性与状态码 -->
    <section class="dashboard__section">
      <div class="dashboard__section-head">
        <h3 class="dashboard__section-title">{{ t('dashboard.section.availability') }}</h3>
        <span class="dashboard__section-extra">
          {{ t('dashboard.section.availabilityTip') }}
        </span>
      </div>
      <MonitorAvailabilityPanel :heatmap="availability" :codes="statusCodes" />
    </section>

    <!-- 监控分布 -->
    <section class="dashboard__section">
      <div class="dashboard__section-head">
        <h3 class="dashboard__section-title">{{ t('dashboard.section.distribution') }}</h3>
        <span class="dashboard__section-extra">
          {{ t('dashboard.section.distributionTip') }}
        </span>
      </div>
      <MonitorDistributionCharts :summary="dashboard.summary" :distribution="dashboard.distribution" />
    </section>

    <!-- 慢项与告警 -->
    <section class="dashboard__section">
      <div class="dashboard__section-head">
        <h3 class="dashboard__section-title">{{ t('dashboard.section.detail') }}</h3>
        <span class="dashboard__section-extra">
          {{ t('dashboard.section.detailTip') }}
        </span>
      </div>
      <MonitorDetailPanel :slowest="dashboard.slowestMonitors" :events="dashboard.recentAlerts" />
    </section>
    </template>
  </div>
</template>

<style scoped lang="less">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: @beacon-gap-l;

  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: @beacon-gap-l;
  }

  &__hero-main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    margin: 0;
    font-size: @beacon-font-size-title;
    font-weight: @beacon-font-weight-medium;
    line-height: 40px;
    color: @beacon-text-primary;
  }

  &__wave {
    margin-right: 10px;
    font-size: 26px;
    line-height: 1;
  }

  &__desc {
    margin: 0;
    color: @beacon-text-secondary;
  }

  &__scope {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__updated {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__range {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    flex-wrap: wrap;
  }

  &__range-label {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: @beacon-gap-l;
    margin-top: 8px;
  }

  &__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @beacon-gap-l;
    margin-bottom: -4px;
  }

  &__section-title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
  }

  &__section-extra {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  // 与参考实现一致：4 列图表网格
  &__charts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }
  @media (max-width: 1100px) {
    &__hero { flex-direction: column; }
    &__charts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 600px) {
    &__charts { grid-template-columns: minmax(0, 1fr); }
    &__section-head { flex-wrap: wrap; }
  }
}
</style>
