<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  createMonitor,
  deleteMonitor,
  getProjectMonitoringOverview,
  listMonitorChecks,
  listMonitors,
  pauseMonitor,
  resumeMonitor,
  runMonitorCheck,
  updateMonitor,
} from '@/api'
import type { CheckLog, Monitor, MonitoringOverview, MonitorStatus, MonitorType } from '@/api/types'
import { useOrganizationStore } from '@/stores'

/** 监控：当前项目的监控项、立即检查、状态与检查历史 */
defineOptions({ name: 'MonitorView' })

const { t } = useI18n()
const orgStore = useOrganizationStore()

const projectId = computed(() => orgStore.currentProjectId)
const monitors = ref<Monitor[]>([])
const overview = ref<MonitoringOverview | null>(null)
const loading = ref(false)
const submitting = ref(false)
const checkingId = ref('')

const STATUS_THEME: Record<MonitorStatus, 'success' | 'danger' | 'warning' | 'default'> = {
  UP: 'success',
  DOWN: 'danger',
  DEGRADED: 'warning',
  PAUSED: 'default',
  UNKNOWN: 'default',
}

const statusOptions = computed(() => [
  { label: t('workspace.monitor.typeHttp'), value: 'HTTP' },
  { label: t('workspace.monitor.typeTcp'), value: 'TCP' },
])

const summary = computed(() => {
  const data = overview.value
  return [
    { key: 'total', label: t('workspace.monitor.summary.total'), value: data?.monitors.total ?? 0 },
    { key: 'up', label: t('workspace.monitor.summary.up'), value: data?.byStatus.UP ?? 0 },
    { key: 'down', label: t('workspace.monitor.summary.down'), value: data?.byStatus.DOWN ?? 0 },
    {
      key: 'uptime',
      label: t('workspace.monitor.summary.uptime'),
      value: data?.uptime.uptimePercent != null ? `${data.uptime.uptimePercent}%` : '—',
    },
    {
      key: 'latency',
      label: t('workspace.monitor.summary.latency'),
      value: data?.avgLatency != null ? `${data.avgLatency} ms` : '—',
    },
  ]
})

function statusText(status: MonitorStatus) {
  return t(`workspace.monitor.status.${status}`)
}

async function load() {
  if (!projectId.value) {
    monitors.value = []
    overview.value = null
    return
  }

  loading.value = true
  try {
    monitors.value = await listMonitors(projectId.value)
    overview.value = await getProjectMonitoringOverview(projectId.value)
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

watch(projectId, () => {
  void load()
})

// ---------- 操作 ----------
async function check(monitor: Monitor) {
  checkingId.value = monitor.id
  try {
    await runMonitorCheck(projectId.value, monitor.id)
    MessagePlugin.success(t('workspace.monitor.checked'))
    await load()
  } catch {
    // 请求层已统一提示
  } finally {
    checkingId.value = ''
  }
}

async function togglePause(monitor: Monitor) {
  try {
    if (monitor.status === 'PAUSED') {
      await resumeMonitor(projectId.value, monitor.id)
    } else {
      await pauseMonitor(projectId.value, monitor.id)
    }
    await load()
  } catch {
    // 请求层已统一提示
  }
}

async function remove(monitor: Monitor) {
  try {
    await deleteMonitor(projectId.value, monitor.id)
    MessagePlugin.success(t('workspace.monitor.deleted'))
    await load()
  } catch {
    // 请求层已统一提示
  }
}

// ---------- 新建 / 编辑 ----------
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref('')

const form = reactive({
  name: '',
  type: 'HTTP' as MonitorType,
  target: '',
  interval: 60,
  timeout: 5000,
  expectedStatus: 200,
  failureThreshold: 3,
  enabled: true,
})

function openCreate() {
  dialogMode.value = 'create'
  editingId.value = ''
  form.name = ''
  form.type = 'HTTP'
  form.target = ''
  form.interval = 60
  form.timeout = 5000
  form.expectedStatus = 200
  form.failureThreshold = 3
  form.enabled = true
  dialogVisible.value = true
}

function openEdit(monitor: Monitor) {
  dialogMode.value = 'edit'
  editingId.value = monitor.id
  form.name = monitor.name
  form.type = monitor.type
  form.target = monitor.target
  form.interval = monitor.interval
  form.timeout = monitor.timeout
  form.expectedStatus = monitor.expectedStatus
  form.failureThreshold = monitor.failureThreshold
  form.enabled = monitor.enabled
  dialogVisible.value = true
}

async function submitDialog() {
  if (!form.name.trim() || !form.target.trim()) {
    MessagePlugin.warning(t('workspace.monitor.required'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      target: form.target.trim(),
      interval: Number(form.interval),
      timeout: Number(form.timeout),
      expectedStatus: Number(form.expectedStatus),
      failureThreshold: Number(form.failureThreshold),
      enabled: form.enabled,
    }

    if (dialogMode.value === 'create') {
      await createMonitor(projectId.value, payload)
      MessagePlugin.success(t('workspace.monitor.created'))
    } else {
      await updateMonitor(projectId.value, editingId.value, payload)
      MessagePlugin.success(t('workspace.monitor.updated'))
    }
    dialogVisible.value = false
    await load()
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false
  }
}

// ---------- 检查历史 ----------
const historyVisible = ref(false)
const historyLoading = ref(false)
const history = ref<CheckLog[]>([])
const historyName = ref('')

async function openHistory(monitor: Monitor) {
  historyName.value = monitor.name
  history.value = []
  historyVisible.value = true
  historyLoading.value = true
  try {
    history.value = await listMonitorChecks(projectId.value, monitor.id, { limit: 20 })
  } catch {
    // 请求层已统一提示
  } finally {
    historyLoading.value = false
  }
}
</script>

<template>
  <div class="monitor">
    <div class="monitor__bar">
      <span class="monitor__hint">
        {{ orgStore.currentOrganization?.name ?? '—' }} / {{ orgStore.currentProject?.name ?? '—' }}
      </span>
      <t-button theme="primary" size="small" @click="openCreate">
        {{ t('workspace.monitor.create') }}
      </t-button>
    </div>

    <!-- 概览 -->
    <div class="monitor__summary">
      <div v-for="item in summary" :key="item.key" class="monitor__stat">
        <span class="monitor__stat-label">{{ item.label }}</span>
        <span class="monitor__stat-value">{{ item.value }}</span>
      </div>
    </div>

    <!-- 监控项 -->
    <div v-if="monitors.length" class="monitor__list">
      <div v-for="monitor in monitors" :key="monitor.id" class="monitor__item">
        <span class="monitor__item-main">
          <span class="monitor__item-head">
            <span class="monitor__name">{{ monitor.name }}</span>
            <t-tag :theme="STATUS_THEME[monitor.status]" variant="light" size="small">
              {{ statusText(monitor.status) }}
            </t-tag>
            <span class="monitor__type">{{ monitor.type }}</span>
          </span>
          <span class="monitor__target">{{ monitor.target }}</span>
          <span class="monitor__meta">
            <span v-if="monitor.lastLatency != null">{{ monitor.lastLatency }} ms</span>
            <span v-if="monitor.lastCheckAt">{{ monitor.lastCheckAt }}</span>
            <span v-if="monitor.lastError" class="monitor__error">{{ monitor.lastError }}</span>
          </span>
        </span>

        <span class="monitor__item-actions">
          <t-button variant="text" size="small" :loading="checkingId === monitor.id"
            @click="check(monitor)">
            {{ t('workspace.monitor.checkNow') }}
          </t-button>
          <t-button variant="text" size="small" @click="openHistory(monitor)">
            {{ t('workspace.monitor.history') }}
          </t-button>
          <t-button variant="text" size="small" @click="togglePause(monitor)">
            {{
              monitor.status === 'PAUSED'
                ? t('workspace.monitor.resume')
                : t('workspace.monitor.pause')
            }}
          </t-button>
          <t-button variant="text" size="small" @click="openEdit(monitor)">
            {{ t('workspace.monitor.edit') }}
          </t-button>
          <t-popconfirm :content="t('workspace.monitor.deleteConfirm')" @confirm="remove(monitor)">
            <t-button variant="text" size="small" theme="danger">
              {{ t('workspace.monitor.delete') }}
            </t-button>
          </t-popconfirm>
        </span>
      </div>
    </div>

    <p v-else-if="!loading" class="monitor__empty">{{ t('workspace.monitor.empty') }}</p>

    <!-- 新建 / 编辑 -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="dialogMode === 'create' ? t('workspace.monitor.create') : t('workspace.monitor.edit')"
      :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
      :cancel-btn="t('common.cancel')"
      width="520px"
      @confirm="submitDialog"
    >
      <t-form :data="form" label-align="top" :colon="false">
        <t-form-item :label="t('workspace.monitor.name')">
          <t-input v-model="form.name" :placeholder="t('workspace.monitor.namePlaceholder')" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.type')">
          <t-select v-model="form.type" :options="statusOptions" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.target')">
          <t-input v-model="form.target" :placeholder="t('workspace.monitor.targetPlaceholder')" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.interval')">
          <t-input-number v-model="form.interval" :min="10" :step="10" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.timeout')">
          <t-input-number v-model="form.timeout" :min="1000" :step="1000" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.expectedStatus')">
          <t-input-number v-model="form.expectedStatus" :min="100" :max="599" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.failureThreshold')">
          <t-input-number v-model="form.failureThreshold" :min="1" :max="10" />
        </t-form-item>
        <t-form-item :label="t('workspace.monitor.enabled')">
          <t-switch v-model="form.enabled" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 检查历史 -->
    <t-dialog
      v-model:visible="historyVisible"
      :header="`${t('workspace.monitor.history')} · ${historyName}`"
      :footer="false"
      width="560px"
    >
      <div v-if="history.length" class="monitor__history">
        <div v-for="log in history" :key="log.id" class="monitor__history-row">
          <t-tag :theme="log.success ? 'success' : 'danger'" variant="light" size="small">
            {{ log.success ? t('workspace.monitor.ok') : t('workspace.monitor.fail') }}
          </t-tag>
          <span class="monitor__history-latency">{{ log.latency }} ms</span>
          <span class="monitor__history-status">{{ log.statusCode ?? '—' }}</span>
          <span class="monitor__history-error">{{ log.error || '' }}</span>
          <span class="monitor__history-time">{{ log.checkedAt }}</span>
        </div>
      </div>
      <p v-else class="monitor__empty">
        {{ historyLoading ? t('common.loading') : t('workspace.monitor.historyEmpty') }}
      </p>
    </t-dialog>
  </div>
</template>

<style scoped lang="less">
.monitor {
  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  &__hint {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__summary {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: @beacon-gap-l;
    margin-bottom: @beacon-gap-l;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__stat-label {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__stat-value {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__list {
    display: flex;
    flex-direction: column;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;

    & + & {
      border-top: 1px solid @beacon-border;
    }
  }

  &__item-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__item-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__type {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-secondary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__target,
  &__meta {
    display: flex;
    gap: 12px;
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__error {
    color: @beacon-error;
  }

  &__item-actions {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
  }

  &__empty {
    margin: 0;
    padding: 48px 0;
    color: @beacon-text-tertiary;
    text-align: center;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__history {
    display: flex;
    flex-direction: column;
  }

  &__history-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;

    & + & {
      border-top: 1px solid @beacon-border;
    }
  }

  &__history-latency {
    flex: none;
    width: 72px;
  }

  &__history-status {
    flex: none;
    width: 48px;
  }

  &__history-error {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: @beacon-error;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__history-time {
    flex: none;
    color: @beacon-text-tertiary;
  }
}
</style>
