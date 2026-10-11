<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  AdminSchedulerHealth,
  AdminSchedulerJob,
  AdminSchedulerQueue,
} from '@/api/types/admin'
import { formatDateTime } from '@/utils/billing'
import { formatInterval, jobSchedule, queueBacklog } from '@/utils/admin-presenter'

/**
 * 调度器与队列健康度：三个队列的积压、注册的定时任务、到期待检测的监控项与探针在线情况。
 * 只读展示，数据由页面传入。
 */
defineOptions({ name: 'AdminSchedulerPanel' })

const props = defineProps<{ health: AdminSchedulerHealth }>()
const { t } = useI18n()

/** 队列展示顺序与文案 key */
const QUEUES: Array<{ key: keyof Pick<AdminSchedulerHealth, 'scanQueue' | 'checkQueue' | 'scheduledQueue'>; labelKey: string }> = [
  { key: 'scanQueue', labelKey: 'adminPage.metrics.queues.scan' },
  { key: 'checkQueue', labelKey: 'adminPage.metrics.queues.check' },
  { key: 'scheduledQueue', labelKey: 'adminPage.metrics.queues.scheduled' },
]

const queues = computed(() =>
  QUEUES.map((item) => ({ label: t(item.labelKey), queue: props.health[item.key] as AdminSchedulerQueue })),
)

function scheduleLabel(job: AdminSchedulerJob): string {
  const schedule = jobSchedule(job)
  if (schedule.kind === 'interval') {
    return t('adminPage.metrics.jobInterval', { interval: formatInterval(schedule.ms) })
  }
  if (schedule.kind === 'cron') return schedule.pattern
  return t('adminPage.metrics.jobUnknown')
}
</script>

<template>
  <div class="scheduler">
    <div class="scheduler__queues">
      <div v-for="item in queues" :key="item.label" class="scheduler__queue">
        <header class="scheduler__queue-head">
          <span class="scheduler__queue-name">{{ item.label }}</span>
          <span class="scheduler__queue-backlog">
            {{ t('adminPage.metrics.queueBacklog') }} {{ queueBacklog(item.queue) }}
          </span>
        </header>
        <dl class="scheduler__queue-body">
          <div>
            <dt>{{ t('adminPage.metrics.queueWaiting') }}</dt>
            <dd>{{ item.queue.waiting }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.metrics.queueActive') }}</dt>
            <dd>{{ item.queue.active }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.metrics.queueDelayed') }}</dt>
            <dd>{{ item.queue.delayed }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.metrics.queueFailed') }}</dt>
            <dd :class="{ 'is-danger': item.queue.failed > 0 }">{{ item.queue.failed }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.metrics.queueCompleted') }}</dt>
            <dd>{{ item.queue.completed }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="scheduler__side">
      <section class="scheduler__block">
        <h4 class="scheduler__block-title">{{ t('adminPage.metrics.backlogTitle') }}</h4>
        <dl class="scheduler__pairs">
          <div>
            <dt>{{ t('adminPage.metrics.backlogEnabled') }}</dt>
            <dd>{{ health.backlog.enabledMonitors }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.metrics.backlogDue') }}</dt>
            <dd :class="{ 'is-danger': health.backlog.dueMonitors > 0 }">
              {{ health.backlog.dueMonitors }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="scheduler__block">
        <h4 class="scheduler__block-title">{{ t('adminPage.metrics.probeHealthTitle') }}</h4>
        <dl class="scheduler__pairs">
          <div>
            <dt>{{ t('adminPage.metrics.probeOnline') }}</dt>
            <dd>{{ health.probes.online }}</dd>
          </div>
          <div>
            <dt>{{ t('adminPage.metrics.probeOffline') }}</dt>
            <dd :class="{ 'is-danger': health.probes.offline > 0 }">
              {{ health.probes.offline }}
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <section class="scheduler__jobs">
      <h4 class="scheduler__block-title">{{ t('adminPage.metrics.jobsTitle') }}</h4>
      <div v-if="health.schedulers.length" class="scheduler__table">
        <div class="scheduler__table-head">
          <span>{{ t('adminPage.metrics.jobId') }}</span>
          <span>{{ t('adminPage.metrics.jobSchedule') }}</span>
          <span>{{ t('adminPage.metrics.jobNextRunAt') }}</span>
        </div>
        <div v-for="job in health.schedulers" :key="job.id" class="scheduler__row">
          <span class="scheduler__job-id">{{ job.id }}</span>
          <span>{{ scheduleLabel(job) }}</span>
          <span class="scheduler__job-next">{{ formatDateTime(job.nextRunAt) }}</span>
        </div>
      </div>
      <p v-else class="scheduler__empty">{{ t('adminPage.common.empty') }}</p>
    </section>
  </div>
</template>

<style scoped lang="less">
.scheduler {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 16px;

  &__queues {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  &__queue {
    padding: 12px 16px;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }

  &__queue-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__queue-name {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__queue-backlog {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
  }

  &__queue-body {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 12px;
    margin: 0;

    div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    dt {
      font-size: @beacon-font-size-base;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 0;
      color: @beacon-text-primary;
    }
  }

  &__side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__block {
    padding: 12px 16px;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
  }

  &__block-title {
    margin: 0 0 8px;
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__pairs {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;

    div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    dt {
      font-size: @beacon-font-size-base;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 0;
      color: @beacon-text-primary;
    }

    .is-danger {
      font-weight: @beacon-font-weight-medium;
      color: @beacon-error;
    }
  }

  &__jobs {
    grid-column: 1 / -1;
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) minmax(140px, 1fr) minmax(140px, 1fr);
    gap: 16px;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__job-id {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__job-next {
    color: @beacon-text-secondary;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}

@media (max-width: 960px) {
  .scheduler {
    grid-template-columns: minmax(0, 1fr);
  }

  .scheduler__table-head,
  .scheduler__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .scheduler__table-head {
    display: none;
  }
}
</style>
