<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PublicStatusPage } from '@/api/types/status-page'
import MonitorStatusTag from '@/components/monitor/MonitorStatusTag.vue'
import PublicMonitorAvailability from '@/components/status-pages/PublicMonitorAvailability.vue'
import PublicMonitorMetricBar from '@/components/status-pages/PublicMonitorMetricBar.vue'
import PublicStatusCharts from '@/components/status-pages/PublicStatusCharts.vue'
import { formatDateTime } from '@/utils/billing'
import {
  formatLatency,
  formatUptime,
  latencyRatio,
  maxMonitorLatency,
  uptimeRatio,
} from '@/utils/status-page-presenter'

/**
 * 公开状态页的展示本体（无控制台框架）。
 * 只做渲染：数据与刷新由调用方负责，延迟 / 可用率是否出现取决于页面开关。
 * 顶部是汇总图（分布 + 横向对比），列表行内再给一条迷你条做逐项对比。
 */
defineOptions({ name: 'PublicStatusPagePanel' })
const props = defineProps<{ page: PublicStatusPage }>()
const { t } = useI18n()

/** 行内延迟条的归一基准：同类里的最大延迟 */
const maxLatency = computed(() => maxMonitorLatency(props.page.monitors))
</script>

<template>
  <div class="public-panel">
    <header class="public-panel__head">
      <div class="public-panel__identity">
        <h1 class="public-panel__title">{{ page.title }}</h1>
        <p v-if="page.description" class="public-panel__desc">{{ page.description }}</p>
        <p class="public-panel__updated">
          {{ t('statusPage.public.updatedAt') }} {{ formatDateTime(page.updatedAt) }}
        </p>
      </div>
      <div class="public-panel__overall">
        <span class="public-panel__overall-label">{{ t('statusPage.public.overall') }}</span>
        <MonitorStatusTag :status="page.overallStatus" />
      </div>
    </header>

    <PublicStatusCharts v-if="page.monitors.length" :page="page" />

    <ul v-if="page.monitors.length" class="public-panel__list">
      <li v-for="monitor in page.monitors" :key="monitor.id" class="public-monitor">
        <div class="public-monitor__main">
          <span class="public-monitor__name">{{ monitor.name }}</span>
          <span class="public-monitor__target">
            <span class="public-monitor__type">{{ monitor.type }}</span>
            {{ monitor.target }}
          </span>
        </div>

        <dl class="public-monitor__metrics">
          <div v-if="page.showUptime" class="public-monitor__metric">
            <dt>{{ t('statusPage.monitor.uptime') }}</dt>
            <dd>
              <PublicMonitorMetricBar
                tone="success"
                :ratio="uptimeRatio(monitor.uptimePercent)"
                :text="formatUptime(monitor.uptimePercent) ?? '-'"
              />
            </dd>
          </div>
          <div v-if="page.showLatency" class="public-monitor__metric">
            <dt>{{ t('statusPage.monitor.latency') }}</dt>
            <dd>
              <PublicMonitorMetricBar
                tone="warning"
                :ratio="latencyRatio(monitor.latency, maxLatency)"
                :text="formatLatency(monitor.latency) ?? '-'"
              />
            </dd>
          </div>
          <div class="public-monitor__metric">
            <dt>{{ t('statusPage.monitor.lastCheck') }}</dt>
            <dd>{{ formatDateTime(monitor.lastCheckAt) }}</dd>
          </div>
        </dl>

        <MonitorStatusTag :status="monitor.status" />

        <PublicMonitorAvailability
          v-if="page.showUptime && monitor.availability"
          class="public-monitor__heatmap"
          :availability="monitor.availability"
        />
      </li>
    </ul>
    <p v-else class="public-panel__empty">{{ t('statusPage.public.noMonitors') }}</p>
  </div>
</template>

<style scoped lang="less">
.public-panel {
  width: 100%;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    padding-bottom: 20px;
    border-bottom: 1px solid @beacon-border;
  }

  &__identity {
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__desc {
    margin: 8px 0 0;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__updated {
    margin: 8px 0 0;
    font-size: 12px;
    color: @beacon-text-tertiary;
  }

  &__overall {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
  }

  &__overall-label {
    font-size: 12px;
    color: @beacon-text-secondary;
  }

  &__list {
    display: flex;
    flex-direction: column;
  }

  &__empty {
    margin: 0;
    padding: 32px 0;
    text-align: center;
    color: @beacon-text-tertiary;
  }
}

.public-monitor {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 0;
  border-bottom: 1px solid @beacon-border;

  &:last-child {
    border-bottom: 0;
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 200px;
  }

  &__name {
    font-weight: 500;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__target {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__type {
    padding: 0 6px;
    border: 1px solid @beacon-border;
    border-radius: 4px;
    background: @beacon-bg-page;
  }

  &__heatmap {
    // 外层是 flex-wrap 行，热力图独占一整行
    flex: 0 0 100%;
    margin-top: 4px;
  }

  &__metrics {
    display: flex;
    align-items: center;
    gap: 24px;
    margin: 0;
    flex: none;
  }

  &__metric {
    display: flex;
    flex-direction: column;
    gap: 2px;

    dt {
      font-size: 12px;
      color: @beacon-text-tertiary;
    }

    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
      color: @beacon-text-primary;
    }
  }
}

@media (max-width: 720px) {
  .public-monitor {
    align-items: flex-start;

    &__metrics {
      gap: 16px;
    }
  }
}
</style>
