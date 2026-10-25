<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MonitorInsights } from '@/api/types/monitor-detail'
import { formatMonitorTime } from '@/utils/monitor-presenter'
const props = defineProps<{
  events: MonitorInsights['events']
  asOf: string
  tz: string
}>()
const { t, locale } = useI18n()
function duration(event: MonitorInsights['events'][number]) {
  const seconds =
    event.durationSeconds ??
    Math.max(0, (Date.parse(props.asOf) - Date.parse(event.startedAt)) / 1000)
  return seconds < 60
    ? t('monitorPage.seconds', { value: Math.floor(seconds) })
    : t('monitorPage.minutes', { value: Math.floor(seconds / 60) })
}
const suppression = (reason: string) =>
  t(
    `monitorPage.${reason === 'PAUSED' ? 'pausedReason' : reason === 'DELETED' ? 'deletedReason' : 'configReason'}`,
  )
</script>

<template>
  <div
    v-if="events.length"
    class="monitor-events"
  >
    <article
      v-for="event in events"
      :key="event.id"
      class="monitor-event"
    >
      <div class="monitor-event__head">
        <strong>{{ t(`monitorPage.eventKind.${event.kind}`) }}</strong>
        <t-tag
          size="small"
          variant="light"
          :theme="
            event.status === 'resolved'
              ? 'success'
              : event.level === 'critical'
                ? 'danger'
                : 'warning'
          "
          >{{
            t(
              event.status === 'resolved'
                ? 'monitorPage.resolved'
                : 'monitorPage.active',
            )
          }}</t-tag
        >
        <span>{{
          t(
            event.level === 'critical'
              ? 'monitorPage.critical'
              : 'monitorPage.warning',
          )
        }}</span>
        <t-tag
          v-if="event.origin === 'BASELINE'"
          size="small"
          variant="outline"
          >{{ t('monitorPage.baseline') }}</t-tag
        >
      </div>
      <p>{{ event.message || event.reason }}</p>
      <div class="monitor-event__meta">
        <span
          >{{ t('monitorPage.started') }} ·
          {{ formatMonitorTime(event.startedAt, locale, tz) }}</span
        >
        <span v-if="event.resolvedAt"
          >{{ t('monitorPage.recovered') }} ·
          {{ formatMonitorTime(event.resolvedAt, locale, tz) }}</span
        >
        <span>{{ t('monitorPage.duration') }} · {{ duration(event) }}</span>
        <span>{{
          t(event.notified ? 'monitorPage.notified' : 'monitorPage.unnotified')
        }}</span>
        <span v-if="event.suppressedReason">{{
          suppression(event.suppressedReason)
        }}</span>
      </div>
    </article>
  </div>
  <t-empty
    v-else
    :description="t('monitorPage.noEvents')"
  />
</template>

<style scoped lang="less">
.monitor-event {
  padding: 16px 0;
  border-bottom: 1px solid @beacon-border;
  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    > span {
      font-size: 12px;
      color: @beacon-text-secondary;
    }
  }
  p {
    margin: 10px 0;
    overflow-wrap: anywhere;
  }
  &__meta {
    display: flex;
    gap: 8px 20px;
    flex-wrap: wrap;
    font-size: 12px;
    color: @beacon-text-tertiary;
  }
}
</style>
