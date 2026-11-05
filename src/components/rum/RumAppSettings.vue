<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import {
  deleteRumSubject,
  getRumMaintenanceJob,
  purgeRumApp,
  rotateRumAppKey,
  setRumAppEnabled,
  updateRumApp,
} from '@/api/modules/rum'
import type { RumApp, RumMaintenanceJob } from '@/api/types/rum'
import { useRumContext } from '@/composables/useRumContext'
import { accessContext, isCurrentContext } from '@/utils/access-context'

const props = defineProps<{ app: RumApp }>()
const emit = defineEmits<{ updated: [] }>()
const { t } = useI18n()
const { projectId, appId, canManage, authorizeWrite } = useRumContext()
const name = ref(props.app.name)
const loading = ref(false)
const rotating = ref(false)
const purging = ref(false)
const deletingSubject = ref(false)
const rotatedKey = ref('')
const subjectEndUser = ref('')
const subjectAnonymous = ref('')
const job = ref<RumMaintenanceJob | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false
onScopeDispose(() => {
  disposed = true
  if (pollTimer) clearTimeout(pollTimer)
})
watch(
  () => props.app.name,
  (value) => {
    name.value = value
  },
)

async function save() {
  const value = name.value.trim()
  if (!value || value.length > 100 || loading.value) return
  const ctx = accessContext(),
    project = projectId.value,
    app = appId.value
  loading.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    await updateRumApp(project, app, { name: value })
    if (isCurrentContext(ctx) && !disposed) emit('updated')
  } catch {
    if (isCurrentContext(ctx))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    loading.value = false
  }
}

async function applyToggle() {
  if (loading.value) return
  const ctx = accessContext(),
    project = projectId.value,
    app = appId.value,
    enabled = !props.app.enabled
  loading.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    await setRumAppEnabled(project, app, enabled)
    if (isCurrentContext(ctx) && !disposed) emit('updated')
  } catch {
    if (isCurrentContext(ctx))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    loading.value = false
  }
}

/** 启停采集的影响面较大，用与租户/应用列表一致的确认弹窗 */
function toggle() {
  if (loading.value) return
  confirmDialog(
    t(props.app.enabled ? 'rumApps.disable' : 'rumApps.enable'),
    t(props.app.enabled ? 'rumApps.disableConfirm' : 'rumApps.enableConfirm', {
      name: props.app.name,
    }),
    props.app.enabled ? 'warning' : 'default',
    () => void applyToggle(),
  )
}

function confirmDialog(
  header: string,
  body: string,
  theme: 'warning' | 'danger' | 'default',
  onConfirm: () => void,
) {
  const dialog = DialogPlugin.confirm({
    header,
    body,
    theme,
    confirmBtn: t('common.confirm'),
    cancelBtn: t('common.cancel'),
    onConfirm: () => {
      dialog.destroy()
      onConfirm()
    },
    onCancel: () => dialog.destroy(),
    onClose: () => dialog.destroy(),
  })
}

async function applyRotate() {
  if (rotating.value) return
  const ctx = accessContext(),
    project = projectId.value,
    app = appId.value
  rotating.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    const updated = await rotateRumAppKey(project, app)
    if (isCurrentContext(ctx) && !disposed) {
      rotatedKey.value = updated.publicKey
      emit('updated')
      void MessagePlugin.success(t('rum.keyRotated'))
    }
  } catch {
    if (isCurrentContext(ctx))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    rotating.value = false
  }
}

function rotate() {
  confirmDialog(
    t('rum.rotateKey'),
    t('rum.rotateKeyConfirm'),
    'danger',
    () => void applyRotate(),
  )
}

function watchJob(id: string) {
  const tick = async () => {
    if (disposed) return
    try {
      const current = await getRumMaintenanceJob(
        projectId.value,
        appId.value,
        id,
      )
      if (disposed) return
      job.value = current
      if (current.status === 'PENDING' || current.status === 'RUNNING')
        pollTimer = setTimeout(tick, 2000)
    } catch {
      // Stop polling: the caller surfaces the failure through its own message.
    }
  }
  void tick()
}

async function applyPurge() {
  if (purging.value) return
  const ctx = accessContext(),
    project = projectId.value,
    app = appId.value
  purging.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    const created = await purgeRumApp(project, app)
    if (isCurrentContext(ctx) && !disposed) {
      job.value = created
      watchJob(created.id)
    }
  } catch {
    if (isCurrentContext(ctx))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    purging.value = false
  }
}

function purge() {
  confirmDialog(
    t('rum.purge'),
    t('rum.purgeConfirm'),
    'danger',
    () => void applyPurge(),
  )
}

async function applySubjectDeletion() {
  if (deletingSubject.value) return
  const ctx = accessContext(),
    project = projectId.value,
    app = appId.value
  deletingSubject.value = true
  try {
    if (!(await authorizeWrite()) || !isCurrentContext(ctx) || disposed) return
    const created = await deleteRumSubject(project, app, {
      ...(subjectEndUser.value.trim()
        ? { endUserId: subjectEndUser.value.trim() }
        : {}),
      ...(subjectAnonymous.value.trim()
        ? { anonymousId: subjectAnonymous.value.trim() }
        : {}),
    })
    if (isCurrentContext(ctx) && !disposed) {
      job.value = created
      watchJob(created.id)
    }
  } catch {
    if (isCurrentContext(ctx))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    deletingSubject.value = false
  }
}

function deleteSubject() {
  confirmDialog(
    t('rum.subjectDeletion'),
    t('rum.subjectDeletionConfirm'),
    'danger',
    () => void applySubjectDeletion(),
  )
}

const jobTheme = computed(() =>
  job.value?.status === 'FAILED'
    ? 'error'
    : job.value?.status === 'COMPLETED'
      ? 'success'
      : 'info',
)
const jobMessage = computed(() => {
  const current = job.value
  if (!current) return ''
  if (current.status === 'FAILED')
    return `${t('rum.jobFailed')}: ${current.error || '—'}`
  if (current.status === 'COMPLETED')
    return `${t('rum.jobCompleted')}: ${JSON.stringify(current.result ?? {})}`
  return t('rum.jobRunning')
})
</script>

<template>
  <t-card class="rum-app-settings">
    <template #title>{{ t('rumProject.settings') }}</template>
    <div class="rum-app-settings__form">
      <label class="rum-app-settings__field"
        >{{ t('rumApps.name')
        }}<t-input
          v-model="name"
          maxlength="100"
          :disabled="!canManage"
      /></label>
      <div class="rum-app-settings__row">
        <span class="rum-app-settings__label">{{
          t('rumProject.status')
        }}</span>
        <t-tag
          :theme="app.enabled ? 'success' : 'default'"
          variant="light"
          >{{ t(app.enabled ? 'rumApps.enabled' : 'rumApps.disabled') }}</t-tag
        >
      </div>
      <div
        v-if="canManage"
        class="rum-app-settings__actions"
      >
        <t-button
          theme="primary"
          :loading="loading"
          :disabled="!name.trim()"
          @click="save"
          >{{ t('rumApps.save') }}</t-button
        >
        <t-button
          variant="outline"
          :loading="loading"
          @click="toggle"
          >{{ t(app.enabled ? 'rumApps.disable' : 'rumApps.enable') }}</t-button
        >
      </div>
    </div>
  </t-card>

  <t-card
    v-if="canManage"
    class="rum-app-settings rum-app-settings--danger"
  >
    <template #title>{{ t('rum.dangerZone') }}</template>
    <div class="rum-app-settings__danger">
      <section>
        <h4>{{ t('rum.rotateKey') }}</h4>
        <p>{{ t('rum.rotateKeyHint') }}</p>
        <t-button
          theme="warning"
          variant="outline"
          :loading="rotating"
          @click="rotate"
          >{{ t('rum.rotateKey') }}</t-button
        >
        <t-alert
          v-if="rotatedKey"
          theme="success"
          :message="`${t('rum.newKey')}: ${rotatedKey}`"
        />
      </section>
      <section>
        <h4>{{ t('rum.purge') }}</h4>
        <p>{{ t('rum.purgeHint') }}</p>
        <t-button
          theme="danger"
          variant="outline"
          :loading="purging"
          @click="purge"
          >{{ t('rum.purge') }}</t-button
        >
      </section>
      <section>
        <h4>{{ t('rum.subjectDeletion') }}</h4>
        <p>{{ t('rum.subjectDeletionHint') }}</p>
        <t-input
          v-model="subjectEndUser"
          :placeholder="t('rum.endUserId')"
          maxlength="200"
        />
        <t-input
          v-model="subjectAnonymous"
          :placeholder="t('rum.anonymousId')"
          maxlength="200"
        />
        <t-button
          theme="danger"
          variant="outline"
          :loading="deletingSubject"
          :disabled="!subjectEndUser.trim() && !subjectAnonymous.trim()"
          @click="deleteSubject"
          >{{ t('rum.subjectDeletion') }}</t-button
        >
      </section>
      <t-alert
        v-if="job"
        :theme="jobTheme"
        :message="jobMessage"
      />
    </div>
  </t-card>
</template>

<style scoped lang="less">
.rum-app-settings {
  min-width: 0;

  & + & {
    margin-top: @beacon-gap-l;
  }

  &__form {
    display: grid;
    gap: @beacon-gap-l;
    max-width: 420px;
  }

  &__field {
    display: grid;
    gap: 8px;
    color: @beacon-text-secondary;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: @beacon-gap;
  }

  &__label {
    color: @beacon-text-secondary;
  }

  &__actions {
    display: flex;
    gap: @beacon-gap;
  }

  &__danger {
    display: grid;
    gap: @beacon-gap-l;
    max-width: 560px;

    section {
      display: grid;
      gap: 8px;
      padding: 14px 16px;
      border: 1px solid @beacon-border;
    }

    h4 {
      margin: 0;
    }

    p {
      margin: 0;
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    .t-button {
      justify-self: start;
    }
  }
}
</style>
