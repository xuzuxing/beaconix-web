<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PublicStatusPage } from '@/api/types/status-page'
import PublicMonitorAvailability from '@/components/status-pages/PublicMonitorAvailability.vue'
import PublicMonitorMetricBar from '@/components/status-pages/PublicMonitorMetricBar.vue'
import PublicStatusBadge from '@/components/status-pages/PublicStatusBadge.vue'
import PublicStatusCharts from '@/components/status-pages/PublicStatusCharts.vue'
import { formatDateTime } from '@/utils/billing'
import {
  formatLatency,
  formatUptime,
  latencyRatio,
  maxMonitorLatency,
  summarizePublicMonitorMetrics,
  uptimeRatio,
} from '@/utils/status-page-presenter'

/**
 * 公开状态页的展示本体（无控制台框架）。
 *
 * 布局按看板组织：头部总览 → 汇总图 → 监控卡片网格，每块独立成卡，
 * 在 1280px 宽度下保持层次感，而不是一整块通栏白底。
 * 只做渲染：数据与刷新由调用方负责，延迟 / 可用率是否出现取决于页面开关。
 */
defineOptions({ name: 'PublicStatusPagePanel' })
const props = defineProps<{ page: PublicStatusPage }>()
const { t } = useI18n()

/** 行内延迟条的归一基准：同类里的最大延迟 */
const maxLatency = computed(() => maxMonitorLatency(props.page.monitors))
const summary = computed(() => summarizePublicMonitorMetrics(props.page.monitors))
</script>

<template>
  <div class="public-panel">
    <section class="public-card public-panel__hero">
      <div class="public-panel__identity">
        <h1 class="public-panel__title">{{ page.title }}</h1>
        <p v-if="page.description" class="public-panel__desc">{{ page.description }}</p>
      </div>

      <div class="public-panel__overall">
        <span class="public-panel__overall-label">{{ t('statusPage.public.overall') }}</span>
        <PublicStatusBadge :status="page.overallStatus" size="large" />
        <span class="public-panel__updated">
          {{ t('statusPage.public.updatedAt') }} {{ formatDateTime(page.updatedAt) }}
        </span>
      </div>

      <dl v-if="page.monitors.length" class="public-panel__summary">
        <div class="public-panel__summary-item">
          <dt>{{ t('statusPage.public.summary.monitors') }}</dt>
          <dd>{{ summary.total }}</dd>
        </div>
        <div v-if="page.showUptime" class="public-panel__summary-item">
          <dt>{{ t('statusPage.public.summary.uptime') }}</dt>
          <dd>{{ formatUptime(summary.averageUptime) ?? '-' }}</dd>
        </div>
        <div v-if="page.showLatency" class="public-panel__summary-item">
          <dt>{{ t('statusPage.public.summary.latency') }}</dt>
          <dd>{{ formatLatency(summary.averageLatency) ?? '-' }}</dd>
        </div>
        <div class="public-panel__summary-item">
          <dt>{{ t('statusPage.public.summary.lastCheck') }}</dt>
          <dd>{{ formatDateTime(summary.lastCheckAt) }}</dd>
        </div>
      </dl>
    </section>

    <PublicStatusCharts v-if="page.monitors.length" :page="page" />

    <section v-if="page.monitors.length" class="public-panel__monitors">
      <h2 class="public-panel__section-title">{{ t('statusPage.public.monitorsTitle') }}</h2>
      <ul class="public-panel__grid">
        <li v-for="monitor in page.monitors" :key="monitor.id" class="public-card public-monitor">
          <header class="public-monitor__head">
            <div class="public-monitor__main">
              <span class="public-monitor__name">{{ monitor.name }}</span>
              <span class="public-monitor__target">
                <span class="public-monitor__type">{{ monitor.type }}</span>
                {{ monitor.target }}
              </span>
            </div>
            <PublicStatusBadge :status="monitor.status" />
          </header>

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

          <PublicMonitorAvailability
            v-if="page.showUptime && monitor.availability"
            :availability="monitor.availability"
          />
        </li>
      </ul>
    </section>
    <p v-else class="public-card public-panel__empty">
      {{ t('statusPage.public.noMonitors') }}
    </p>
  </div>
</template>

<style scoped lang="less">
/** 公开页统一的卡片外观：白底 + 1px 边框 + 4px 圆角（比控制台的直角略柔和） */
.public-card {
  padding: 24px;
  background: @beacon-bg-container;
  border: 1px solid @beacon-border;
  border-radius: 4px;
}

.public-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;

  &__hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px 32px;
    align-items: start;
  }

  &__identity {
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: 28px;
    line-height: 36px;
    font-weight: 600;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__desc {
    // 宽屏下限制阅读宽度，避免文字横跨整行
    max-width: 640px;
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 22px;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__overall {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
  }

  &__overall-label {
    font-size: 13px;
    color: @beacon-text-secondary;
  }

  &__updated {
    font-size: 12px;
    color: @beacon-text-tertiary;
  }

  &__summary {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    margin: 0;
    padding-top: 20px;
    border-top: 1px solid @beacon-border;
  }

  &__summary-item {
    display: flex;
    flex-direction: column;
    gap: 6px;

    dt {
      font-size: 12px;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 0;
      font-size: 22px;
      line-height: 28px;
      font-weight: 600;
      color: @beacon-text-primary;
      font-variant-numeric: tabular-nums;
    }
  }

  &__monitors {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  &__section-title {
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    font-weight: 600;
    color: @beacon-text-primary;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: 16px;
  }

  &__empty {
    margin: 0;
    padding: 48px 24px;
    text-align: center;
    color: @beacon-text-tertiary;
  }
}

.public-monitor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: @beacon-border-strong;
    box-shadow: 0 2px 10px rgb(0 0 0 / 5%);
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  &__name {
    font-size: 15px;
    line-height: 22px;
    font-weight: 600;
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
    flex: none;
    padding: 0 6px;
    border: 1px solid @beacon-border;
    border-radius: 2px;
    background: @beacon-bg-page;
  }

  &__metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 32px;
    margin: 0;
  }

  &__metric {
    display: flex;
    flex-direction: column;
    gap: 4px;

    dt {
      font-size: 12px;
      color: @beacon-text-tertiary;
    }

    dd {
      margin: 0;
      color: @beacon-text-primary;
      font-variant-numeric: tabular-nums;
    }
  }
}

@media (max-width: 860px) {
  .public-panel {
    &__hero {
      grid-template-columns: minmax(0, 1fr);
    }

    &__title {
      font-size: 24px;
      line-height: 32px;
    }

    &__grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .public-card {
    padding: 20px 16px;
  }
}
</style>
