<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  createRumApp,
  getProjectRumOverview,
  listRumApps,
  setRumAppEnabled,
  updateRumApp,
} from '@/api/modules/rum'
import type { RumApp, RumProjectOverview } from '@/api/types/rum'
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

/**
 * 前端监控入口：项目内的应用卡片列表。
 * 点卡片进入应用工作台（/rum/:projectId/:appId/*），左侧切换成应用内导航；
 * 项目级（跨应用）查询的入口收在本页顶部，不再占用左侧二级菜单。
 */
const { t } = useI18n()
const router = useRouter()
const org = useOrganizationStore()
const permissions = usePermissionsStore()
const apps = ref<RumApp[]>([])
const overview = ref<RumProjectOverview | null>(null)
const loading = ref(false)
const error = ref(false)
const submitting = ref(false)
const editorOpen = ref(false)
const edited = ref<RumApp | null>(null)
const name = ref('')
const search = ref('')
const status = ref<'all' | 'enabled' | 'disabled'>('all')
const page = ref(1)
const pageSize = ref(12)
const projectId = computed(() => org.currentProjectId)
const canManage = computed(
  () =>
    org.currentProject?.status === 'ACTIVE' &&
    permissions.canProject(projectId.value, 'app.manage'),
)
const canReadApps = computed(() => permissions.canProject(projectId.value, 'app.read'))
const canReadRum = computed(() => permissions.canProject(projectId.value, 'rum.read'))
const projectShortcuts = computed(() => [
  { path: '/rum/overview', label: t('rumProject.overview') },
  { path: '/rum/errors', label: t('rumProject.errors') },
  { path: '/rum/events', label: t('rumProject.events') },
])
const stats = computed(() => {
  const map = new Map<string, { errorGroups: number; events7d: number }>()
  for (const item of overview.value?.apps ?? []) {
    map.set(item.id, { errorGroups: item.errorGroups, events7d: item.events7d })
  }
  return map
})
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
  Math.min(page.value, Math.max(1, Math.ceil(filtered.value.length / pageSize.value))),
)
const visibleApps = computed(() => {
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
  overview.value = null
  error.value = false
  if (!projectId.value) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const [list, summary] = await Promise.all([
      listRumApps(projectId.value, { signal: controller.signal }),
      // 卡片上的错误组/事件数来自概览聚合；聚合失败不影响列表本身
      getProjectRumOverview(projectId.value, { signal: controller.signal }).catch(() => null),
    ])
    if (token === generation) {
      apps.value = list
      overview.value = summary
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
function formatTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'
}
function appTarget(app: RumApp) {
  return {
    name: 'rum-app-section',
    params: { projectId: projectId.value, appId: app.id, section: 'errors' },
  }
}
function openApp(app: RumApp) {
  void router.push(appTarget(app))
}
function edit(app?: RumApp) {
  edited.value = app ?? null
  name.value = app?.name ?? ''
  editorOpen.value = true
}
function openSettings(app: RumApp) {
  edit(app)
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
    if (isCurrentContext(context)) void MessagePlugin.error(t('rumApps.operationFailed'))
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
    if (isCurrentContext(context)) void MessagePlugin.error(t('rumApps.operationFailed'))
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
function paginate({ current, pageSize: size }: { current: number; pageSize: number }) {
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

      <nav
        v-if="canReadRum"
        class="rum-apps__shortcuts"
        :aria-label="t('rumApps.crossApp')"
      >
        <span>{{ t('rumApps.crossApp') }}</span>
        <RouterLink
          v-for="item in projectShortcuts"
          :key="item.path"
          :to="item.path"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

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
        <span class="rum-apps__count">{{ t('rumApps.total', { count: filtered.length }) }}</span>
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
      <div
        v-else-if="!canReadApps"
        class="rum-apps__empty"
      >
        <t-alert
          theme="warning"
          :message="t('rumApps.noAppPermission')"
        />
      </div>
      <template v-else-if="visibleApps.length">
        <div class="rum-apps__grid">
          <article
            v-for="app in visibleApps"
            :key="app.id"
            class="app-card"
            @click="openApp(app)"
          >
            <header class="app-card__head">
              <RouterLink
                class="app-card__name"
                :to="appTarget(app)"
                @click.stop
              >
                {{ app.name }}
              </RouterLink>
              <t-tag
                size="small"
                variant="light"
                :theme="app.enabled ? 'success' : 'default'"
              >
                {{ t(app.enabled ? 'rumApps.enabled' : 'rumApps.disabled') }}
              </t-tag>
            </header>
            <p class="app-card__meta">
              <span class="app-card__platform">{{ app.platform }}</span>
              <span>{{ t('rumApps.createdAt') }}: {{ formatTime(app.createdAt) }}</span>
            </p>

            <dl class="app-card__stats">
              <div>
                <dt>{{ t('rumProject.errorGroups') }}</dt>
                <dd>{{ stats.get(app.id)?.errorGroups ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ t('rumProject.events7d') }}</dt>
                <dd>{{ stats.get(app.id)?.events7d ?? '—' }}</dd>
              </div>
            </dl>

            <p class="app-card__key">
              <span>{{ t('rumApps.publicKey') }}</span>
              <code>{{ app.publicKey.slice(0, 12) }}…</code>
              <t-button
                size="small"
                variant="text"
                @click.stop="copy(app.publicKey)"
              >
                {{ t('rumApps.copy') }}
              </t-button>
            </p>

            <footer class="app-card__foot">
              <span class="app-card__open">{{ t('rumApps.enter') }} →</span>
              <t-button
                v-if="canManage"
                size="small"
                variant="outline"
                :disabled="submitting"
                @click.stop="openSettings(app)"
              >
                {{ t('rumApps.settings') }}
              </t-button>
            </footer>
          </article>
        </div>
        <t-pagination
          :total="filtered.length"
          :current="currentPage"
          :page-size="pageSize"
          :page-size-options="[12, 24, 48]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>
      <div
        v-else
        class="rum-apps__empty"
      >
        <template v-if="apps.length">
          <p>{{ t('rumApps.noMatches') }}</p>
          <t-button
            variant="outline"
            @click="resetFilters"
          >
            {{ t('rumApps.reset') }}
          </t-button>
        </template>
        <template v-else>
          <h3 class="rum-apps__empty-title">{{ t('rumApps.empty') }}</h3>
          <p class="rum-apps__empty-hint">{{ t('rumApps.emptyHint') }}</p>
          <t-button
            v-if="canManage"
            theme="primary"
            @click="edit()"
          >
            <template #icon><AppIcon :icon="PlusSignIcon" /></template>
            {{ t('rumApps.createFirst') }}
          </t-button>
        </template>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="editorOpen"
      :header="t(edited ? 'rumApps.settings' : 'rumApps.create')"
      :confirm-btn="t('rumApps.save')"
      :cancel-btn="t('rumApps.cancel')"
      :confirm-loading="submitting"
      :confirm-disabled="!name.trim()"
      width="520px"
      @confirm="save"
    >
      <div class="app-editor">
        <label
          for="rum-name"
          class="app-editor__label"
          >{{ t('rumApps.name') }}</label
        >
        <t-input
          id="rum-name"
          v-model="name"
          maxlength="100"
          :placeholder="t('rumApps.namePlaceholder')"
        />
        <template v-if="edited">
          <div class="app-editor__status">
            <span>{{ t('rumProject.status') }}</span>
            <t-tag
              size="small"
              variant="light"
              :theme="edited.enabled ? 'success' : 'default'"
            >
              {{ t(edited.enabled ? 'rumApps.enabled' : 'rumApps.disabled') }}
            </t-tag>
            <t-button
              size="small"
              variant="outline"
              :loading="submitting"
              @click="toggle(edited)"
            >
              {{ t(edited.enabled ? 'rumApps.disable' : 'rumApps.enable') }}
            </t-button>
          </div>
          <p class="app-editor__hint">{{ t('rumApps.settingsHint') }}</p>
        </template>
      </div>
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

  &__shortcuts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid @beacon-border;
    font-size: 12px;

    > span {
      color: @beacon-text-tertiary;
    }

    a {
      color: @beacon-text-primary;

      &:hover {
        color: @beacon-brand;
      }
    }
  }

  &__filters {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 150px auto;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__count {
    color: @beacon-text-tertiary;
    font-size: 12px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 16px;
    min-height: 240px;
    text-align: center;
  }

  &__empty-title {
    margin: 0;
    font-size: 15px;
    font-weight: @beacon-font-weight-medium;
  }

  &__empty-hint {
    max-width: 420px;
    margin: 0;
    color: @beacon-text-secondary;
    font-size: 12px;
    line-height: 20px;
  }

  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

.app-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid @beacon-border;
  border-radius: @beacon-radius-m;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover,
  &:focus-within {
    border-color: @beacon-brand;
    box-shadow: 0 2px 10px rgb(0 0 0 / 6%);
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  &__name {
    min-width: 0;
    overflow-wrap: anywhere;
    color: @beacon-text-primary;
    font-size: 15px;
    font-weight: 600;

    &:hover {
      color: @beacon-brand;
    }
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin: 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }

  &__platform {
    padding: 0 6px;
    color: @beacon-text-secondary;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
    padding: 12px 0;
    border-top: 1px solid @beacon-border;
    border-bottom: 1px solid @beacon-border;

    dt {
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    dd {
      margin: 4px 0 0;
      font-size: 18px;
      line-height: 24px;
      font-variant-numeric: tabular-nums;
    }
  }

  &__key {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: @beacon-text-secondary;
    font-size: 12px;

    code {
      overflow: hidden;
      font-family: @beacon-font-family-code;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__open {
    color: @beacon-brand;
    font-size: 12px;
  }
}

.app-editor {
  display: grid;
  gap: 8px;

  &__label {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid @beacon-border;
    font-size: 12px;

    > span:first-child {
      color: @beacon-text-secondary;
    }
  }

  &__hint {
    margin: 0;
    color: @beacon-text-tertiary;
    font-size: 12px;
  }
}

@media (max-width: 700px) {
  .rum-apps__filters {
    grid-template-columns: minmax(0, 1fr) 130px;
  }

  .rum-apps__count {
    display: none;
  }

  .rum-apps__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
