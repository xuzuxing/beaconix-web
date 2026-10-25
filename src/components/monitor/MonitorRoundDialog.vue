<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMonitorRound } from '@/api'
import type { MonitorRound } from '@/api/types/monitor-detail'
import { formatMonitorTime } from '@/utils/monitor-presenter'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{
  projectId: string
  monitorId: string
  roundId: string | null
  tz: string
}>()

const { t, locale } = useI18n()
const round = ref<MonitorRound>()
const loading = ref(false)
const error = ref('')
let generation = 0
let controller: AbortController | undefined

async function load() {
  const token = ++generation
  controller?.abort()
  controller = new AbortController()
  error.value = ''
  round.value = undefined
  if (!props.projectId || !props.monitorId || !props.roundId) return
  loading.value = true
  try {
    const data = await getMonitorRound(
      props.projectId,
      props.monitorId,
      props.roundId,
      { signal: controller.signal },
    )
    if (token !== generation) return
    round.value = data
  } catch (cause) {
    if (token !== generation) return
    error.value =
      cause instanceof Error ? cause.message : t('monitorPage.roundLoadFailed')
  } finally {
    if (token === generation) loading.value = false
  }
}

watch(
  [() => props.roundId, visible],
  ([roundId, open]) => {
    if (open && roundId) {
      void load()
    } else if (!open) {
      generation++
      controller?.abort()
      round.value = undefined
      error.value = ''
    }
  },
  { immediate: true },
)

const time = (value?: string | null) =>
  formatMonitorTime(value, locale.value, props.tz)
const latency = (value?: number | null) =>
  value == null ? '-' : t('monitorPage.milliseconds', { value })
const percent = (value?: number | null) => (value == null ? '-' : `${value}%`)
type TagTheme = 'default' | 'success' | 'warning' | 'danger'
const decisionTheme = (value: string): TagTheme => {
  switch (value) {
    case 'CONFIRMED_SUCCESS':
      return 'success'
    case 'CONFIRMED_FAILURE':
      return 'danger'
    case 'RESCUED':
    case 'OVERTURNED':
      return 'warning'
    default:
      return 'default'
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('monitorPage.roundDetail')"
    width="min(760px, calc(100vw - 32px))"
    :footer="false"
    :close-on-overlay-click="!loading"
  >
    <div class="round-dialog">
      <div
        v-if="loading"
        class="round-dialog__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>
      <template v-else-if="error">
        <t-alert
          theme="error"
          :message="error"
        />
        <t-button
          variant="outline"
          class="round-dialog__retry"
          @click="load"
          >{{ t('monitorPage.retry') }}</t-button
        >
      </template>
      <template v-else-if="round">
        <div class="round-dialog__status">
          <t-tag
            size="small"
            variant="light"
            :theme="round.settled ? 'default' : 'warning'"
            >{{
              t(
                round.settled
                  ? 'monitorPage.roundSettled'
                  : 'monitorPage.roundCollecting',
              )
            }}</t-tag
          >
          <span>{{ round.roundId }}</span>
        </div>

        <section class="round-dialog__section">
          <h4>{{ t('monitorPage.roundCheck') }}</h4>
          <dl class="round-dialog__grid">
            <div>
              <dt>{{ t('monitorPage.checkedAt') }}</dt>
              <dd>{{ time(round.check.checkedAt) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.result') }}</dt>
              <dd>
                <t-tag
                  size="small"
                  variant="light"
                  :theme="round.check.success ? 'success' : 'danger'"
                  >{{
                    t(
                      round.check.success
                        ? 'workspace.monitor.ok'
                        : 'workspace.monitor.fail',
                    )
                  }}</t-tag
                >
              </dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.latency') }}</dt>
              <dd>{{ latency(round.check.latency) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.code') }}</dt>
              <dd>{{ round.check.statusCode ?? '-' }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundSource') }}</dt>
              <dd>{{ round.check.source }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundEvaluated') }}</dt>
              <dd>{{
                t(
                  round.check.evaluated
                    ? 'monitorPage.roundYes'
                    : 'monitorPage.roundNo',
                )
              }}</dd>
            </div>
            <div
              v-if="round.check.failureKind"
              class="round-dialog__span"
            >
              <dt>{{ t('monitorPage.roundFailureKind') }}</dt>
              <dd>{{ round.check.failureKind }}</dd>
            </div>
            <div class="round-dialog__span">
              <dt>{{ t('monitorPage.error') }}</dt>
              <dd>{{ round.check.error || '-' }}</dd>
            </div>
          </dl>
        </section>

        <section class="round-dialog__section">
          <h4>{{ t('monitorPage.roundAggregation') }}</h4>
          <p
            v-if="!round.aggregation"
            class="round-dialog__muted"
          >
            {{ t('monitorPage.roundCollecting') }}
          </p>
          <dl
            v-else
            class="round-dialog__grid"
          >
            <div>
              <dt>{{ t('monitorPage.roundDecision') }}</dt>
              <dd>
                <t-tag
                  size="small"
                  variant="light"
                  :theme="decisionTheme(round.aggregation.decision)"
                  >{{
                    t(
                      `monitorPage.roundDecisionMap.${round.aggregation.decision}`,
                    )
                  }}</t-tag
                >
              </dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundProtected') }}</dt>
              <dd>
                <t-tag
                  size="small"
                  variant="outline"
                  :theme="round.aggregation.protected ? 'warning' : 'default'"
                  >{{
                    t(
                      round.aggregation.protected
                        ? 'monitorPage.roundYes'
                        : 'monitorPage.roundNo',
                    )
                  }}</t-tag
                >
                <span
                  v-if="round.aggregation.protectedReason"
                  class="round-dialog__muted"
                  >{{
                    t(
                      `monitorPage.roundProtectedReasonMap.${round.aggregation.protectedReason}`,
                    )
                  }}</span
                >
              </dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundProbeCount') }}</dt>
              <dd>{{ round.aggregation.effectiveProbeCount }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundSampleCount') }}</dt>
              <dd>{{ round.aggregation.sampleCount }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundSuccessCount') }}</dt>
              <dd>{{ round.aggregation.successCount }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundRatio') }}</dt>
              <dd>{{ percent(round.aggregation.ratio) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundThreshold') }}</dt>
              <dd>{{ percent(round.aggregation.threshold) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitorPage.roundSettledAt') }}</dt>
              <dd>{{ time(round.aggregation.settledAt) }}</dd>
            </div>
          </dl>
        </section>

        <section class="round-dialog__section">
          <h4>{{ t('monitorPage.roundResults') }}</h4>
          <div
            v-if="round.results.length"
            class="round-dialog__scroll"
          >
            <table class="round-dialog__table">
              <thead>
                <tr>
                  <th>{{ t('monitorPage.roundProbe') }}</th>
                  <th>{{ t('monitorPage.roundRegion') }}</th>
                  <th>{{ t('monitorPage.result') }}</th>
                  <th>{{ t('monitorPage.latency') }}</th>
                  <th>{{ t('monitorPage.code') }}</th>
                  <th>{{ t('monitorPage.roundReceivedAt') }}</th>
                  <th>{{ t('monitorPage.roundAppliedAt') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="result in round.results"
                  :key="result.id"
                >
                  <td>{{ result.probe?.name ?? result.probeId }}</td>
                  <td>{{ result.probe?.region ?? '-' }}</td>
                  <td>
                    <t-tag
                      size="small"
                      variant="light"
                      :theme="result.success ? 'success' : 'danger'"
                      >{{
                        t(
                          result.success
                            ? 'workspace.monitor.ok'
                            : 'workspace.monitor.fail',
                        )
                      }}</t-tag
                    >
                  </td>
                  <td>{{ latency(result.latency) }}</td>
                  <td>{{ result.statusCode ?? '-' }}</td>
                  <td>{{ time(result.receivedAt) }}</td>
                  <td>{{
                    result.appliedAt
                      ? time(result.appliedAt)
                      : t('monitorPage.roundIgnored')
                  }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-else
            class="round-dialog__muted"
          >
            {{ t('monitorPage.roundNoReports') }}
          </p>
        </section>
      </template>
    </div>
  </t-dialog>
</template>

<style scoped lang="less">
.round-dialog {
  &__state {
    display: flex;
    min-height: 200px;
    align-items: center;
    justify-content: center;
  }
  &__retry {
    margin-top: 12px;
  }
  &__status {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    span {
      color: @beacon-text-tertiary;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
  }
  &__section {
    margin-bottom: 20px;
    h4 {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: @beacon-text-primary;
    }
  }
  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 24px;
    margin: 0;
    div {
      min-width: 0;
    }
    dt {
      margin-bottom: 6px;
      color: @beacon-text-secondary;
      font-size: 12px;
    }
    dd {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      color: @beacon-text-primary;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
  }
  &__span {
    grid-column: 1 / -1;
  }
  &__muted {
    color: @beacon-text-tertiary;
    font-size: 12px;
  }
  &__scroll {
    overflow-x: auto;
  }
  &__table {
    width: 100%;
    min-width: 640px;
    border-collapse: collapse;
    text-align: left;
    font-size: 12px;
    th {
      color: @beacon-text-secondary;
      font-weight: 500;
    }
    th,
    td {
      padding: 10px;
      border-bottom: 1px solid @beacon-border;
    }
    td {
      color: @beacon-text-primary;
      overflow-wrap: anywhere;
    }
  }
}
</style>
