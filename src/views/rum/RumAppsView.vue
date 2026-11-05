<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import {
  createRumApp,
  listRumApps,
  setRumAppEnabled,
  updateRumApp,
} from '@/api/modules/rum'
import type { RumApp } from '@/api/types/rum'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { PlusSignIcon, RefreshIcon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  workspaceEpoch,
} from '@/utils/access-context'

defineOptions({ name: 'RumAppsView' })

const { t } = useI18n()
const org = useOrganizationStore()
const permissions = usePermissionsStore()
const apps = ref<RumApp[]>([])
const loading = ref(false)
const error = ref(false)
const submitting = ref(false)
const editorOpen = ref(false)
const edited = ref<RumApp | null>(null)
const name = ref('')
const projectId = computed(() => org.currentProjectId)
const canManage = computed(
  () =>
    org.currentProject?.status === 'ACTIVE' &&
    permissions.canProject(projectId.value, 'app.manage'),
)
let disposed = false
let generation = 0
let controller: AbortController | undefined

const columns = computed(() => [
  { colKey: 'name', title: t('rumProject.appName') },
  { colKey: 'platform', title: t('rumApps.platform'), width: 120 },
  { colKey: 'publicKey', title: t('rumApps.publicKey'), width: 240 },
  { colKey: 'enabled', title: t('rumProject.status'), width: 110 },
  { colKey: 'updatedAt', title: t('rum.updated'), width: 190 },
  ...(canManage.value ? [{ colKey: 'action', title: '', width: 160 }] : []),
])

async function reload() {
  const token = ++generation
  controller?.abort()
  controller = new AbortController()
  apps.value = []
  error.value = false
  if (!projectId.value) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const result = await listRumApps(projectId.value, {
      signal: controller.signal,
    })
    if (token === generation) apps.value = result
  } catch {
    if (token === generation) error.value = true
  } finally {
    if (token === generation) loading.value = false
  }
}
watch(
  [projectId, workspaceEpoch, permissionEpoch],
  () => {
    editorOpen.value = false
    edited.value = null
    name.value = ''
    void reload()
  },
  { immediate: true },
)
onScopeDispose(() => {
  disposed = true
  generation++
  controller?.abort()
})
function edit(app?: RumApp) {
  edited.value = app ?? null
  name.value = app?.name ?? ''
  editorOpen.value = true
}
async function allowed(id: string) {
  const authority = await permissions.ensureProject(id, true)
  return (
    id === projectId.value &&
    org.currentProject?.status === 'ACTIVE' &&
    authority?.capabilities['app.manage'] === true
  )
}
async function save() {
  const value = name.value.trim()
  if (!value || value.length > 100 || submitting.value) return
  const id = projectId.value
  const appId = edited.value?.id
  const context = accessContext()
  submitting.value = true
  try {
    if (!(await allowed(id)) || !isCurrentContext(context) || disposed) return
    if (appId) await updateRumApp(id, appId, { name: value })
    else await createRumApp(id, { name: value, platform: 'WEB' })
    if (!isCurrentContext(context) || id !== projectId.value) return
    editorOpen.value = false
    await reload()
  } catch {
    if (isCurrentContext(context))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    submitting.value = false
  }
}
async function applyToggle(app: RumApp) {
  if (submitting.value) return
  const id = projectId.value
  const context = accessContext()
  submitting.value = true
  try {
    if (!(await allowed(id)) || !isCurrentContext(context) || disposed) return
    await setRumAppEnabled(id, app.id, !app.enabled)
    if (isCurrentContext(context) && id === projectId.value) await reload()
  } catch {
    if (isCurrentContext(context))
      void MessagePlugin.error(t('rumApps.operationFailed'))
  } finally {
    submitting.value = false
  }
}
/** 启停是可逆但影响采集的开关，用与团队管理一致的确认弹窗代替原生 confirm */
function toggle(app: RumApp) {
  if (submitting.value) return
  const dialog = DialogPlugin.confirm({
    header: t(app.enabled ? 'rumApps.disable' : 'rumApps.enable'),
    body: t(app.enabled ? 'rumApps.disableConfirm' : 'rumApps.enableConfirm', {
      name: app.name,
    }),
    theme: app.enabled ? 'warning' : 'default',
    confirmBtn: t('common.confirm'),
    cancelBtn: t('common.cancel'),
    onConfirm: async () => {
      dialog.destroy()
      await applyToggle(app)
    },
    onCancel: () => dialog.destroy(),
    onClose: () => dialog.destroy(),
  })
}
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    void MessagePlugin.success(t('rumApps.copied'))
  } catch {
    void MessagePlugin.error(t('rumApps.operationFailed'))
  }
}
function formatTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '—'
}
function detail(app: RumApp) {
  return {
    name: 'rum-app-detail',
    params: { projectId: projectId.value, appId: app.id },
  }
}
</script>

<template>
  <section class="rum-apps">
    <HeaderActions>
      <t-tooltip :content="t('rum.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!projectId"
          :aria-label="t('rum.refresh')"
          @click="reload"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template
        ></t-button>
      </t-tooltip>
      <t-button
        v-if="canManage"
        @click="edit()"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('rumApps.create') }}</t-button
      >
    </HeaderActions>
    <t-card class="rum-apps__card">
      <template #title>{{ t('rumApps.title') }}</template>
      <template #actions>
        <span class="rum-apps__scope">
          {{ org.currentOrganization?.name ?? '-' }} /
          {{ org.currentProject?.name ?? '-' }}
        </span>
      </template>
      <t-alert
        v-if="error"
        theme="error"
        :message="t('rumApps.loadFailed')"
      >
        <t-button @click="reload">{{ t('rum.retry') }}</t-button>
      </t-alert>
      <t-table
        row-key="id"
        :data="apps"
        :columns="columns"
        :loading="loading"
        :empty="t('rumApps.empty')"
        hover
      >
        <template #name="{ row }"
          ><router-link
            class="rum-apps__name"
            :to="detail(row)"
            >{{ row.name }}</router-link
          ></template
        >
        <template #publicKey="{ row }"
          ><span class="rum-apps__key"
            ><code>{{ row.publicKey.slice(0, 8) }}…</code
            ><t-button
              size="small"
              variant="text"
              @click="copy(row.publicKey)"
              >{{ t('rumApps.copy') }}</t-button
            ></span
          ></template
        >
        <template #enabled="{ row }"
          ><t-tag
            :theme="row.enabled ? 'success' : 'default'"
            variant="light"
            >{{
              t(row.enabled ? 'rumApps.enabled' : 'rumApps.disabled')
            }}</t-tag
          ></template
        >
        <template #updatedAt="{ row }">{{
          formatTime(row.updatedAt)
        }}</template>
        <template #action="{ row }"
          ><t-link
            theme="primary"
            :disabled="submitting"
            @click="edit(row)"
            >{{ t('rumApps.edit') }}</t-link
          ><t-link
            class="rum-apps__toggle"
            theme="primary"
            :disabled="submitting"
            @click="toggle(row)"
            >{{ t(row.enabled ? 'rumApps.disable' : 'rumApps.enable') }}</t-link
          ></template
        >
      </t-table>
    </t-card>
    <t-dialog
      v-model:visible="editorOpen"
      :header="t(edited ? 'rumApps.edit' : 'rumApps.create')"
      :confirm-btn="t('rumApps.save')"
      :cancel-btn="t('rumApps.cancel')"
      :confirm-loading="submitting"
      @confirm="save"
    >
      <label
        class="rum-apps__field"
        for="rum-name"
        >{{ t('rumApps.name') }}</label
      ><t-input
        id="rum-name"
        v-model="name"
        maxlength="100"
        :placeholder="t('rumApps.namePlaceholder')"
      />
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.rum-apps {
  min-width: 0;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__name {
    color: @beacon-brand;
  }

  &__key {
    display: inline-flex;
    align-items: center;
    gap: @beacon-gap;
    color: @beacon-text-secondary;
  }

  &__toggle {
    margin-left: @beacon-gap-l;
  }

  &__field {
    display: block;
    margin-bottom: 8px;
    color: @beacon-text-secondary;
  }
}
</style>
