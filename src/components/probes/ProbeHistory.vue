<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { listProbeExecutions, listProbeResults } from '@/api/modules/probe'
import type {
  ProbeExecution,
  ProbeResult,
  ProbeExecutionStatus,
  ProbeExecutionTrigger,
} from '@/api/types/probe'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  sessionEpoch,
} from '@/utils/access-context'
import { formatDateTime } from '@/utils/billing'
import AppIcon from '@/components/AppIcon.vue'
import { RefreshIcon, Search01Icon } from '@/icons'

const props = defineProps<{
  orgId: string
  probeId: string
  kind: 'results' | 'executions'
}>()
const { t } = useI18n()
const permissions = usePermissionsStore()
const rows = ref<(ProbeResult | ProbeExecution)[]>([])
const loading = ref(false)
const error = ref('')
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const targetInput = ref('')
const target = ref('')
const status = ref<ProbeExecutionStatus | 'all'>('all')
const trigger = ref<ProbeExecutionTrigger | 'all'>('all')
const statuses: ProbeExecutionStatus[] = [
  'SUCCESS',
  'FAILED',
  'TIMEOUT',
  'SKIPPED',
]
const triggers: ProbeExecutionTrigger[] = ['SCHEDULED', 'MANUAL', 'CALLBACK']
const allowed = computed(() => permissions.canOrganization(props.orgId))
let generation = 0
let controller: AbortController | undefined
async function load() {
  const token = ++generation
  const context = accessContext()
  controller?.abort()
  controller = new AbortController()
  rows.value = []
  total.value = 0
  error.value = ''
  loading.value = false
  if (!allowed.value || !props.probeId) return
  loading.value = true
  const query = {
    page: page.value,
    limit: limit.value,
    ...(target.value ? { target: target.value } : {}),
  }
  try {
    const result =
      props.kind === 'results'
        ? await listProbeResults(props.orgId, props.probeId, query, {
            signal: controller.signal,
          })
        : await listProbeExecutions(
            props.orgId,
            props.probeId,
            {
              ...query,
              ...(status.value === 'all' ? {} : { status: status.value }),
              ...(trigger.value === 'all' ? {} : { trigger: trigger.value }),
            },
            { signal: controller.signal },
          )
    if (token !== generation || !isCurrentContext(context) || !allowed.value)
      return
    if (page.value > Math.max(1, result.meta.totalPages)) {
      page.value = Math.max(1, result.meta.totalPages)
      return
    }
    rows.value = result.data
    total.value = result.meta.total
  } catch (cause) {
    if (token === generation && isCurrentContext(context))
      error.value =
        cause instanceof Error ? cause.message : t('probePage.bindingsFailed')
  } finally {
    if (token === generation) loading.value = false
  }
}
watch(
  () => [
    props.orgId,
    props.probeId,
    props.kind,
    permissionEpoch.value,
    sessionEpoch.value,
  ],
  () => {
    page.value = 1
    status.value = 'all'
    trigger.value = 'all'
    target.value = ''
    targetInput.value = ''
  },
  { flush: 'sync' },
)
watch(
  [
    page,
    limit,
    target,
    status,
    trigger,
    allowed,
    () => props.orgId,
    () => props.probeId,
    () => props.kind,
    permissionEpoch,
    sessionEpoch,
  ],
  () => {
    void load()
  },
  { immediate: true },
)
function search() {
  page.value = 1
  target.value = targetInput.value.trim()
  void load()
}
function setStatus(value: unknown) {
  status.value = value as typeof status.value
  page.value = 1
}
function setTrigger(value: unknown) {
  trigger.value = value as typeof trigger.value
  page.value = 1
}
onScopeDispose(() => {
  generation++
  controller?.abort()
})
</script>

<template>
  <section class="probe-history">
    <div class="probe-history__filters">
      <t-input
        v-model="targetInput"
        clearable
        :aria-label="t('probePage.exactTarget')"
        :placeholder="t('probePage.exactTarget')"
        @enter="search"
      />
      <t-tooltip :content="t('probePage.query')"
        ><t-button
          shape="square"
          variant="outline"
          :aria-label="t('probePage.query')"
          @click="search"
          ><AppIcon :icon="Search01Icon" /></t-button
      ></t-tooltip>
      <t-tooltip :content="t('probePage.refresh')"
        ><t-button
          shape="square"
          variant="outline"
          :loading="loading"
          :aria-label="t('probePage.refresh')"
          @click="load"
          ><AppIcon :icon="RefreshIcon" /></t-button
      ></t-tooltip>
    </div>
    <div
      v-if="kind === 'executions'"
      class="probe-history__options"
    >
      <t-select
        :value="status"
        :aria-label="t('probePage.allResults')"
        @change="setStatus"
        :options="[
          { value: 'all', label: t('probePage.allResults') },
          ...statuses.map((value) => ({
            value,
            label: t(`probePage.executionStatus.${value}`),
          })),
        ]"
      />
      <t-select
        :value="trigger"
        :aria-label="t('probePage.allTriggers')"
        @change="setTrigger"
        :options="[
          { value: 'all', label: t('probePage.allTriggers') },
          ...triggers.map((value) => ({
            value,
            label: t(`probePage.triggerLabel.${value}`),
          })),
        ]"
      />
    </div>
    <t-alert
      v-if="error"
      theme="error"
      :message="error"
    />
    <div
      v-if="loading"
      class="probe-history__state"
    >
      <t-loading :text="t('common.loading')" />
    </div>
    <p
      v-else-if="!rows.length && !error"
      class="probe-history__state"
    >
      {{ t('probePage.historyEmpty') }}
    </p>
    <article
      v-for="row in rows"
      :key="row.id"
      class="probe-history__row"
    >
      <header>
        <t-tag
          variant="light"
          :theme="row.success ? 'success' : 'danger'"
        >
          {{
            'status' in row
              ? t(`probePage.executionStatus.${row.status}`)
              : t(row.success ? 'probePage.success' : 'probePage.failure')
          }}
        </t-tag>
        <span v-if="'trigger' in row">{{
          t(`probePage.triggerLabel.${row.trigger}`)
        }}</span>
        <time>{{
          formatDateTime('executedAt' in row ? row.executedAt : row.checkedAt)
        }}</time>
      </header>
      <p>{{ row.target }}</p>
      <small
        >{{ t('probePage.latency') }}:
        {{ row.latency == null ? '-' : `${row.latency} ms` }}</small
      >
      <p
        v-if="row.error"
        class="probe-history__error"
      >
        {{ row.error }}
      </p>
      <details v-if="'requestMeta' in row">
        <summary>{{ t('probePage.metadata') }}</summary>
        <pre>{{
          JSON.stringify(
            { request: row.requestMeta, response: row.responseMeta },
            null,
            2,
          )
        }}</pre>
      </details>
    </article>
    <t-pagination
      v-if="total"
      :total="total"
      :current="page"
      :page-size="limit"
      :page-size-options="[10, 20, 50]"
      :show-jumper="false"
      @change="
        ({ current, pageSize }: { current: number; pageSize: number }) => {
          page = current
          limit = pageSize
        }
      "
    />
  </section>
</template>

<style scoped lang="less">
.probe-history {
  display: grid;
  gap: 12px;
  min-width: 0;
  &__filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 32px 32px;
    gap: 8px;
  }
  &__options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  &__state {
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: @beacon-text-secondary;
  }
  &__row {
    padding: 12px 0;
    border-bottom: 1px solid @beacon-border;
    min-width: 0;
  }
  header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  time {
    margin-left: auto;
    font-size: 12px;
    color: @beacon-text-secondary;
  }
  p {
    margin: 8px 0;
    overflow-wrap: anywhere;
  }
  small,
  summary {
    color: @beacon-text-secondary;
  }
  summary {
    margin-top: 8px;
    cursor: pointer;
  }
  pre {
    font-size: 12px;
    background: @beacon-bg-page;
    padding: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  &__error {
    color: @beacon-error;
  }
  :deep(.t-pagination) {
    flex-wrap: wrap;
    gap: 12px;
  }
  @media (max-width: 600px) {
    :deep(.t-pagination__total) {
      flex: 0 0 100%;
      margin-right: 0;
    }
  }
}
</style>
