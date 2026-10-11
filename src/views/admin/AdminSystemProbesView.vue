<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  CreateSystemProbeParams,
  ProbeValidationChallenge,
  SystemProbe,
  SystemProbeAssignments,
} from '@/api/types/admin'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import SystemProbeEditorDialog from '@/components/admin/SystemProbeEditorDialog.vue'
import SystemProbeRebalanceDialog from '@/components/admin/SystemProbeRebalanceDialog.vue'
import SystemProbeSecretDialog from '@/components/admin/SystemProbeSecretDialog.vue'
import SystemProbeValidateDialog from '@/components/admin/SystemProbeValidateDialog.vue'
import { useAdminProbes } from '@/composables/useAdminProbes'
import { Exchange01Icon, PlusSignIcon, RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import {
  probeLivenessTheme,
  probeMonitorCount,
  probeProviderLabelKey,
  probeProviderTheme,
} from '@/utils/admin-presenter'
import { shortId } from '@/utils/team-presenter'

/** 系统探针：列表、新建 / 编辑、启停、联通校验、删除与重平衡。仅 SUPER_ADMIN。 */
defineOptions({ name: 'AdminSystemProbesView' })

const { t } = useI18n()
const userStore = useUserStore()
const {
  probes,
  filtered,
  loading,
  error,
  keyword,
  liveness,
  busyId,
  load,
  livenessOf,
  create,
  update,
  remove,
  toggle,
  validate,
  rebalance,
} = useAdminProbes()

const livenessOptions = computed(() => [
  { label: t('adminPage.probe.filterAll'), value: 'all' },
  { label: t('adminPage.probe.filterOnline'), value: 'online' },
  { label: t('adminPage.probe.filterStale'), value: 'stale' },
  { label: t('adminPage.probe.filterOffline'), value: 'offline' },
])

// ---------- 新建 / 编辑 ----------
const editorVisible = ref(false)
const editing = ref<SystemProbe | null>(null)
const submitting = ref(false)
const submitError = ref('')

function openCreate() {
  editing.value = null
  submitError.value = ''
  editorVisible.value = true
}

function openEdit(probe: SystemProbe) {
  editing.value = probe
  submitError.value = ''
  editorVisible.value = true
}

async function submitProbe(data: CreateSystemProbeParams) {
  submitting.value = true
  submitError.value = ''
  try {
    if (editing.value) {
      await update(editing.value.id, data)
      MessagePlugin.success(t('adminPage.probe.updated'))
      editorVisible.value = false
    } else {
      const created = await create(data)
      MessagePlugin.success(t('adminPage.probe.created'))
      editorVisible.value = false
      // 共享密钥只在创建响应里出现一次
      if (created.secret) {
        secret.value = created.secret
        secretName.value = created.name
        secretVisible.value = true
      }
    }
  } catch (cause) {
    submitError.value = cause instanceof Error ? cause.message : t('adminPage.probe.saveFailed')
  } finally {
    submitting.value = false
  }
}

// ---------- 共享密钥（仅创建时可见） ----------
const secretVisible = ref(false)
const secret = ref('')
const secretName = ref('')

// ---------- 联通校验 ----------
const validateVisible = ref(false)
const challenge = ref<ProbeValidationChallenge | null>(null)
const validatingName = ref('')

async function runValidate(probe: SystemProbe) {
  try {
    challenge.value = await validate(probe.id)
    validatingName.value = probe.name
    validateVisible.value = true
    MessagePlugin.success(t('adminPage.probe.validateDone'))
  } catch {
    // 请求层已统一提示错误
  }
}

// ---------- 启停 ----------
async function onToggle(probe: SystemProbe, value: unknown) {
  const enabled = Boolean(value)
  try {
    await toggle(probe, enabled)
    MessagePlugin.success(
      enabled ? t('adminPage.probe.enabled') : t('adminPage.probe.disabled'),
    )
  } catch {
    // 失败时列表未变，开关会自动回到原值
  }
}

// ---------- 删除 ----------
const removing = ref<SystemProbe | null>(null)
const removeVisible = ref(false)

function askRemove(probe: SystemProbe) {
  removing.value = probe
  removeVisible.value = true
}

async function confirmRemove() {
  const probe = removing.value
  if (!probe) return
  try {
    await remove(probe.id)
    MessagePlugin.success(t('adminPage.probe.removed'))
    removeVisible.value = false
    removing.value = null
  } catch {
    // 请求层已统一提示错误
  }
}

// ---------- 重平衡 ----------
const rebalanceVisible = ref(false)
const assignments = ref<SystemProbeAssignments>({})

async function runRebalance() {
  try {
    assignments.value = await rebalance()
    rebalanceVisible.value = true
    MessagePlugin.success(
      t('adminPage.probe.rebalanceDone', {
        count: Object.values(assignments.value).filter((ids) => ids?.length).length,
      }),
    )
  } catch {
    // 请求层已统一提示错误
  }
}

onMounted(() => {
  if (userStore.isSuperAdmin) void load()
})
</script>

<template>
  <section class="admin-probes">
    <HeaderActions>
      <t-tooltip :content="t('adminPage.probe.rebalance')">
        <t-button
          variant="outline"
          shape="square"
          :disabled="!userStore.isSuperAdmin || loading"
          :aria-label="t('adminPage.probe.rebalance')"
          @click="runRebalance"
        >
          <template #icon><AppIcon :icon="Exchange01Icon" /></template>
        </t-button>
      </t-tooltip>
      <t-tooltip :content="t('adminPage.common.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!userStore.isSuperAdmin"
          :aria-label="t('adminPage.common.refresh')"
          @click="load"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
      <t-button :disabled="!userStore.isSuperAdmin" @click="openCreate">
        <template #icon><AppIcon :icon="PlusSignIcon" /></template>
        {{ t('adminPage.probe.create') }}
      </t-button>
    </HeaderActions>

    <t-alert v-if="!userStore.isSuperAdmin" theme="info" :message="t('adminPage.common.noPermission')" />

    <t-card v-else class="admin-probes__panel">
      <template #title>{{ t('adminPage.probe.title') }}</template>
      <p class="admin-probes__subtitle">{{ t('adminPage.probe.subtitle') }}</p>

      <div class="admin-probes__filters">
        <t-input
          v-model="keyword"
          clearable
          :placeholder="t('adminPage.probe.search')"
          :aria-label="t('adminPage.probe.search')"
        />
        <t-select
          v-model="liveness"
          :options="livenessOptions"
          :aria-label="t('adminPage.probe.liveness')"
        />
      </div>

      <div v-if="error" class="admin-probes__state">
        <t-alert theme="error" :message="error" />
        <t-button variant="outline" @click="load">{{ t('adminPage.common.refresh') }}</t-button>
      </div>

      <div v-else-if="loading && !probes.length" class="admin-probes__state">
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="filtered.length">
        <div class="admin-probes__table">
          <div class="admin-probes__table-head">
            <span>{{ t('adminPage.common.name') }}</span>
            <span>{{ t('adminPage.probe.provider') }}</span>
            <span>{{ t('adminPage.probe.region') }}</span>
            <span>{{ t('adminPage.probe.liveness') }}</span>
            <span>{{ t('adminPage.probe.enabledLabel') }}</span>
            <span>{{ t('adminPage.probe.maxTenants') }}</span>
            <span>{{ t('adminPage.probe.priority') }}</span>
            <span>{{ t('adminPage.probe.lastHeartbeat') }}</span>
            <span>{{ t('adminPage.probe.monitors') }}</span>
            <span>{{ t('adminPage.common.actions') }}</span>
          </div>
          <div v-for="probe in filtered" :key="probe.id" class="admin-probes__row">
            <span class="admin-probes__identity">
              <span class="admin-probes__name">{{ probe.name }}</span>
              <span class="admin-probes__id" :title="probe.callbackUrl">{{ shortId(probe.id) }}</span>
            </span>
            <span>
              <t-tag size="small" variant="light" :theme="probeProviderTheme(probe.provider)">
                {{ t(probeProviderLabelKey(probe.provider)) }}
              </t-tag>
            </span>
            <span class="admin-probes__region">{{ probe.region }}</span>
            <span>
              <t-tag
                size="small"
                variant="light"
                :theme="probeLivenessTheme(livenessOf(probe))"
              >
                {{ t(`adminPage.probe.livenessLabel.${livenessOf(probe)}`) }}
              </t-tag>
            </span>
            <span>
              <t-switch
                :value="probe.enabled"
                :loading="busyId === probe.id"
                @change="(value: unknown) => onToggle(probe, value)"
              />
            </span>
            <span>{{ probe.maxTenants ?? 0 }}</span>
            <span>{{ probe.priority }}</span>
            <span class="admin-probes__heartbeat">
              {{ probe.lastHeartbeat ? formatDateTime(probe.lastHeartbeat) : t('adminPage.probe.heartbeatNever') }}
            </span>
            <span class="admin-probes__monitors">
              {{ probeMonitorCount(probe) }}
              <template v-if="probe.resultCount != null">
                / {{ probe.resultCount }}
              </template>
            </span>
            <span class="admin-probes__actions">
              <t-button variant="text" size="small" @click="openEdit(probe)">
                {{ t('adminPage.probe.edit') }}
              </t-button>
              <t-button
                variant="text"
                size="small"
                :loading="busyId === probe.id"
                @click="runValidate(probe)"
              >
                {{ t('adminPage.probe.validate') }}
              </t-button>
              <t-button variant="text" size="small" @click="askRemove(probe)">
                {{ t('adminPage.probe.remove') }}
              </t-button>
            </span>
          </div>
        </div>
      </template>

      <div v-else class="admin-probes__state">
        <p class="admin-probes__empty">
          {{ probes.length ? t('adminPage.common.noMatches') : t('adminPage.probe.empty') }}
        </p>
      </div>
    </t-card>

    <SystemProbeEditorDialog
      v-model:visible="editorVisible"
      :probe="editing"
      :submitting="submitting"
      :error="submitError"
      @submit="submitProbe"
    />

    <SystemProbeSecretDialog
      v-model:visible="secretVisible"
      :secret="secret"
      :probe-name="secretName"
    />

    <SystemProbeValidateDialog
      v-model:visible="validateVisible"
      :challenge="challenge"
      :probe-name="validatingName"
    />

    <SystemProbeRebalanceDialog
      v-model:visible="rebalanceVisible"
      :assignments="assignments"
      :probes="probes"
    />

    <t-dialog
      v-model:visible="removeVisible"
      :header="t('adminPage.probe.remove')"
      width="min(480px, calc(100vw - 32px))"
      :confirm-btn="{ content: t('adminPage.common.confirm'), loading: busyId === removing?.id }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="confirmRemove"
    >
      <p class="admin-probes__confirm">
        {{ t('adminPage.probe.removeConfirm', { name: removing?.name ?? '' }) }}
      </p>
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.admin-probes {
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__subtitle {
    margin: 0 0 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__filters {
    display: grid;
    grid-template-columns: minmax(200px, 320px) 160px;
    gap: 8px;
  }

  &__table {
    margin-top: 16px;
    overflow-x: auto;
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns: minmax(170px, 1.3fr) 110px 130px 110px 80px 92px 72px 160px 96px 200px;
    gap: 12px;
    align-items: center;
    min-width: 1280px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__identity {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__id,
  &__region,
  &__heartbeat,
  &__monitors {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__confirm {
    margin: 0;
    color: @beacon-text-primary;
  }
}

@media (max-width: 720px) {
  .admin-probes__filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
