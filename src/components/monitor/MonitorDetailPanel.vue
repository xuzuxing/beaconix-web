<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MiniTrend from '@/components/charts/MiniTrend.vue'
import type { Dashboard } from '@/api/types/monitoring'
import { formatMetric } from '@/utils/monitoring-adapter'

/**
 * 明细区：响应最慢的监控项 + 最近的告警事件。
 * 左侧按平均响应时间排名，右侧按时间倒序列出告警与恢复记录。
 */
defineOptions({ name: 'MonitorDetailPanel' })

const { t } = useI18n()
const props = defineProps<{ slowest: Dashboard['slowestMonitors']; events: Dashboard['recentAlerts'] }>()

const slowMonitors = computed(() => props.slowest.map(s => ({
  ...s, avgLatency: s.avgLatencyMs, p95: s.p95LatencyMs, uptime: s.uptimePercent, trend: s.sparkline,
})))
const alerts = computed(() => props.events.map(e => ({
  ...e, level: e.status === 'resolved' ? 'recovered' as const : e.level,
  monitor: e.monitorName, time: e.updatedAt.replace('T', ' ').slice(0, 19),
  durationMinutes: e.durationSeconds === null ? null : Math.ceil(e.durationSeconds / 60),
})))

/** 告警级别 → TDesign 标签主题 */
const LEVEL_THEME = {
  critical: 'danger',
  warning: 'warning',
  recovered: 'success',
} as const

const maxLatency = computed(() => Math.max(1, ...slowMonitors.value.map((item) => item.avgLatency ?? 0)))
</script>

<template>
  <div class="detail">
    <section class="detail__panel">
      <header class="detail__head">
        <h3 class="detail__title">{{ t('dashboard.slow.title') }}</h3>
      </header>

      <div class="detail__rows">
        <t-empty v-if="!slowMonitors.length" :description="t('dashboard.live.empty')" />
        <div v-for="(item, index) in slowMonitors" :key="item.id" class="row">
          <span class="row__rank" :class="{ 'row__rank--top': index < 3 }">{{ index + 1 }}</span>

          <span class="row__main">
            <span class="row__name">
              {{ item.name }}
              <em class="row__type">{{ item.type }}</em>
            </span>
            <span class="row__target">{{ item.target }}</span>
          </span>

          <span class="row__trend">
            <MiniTrend
              :values="item.trend"
              :tone="(item.avgLatency ?? 0) > 600 ? 'error' : 'brand'"
            />
          </span>

          <span class="row__metric">
            <span class="row__metric-label">{{ t('dashboard.slow.avgLatency') }}</span>
            <span class="row__metric-value" :class="{ 'row__metric-value--slow': (item.avgLatency ?? 0) > 600 }">
              {{ formatMetric(item.avgLatency) }} ms
            </span>
          </span>

          <span class="row__metric">
            <span class="row__metric-label">P95</span>
            <span class="row__metric-value">{{ formatMetric(item.p95) }} ms</span>
          </span>

          <span class="row__metric">
            <span class="row__metric-label">{{ t('dashboard.slow.uptime') }}</span>
            <span class="row__metric-value">{{ formatMetric(item.uptime, 2) }}%</span>
          </span>

          <span class="row__bar" :style="{ width: `${((item.avgLatency ?? 0) / maxLatency) * 100}%` }"></span>
        </div>
      </div>
    </section>

    <section class="detail__panel">
      <header class="detail__head">
        <h3 class="detail__title">{{ t('dashboard.alert.title') }}</h3>
      </header>

      <div class="detail__rows">
        <t-empty v-if="!alerts.length" :description="t('dashboard.live.empty')" />
        <div v-for="item in alerts" :key="item.id" class="alert">
          <span class="alert__time">{{ item.time }}</span>

          <span class="alert__body">
            <span class="alert__head">
              <t-tag :theme="LEVEL_THEME[item.level]" variant="light" size="small">
                {{ t(`dashboard.alert.level.${item.level}`) }}
              </t-tag>
              <span class="alert__monitor">{{ item.monitor }}</span>
              <span v-if="item.durationMinutes !== null" class="alert__duration">
                {{ t('dashboard.alert.duration', { minutes: item.durationMinutes }) }}
              </span>
              <span v-else class="alert__ongoing">{{ t('dashboard.alert.ongoing') }}</span>
            </span>
            <span class="alert__message">{{ item.message || item.reason }}<template v-if="item.threshold !== null"> ({{ formatMetric(item.actual, 2) }} / {{ item.threshold }} {{ item.unit }})</template></span>
            <t-tag v-if="item.suppressedReason" size="small">{{ item.suppressedReason }}</t-tag>
            <t-tag v-if="item.monitorDeleted" size="small">{{ t('dashboard.live.deleted') }}</t-tag>
            <span class="alert__target">{{ item.target }}</span>
          </span>

          <span class="alert__notified">
            {{ item.notified ? t('dashboard.alert.notified') : t('dashboard.alert.muted') }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="less">
.detail {
  display: grid;
  // 慢项列表列多，占更宽
  grid-template-columns: 1.35fr 1fr;
  gap: @beacon-gap-l;
  @media (max-width: 1200px) { grid-template-columns: minmax(0, 1fr); }
  @media (max-width: 600px) {
    .row { flex-wrap: wrap; }
    .row__main { flex-basis: 70%; }
    .alert { flex-wrap: wrap; }
    .alert__time { width: 100%; }
  }

  &__panel {
    display: flex;
    flex-direction: column;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__head {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    height: 46px;
    padding: 0 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__rows {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }
}

.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  overflow: hidden;

  & + & {
    border-top: 1px solid @beacon-border;
  }

  &__rank {
    flex: none;
    width: 18px;
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-tertiary;
    text-align: center;

    &--top {
      color: @beacon-error;
    }
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__type {
    flex: none;
    padding: 0 4px;
    font-size: 10px;
    font-style: normal;
    line-height: 16px;
    color: @beacon-text-secondary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }

  &__target {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__trend {
    flex: none;
    width: 72px;
    height: 26px;
  }

  &__metric {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: flex-end;
    width: 78px;
    gap: 2px;
  }

  &__metric-label {
    font-size: 10px;
    color: @beacon-text-tertiary;
  }

  &__metric-value {
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;

    &--slow {
      color: @beacon-error;
    }
  }

  // 底部横向占比条：直观体现与最慢项的差距
  &__bar {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background-color: @beacon-brand-light;
  }
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 16px;

  & + & {
    border-top: 1px solid @beacon-border;
  }

  &__time {
    flex: none;
    width: 128px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__monitor {
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }

  &__duration {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__ongoing {
    font-size: @beacon-font-size-base;
    color: @beacon-error;
  }

  &__message {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__target {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__notified {
    flex: none;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}
</style>
