<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  createRumApp,
  listRumApps,
  setRumAppEnabled,
  updateRumApp,
} from '@/api/modules/rum'
import type { RumApp } from '@/api/types/rum'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  workspaceEpoch,
} from '@/utils/access-context'

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
async function toggle(app: RumApp) {
  if (submitting.value) return
  if (
    !window.confirm(
      t(app.enabled ? 'rumApps.disableConfirm' : 'rumApps.enableConfirm', {
        name: app.name,
      }),
    )
  )
    return
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
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    void MessagePlugin.success(t('rumApps.copied'))
  } catch {
    void MessagePlugin.error(t('rumApps.operationFailed'))
  }
}
</script>

<template>
  <section class="rum-apps">
    <header class="rum-apps__header">
      <div>
        <h1>{{ t('rumApps.title') }}</h1>
        <p>{{ t('rumApps.subtitle') }}</p>
      </div>
      <t-button
        v-if="canManage"
        theme="primary"
        @click="edit()"
        >{{ t('rumApps.create') }}</t-button
      >
    </header>
    <t-loading :loading="loading">
      <t-alert
        v-if="error"
        theme="error"
        :message="t('rumApps.loadFailed')"
      />
      <t-empty
        v-else-if="!loading && apps.length === 0"
        :description="t('rumApps.empty')"
      />
      <div
        v-else
        class="rum-apps__list"
      >
        <article
          v-for="app in apps"
          :key="app.id"
          class="rum-apps__item"
        >
          <div class="rum-apps__main">
            <router-link
              :to="{
                name: 'rum-app-detail',
                params: { projectId, appId: app.id },
              }"
              ><strong>{{ app.name }}</strong></router-link
            ><t-tag
              :theme="app.enabled ? 'success' : 'default'"
              variant="light"
              >{{
                t(app.enabled ? 'rumApps.enabled' : 'rumApps.disabled')
              }}</t-tag
            ><span>{{ app.platform }}</span>
          </div>
          <div class="rum-apps__key">
            {{ t('rumApps.publicKey') }}:
            <code>{{ app.publicKey.slice(0, 8) }}…</code
            ><t-button
              size="small"
              variant="text"
              @click="copy(app.publicKey)"
              >{{ t('rumApps.copy') }}</t-button
            >
          </div>
          <span>{{ t('rum.updated') }}: {{ app.updatedAt }}</span>
          <div
            v-if="canManage"
            class="rum-apps__actions"
          >
            <t-button
              variant="text"
              :disabled="submitting"
              @click="edit(app)"
              >{{ t('rumApps.edit') }}</t-button
            ><t-button
              variant="text"
              :disabled="submitting"
              @click="toggle(app)"
              >{{
                t(app.enabled ? 'rumApps.disable' : 'rumApps.enable')
              }}</t-button
            >
          </div>
        </article>
      </div>
    </t-loading>
    <t-dialog
      v-model:visible="editorOpen"
      :header="t(edited ? 'rumApps.edit' : 'rumApps.create')"
      :confirm-btn="t('rumApps.save')"
      :cancel-btn="t('rumApps.cancel')"
      :confirm-loading="submitting"
      @confirm="save"
    >
      <label for="rum-name">{{ t('rumApps.name') }}</label
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
}
.rum-apps__header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  margin-bottom: 24px;
}
.rum-apps__header h1 {
  margin: 0;
  font-size: 22px;
}
.rum-apps__header p {
  color: var(--td-text-color-secondary);
}
.rum-apps__list {
  display: grid;
  gap: 12px;
}
.rum-apps__item {
  border: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
}
.rum-apps__main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 180px;
}
.rum-apps__key {
  color: var(--td-text-color-secondary);
}
.rum-apps__actions {
  display: flex;
}
@media (max-width: 600px) {
  .rum-apps__item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
