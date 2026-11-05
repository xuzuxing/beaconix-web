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
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { PlusSignIcon, RefreshIcon, Search01Icon } from '@/icons'
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
const search = ref('')
const status = ref<'all' | 'enabled' | 'disabled'>('all')
const page = ref(1)
const pageSize = ref(10)
const projectId = computed(() => org.currentProjectId)
const canManage = computed(
  () =>
    org.currentProject?.status === 'ACTIVE' &&
    permissions.canProject(projectId.value, 'app.manage'),
)
const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return apps.value.filter((app) => {
    if (keyword && !app.name.toLowerCase().includes(keyword)) return false
    if (status.value === 'enabled' && !app.enabled) return false
    if (status.value === 'disabled' && app.enabled) return false
    return true
  })
})
const currentPage = computed(() =>
  Math.min(
    page.value,
    Math.max(1, Math.ceil(filtered.value.length / pageSize.value)),
  ),
)
const rows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
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
    if (token === generation) {
      apps.value = result
      page.value = 1
    }
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
    search.value = ''
    status.value = 'all'
    page.value = 1
    void reload()
  },
  { immediate: true },
)
watch([search, status], () => {
  page.value = 1
})
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
function paginate({
  current,
  pageSize: size,
}: {
  current: number
  pageSize: number
}) {
  page.value = current
  pageSize.value = size
}
function resetFilters() {
  search.value = ''
  status.value = 'all'
  page.value = 1
}
</script>

<template>
  <section class="rum-apps">
    <HeaderActions>
      <t-tooltip :content="t('rumApps.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!projectId"
          :aria-label="t('rumApps.refresh')"
          @click="reload"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
      <t-button
        v-if="canManage"
        :disabled="!projectId"
        @click="edit()"
      >
        <template #icon><AppIcon :icon="PlusSignIcon" /></template>
        {{ t('rumApps.create') }}
      </t-button>
    </HeaderActions>

    <t-card class="rum-apps__panel">
      <template #title>{{ t('rumApps.title') }}</template>
      <template #actions>
        <span class="rum-apps__scope">
          {{ org.currentOrganization?.name ?? '-' }} /
          {{ org.currentProject?.name ?? '-' }}
        </span>
      </template>

      <div class="rum-apps__filters">
        <t-input
          v-model="search"
          clearable
          :placeholder="t('rumApps.search')"
          :aria-label="t('rumApps.search')"
        >
          <template #prefix-icon><AppIcon :icon="Search01Icon" /></template>
        </t-input>
        <t-select
          v-model="status"
          :aria-label="t('rumApps.allStatuses')"
          :options="[
            { label: t('rumApps.allStatuses'), value: 'all' },
            { label: t('rumApps.enabled'), value: 'enabled' },
            { label: t('rumApps.disabled'), value: 'disabled' },
          ]"
        />
      </div>

      <div
        v-if="error"
        class="rum-apps__empty"
      >
        <t-alert
          theme="error"
          :message="t('rumApps.loadFailed')"
        />
        <t-button @click="reload">{{ t('rum.retry') }}</t-button>
      </div>
      <div
        v-else-if="loading"
        class="rum-apps__empty"
      >
        <t-loading :text="t('common.loading')" />
      </div>
      <div
        v-else-if="!projectId"
        class="rum-apps__empty"
      >
        {{ t('rumProject.noProject') }}
      </div>
      <template v-else-if="rows.length">
        <div class="rum-apps__table">
          <div class="rum-apps__table-head">
            <span>{{ t('rumApps.name') }}</span>
            <span>{{ t('rumApps.publicKey') }}</span>
            <span>{{ t('rum.updated') }}</span>
            <span>{{ t('rumApps.actions') }}</span>
          </div>
          <article
            v-for="app in rows"
            :key="app.id"
            class="rum-apps__item"
          >
            <div class="rum-apps__identity">
              <div class="rum-apps__name">
                <RouterLink
                  :to="{
                    name: 'rum-app-detail',
                    params: { projectId, appId: app.id },
                  }"
                >
                  {{ app.name }}
                </RouterLink>
                <t-tag
                  :theme="app.enabled ? 'success' : 'default'"
                  variant="light"
                >
                  {{ t(app.enabled ? 'rumApps.enabled' : 'rumApps.disabled') }}
                </t-tag>
                <span class="rum-apps__platform">{{ app.platform }}</span>
              </div>
              <p class="rum-apps__created">
                {{ t('rumApps.createdAt') }}: {{ app.createdAt }}
              </p>
            </div>
            <div class="rum-apps__key">
              <code>{{ app.publicKey.slice(0, 12) }}…</code>
              <t-button
                size="small"
                variant="text"
                @click="copy(app.publicKey)"
              >
                {{ t('rumApps.copy') }}
              </t-button>
            </div>
            <time class="rum-apps__time">{{ app.updatedAt }}</time>
            <div
              v-if="canManage"
              class="rum-apps__actions"
            >
              <t-button
                size="small"
                variant="text"
                :disabled="submitting"
                @click="edit(app)"
              >
                {{ t('rumApps.edit') }}
              </t-button>
              <t-button
                size="small"
                variant="text"
                :disabled="submitting"
                @click="toggle(app)"
              >
                {{ t(app.enabled ? 'rumApps.disable' : 'rumApps.enable') }}
              </t-button>
            </div>
            <span
              v-else
              class="rum-apps__actions"
            >-</span>
          </article>
        </div>
        <t-pagination
          :total="filtered.length"
          :current="currentPage"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>
      <div
        v-else
        class="rum-apps__empty"
      >
        <p>{{ t(apps.length ? 'rumApps.noMatches' : 'rumApps.empty') }}</p>
        <t-button
          v-if="apps.length"
          variant="outline"
          @click="resetFilters"
        >
          {{ t('rumApps.reset') }}
        </t-button>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="editorOpen"
      :header="t(edited ? 'rumApps.edit' : 'rumApps.create')"
      :confirm-btn="t('rumApps.save')"
      :cancel-btn="t('rumApps.cancel')"
      :confirm-loading="submitting"
      @confirm="save"
    >
      <label for="rum-name">{{ t('rumApps.name') }}</label>
      <t-input
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

  &__panel {
    min-width: 0;
  }

  &__filters {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 150px;
    gap: 8px;
    margin-bottom: 16px;
  }

  // 表头与行之间用 1px 分割线；白底与边框由卡片（.t-card）提供
  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .rum-apps__item {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 190px 168px 128px;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    color: @beacon-text-secondary;
    font-size: 12px;
    background: @beacon-bg-page;
  }

  &__item:hover {
    background: @beacon-bg-page;
  }

  &__identity {
    min-width: 0;
  }

  &__name {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;

    a {
      color: @beacon-text-primary;
      font-weight: 600;
      overflow-wrap: anywhere;

      &:hover {
        color: @beacon-brand;
      }
    }
  }

  &__platform {
    color: @beacon-text-tertiary;
    font-size: 11px;
  }

  &__created {
    margin: 6px 0 0;
    overflow: hidden;
    color: @beacon-text-secondary;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__key {
    display: flex;
    gap: 4px;
    align-items: center;
    min-width: 0;

    code {
      overflow: hidden;
      color: @beacon-text-secondary;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__time {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__actions {
    display: flex;
    gap: 4px;
    align-items: center;
    min-height: 24px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    min-height: 240px;
  }

  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

@media (max-width: 1200px) {
  .rum-apps__table-head,
  .rum-apps .rum-apps__item {
    grid-template-columns: minmax(180px, 1fr) 160px 128px;
  }

  .rum-apps__table-head > :nth-child(3),
  .rum-apps__time {
    display: none;
  }
}

@media (max-width: 700px) {
  .rum-apps__filters {
    grid-template-columns: minmax(0, 1fr) 130px;
  }

  .rum-apps__table-head {
    display: none;
  }

  .rum-apps .rum-apps__item {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 16px 8px;
  }

  .rum-apps__identity {
    grid-column: 1 / -1;
  }

  .rum-apps__key {
    grid-column: 1 / -1;
  }
}
</style>
