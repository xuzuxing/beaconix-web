<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import type { StatusPage } from '@/api/types/status-page'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import StatusPageActions from '@/components/status-pages/StatusPageActions.vue'
import StatusPageEditorDialog from '@/components/status-pages/StatusPageEditorDialog.vue'
import StatusPageFieldTags from '@/components/status-pages/StatusPageFieldTags.vue'
import StatusPageStatusTag from '@/components/status-pages/StatusPageStatusTag.vue'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { useRefreshOnActivate } from '@/composables/useRefreshOnActivate'
import { useStatusPageActions } from '@/composables/useStatusPageActions'
import { useStatusPageList } from '@/composables/useStatusPageList'
import { PlusSignIcon, RefreshIcon, Search01Icon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import {
  findStatusPageTemplate,
  publicStatusPagePath,
  selectStatusPages,
  type StatusPageSort,
  type StatusPageStatusFilter,
  type StatusPageTemplate,
} from '@/utils/status-page-presenter'

/**
 * 状态页 → 概览页。
 * 状态页是组织级资源：列表按当前团队加载，CRUD 走 /organizations/:orgId/status-pages，
 * 公开地址为 /status/:slug（页面停用后公开接口返回 404）。
 */
defineOptions({ name: 'StatusPagesView' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const org = useOrganizationStore()
const orgId = computed(() => org.currentOrganizationId)
const { canManage } = useOrganizationRole()
const { pages, loading, error, load } = useStatusPageList(orgId)
const { pending, actionError, act } = useStatusPageActions(orgId, async () => {
  await load()
})
// keep-alive 页面：从别的页面返回时重新拉取状态页列表
useRefreshOnActivate(load)

const editor = ref(false)
const editing = ref<StatusPage>()
const editorTemplate = ref<StatusPageTemplate>()

const statusFilters: StatusPageStatusFilter[] = ['all', 'enabled', 'disabled']
const sorts: StatusPageSort[] = ['newest', 'name', 'monitors']
const queryValue = (key: string) =>
  typeof route.query[key] === 'string' ? (route.query[key] as string) : ''
function setFilter(key: string, value: string | number) {
  void router.replace({
    query: {
      ...route.query,
      [key]: value === 'all' || value === '' ? undefined : String(value),
      page: undefined,
    },
  })
}
const search = computed({
  get: () => queryValue('q'),
  set: (value) => setFilter('q', value),
})
const status = computed({
  get: () =>
    statusFilters.includes(queryValue('status') as StatusPageStatusFilter)
      ? (queryValue('status') as StatusPageStatusFilter)
      : ('all' as const),
  set: (value) => setFilter('status', value),
})
const sort = computed({
  get: () =>
    sorts.includes(queryValue('sort') as StatusPageSort)
      ? (queryValue('sort') as StatusPageSort)
      : 'newest',
  set: (value) => setFilter('sort', value),
})
const pageSize = computed(() =>
  [10, 20, 50].includes(Number(queryValue('size')))
    ? Number(queryValue('size'))
    : 10,
)
const filtered = computed(() =>
  selectStatusPages(pages.value, search.value, status.value, sort.value),
)
const page = computed(() =>
  Math.min(
    Math.max(1, Math.floor(Number(queryValue('page'))) || 1),
    Math.max(1, Math.ceil(filtered.value.length / pageSize.value)),
  ),
)
const rows = computed(() =>
  filtered.value.slice(
    (page.value - 1) * pageSize.value,
    page.value * pageSize.value,
  ),
)

// 切换团队时关闭编辑浮层；列表本身由 useStatusPageList 负责重载
watch(
  orgId,
  () => {
    editor.value = false
    editorTemplate.value = undefined
  },
  { flush: 'sync' },
)

// 「页面模板」页跳转过来时带 ?template=<id>&create=1，打开编辑器并套用模板
watch(
  () => [queryValue('template'), queryValue('create')],
  () => {
    if (!queryValue('create')) return
    const template = findStatusPageTemplate(queryValue('template'))
    if (!template) return
    create(template)
    void router.replace({
      query: { ...route.query, template: undefined, create: undefined },
    })
  },
  { immediate: true },
)

function create(template?: StatusPageTemplate) {
  editing.value = undefined
  editorTemplate.value = template
  editor.value = true
}
function edit(statusPage: StatusPage) {
  editing.value = statusPage
  editorTemplate.value = undefined
  editor.value = true
}
function paginate({
  current,
  pageSize: size,
}: {
  current: number
  pageSize: number
}) {
  void router.replace({
    query: { ...route.query, page: String(current), size: String(size) },
  })
}
</script>

<template>
  <section class="status-page-page">
    <HeaderActions>
      <t-tooltip :content="t('statusPage.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!orgId"
          :aria-label="t('statusPage.refresh')"
          @click="load"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
      <t-button
        v-if="canManage"
        :disabled="!orgId"
        @click="create()"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('statusPage.create') }}</t-button
      >
    </HeaderActions>

    <t-card class="status-page-page__panel">
      <template #title>{{ t('statusPage.manageTitle') }}</template>
      <template #actions>
        <span class="status-page-page__scope">{{
          org.currentOrganization?.name ?? '-'
        }}</span>
      </template>

      <t-alert
        v-if="actionError"
        theme="error"
        :message="actionError"
      />
      <div class="status-page-page__filters">
        <t-input
          v-model="search"
          clearable
          :placeholder="t('statusPage.search')"
          :aria-label="t('statusPage.search')"
          ><template #prefix-icon><AppIcon :icon="Search01Icon" /></template
        ></t-input>
        <t-select
          v-model="status"
          :aria-label="t('statusPage.allStatuses')"
          :options="[
            { label: t('statusPage.allStatuses'), value: 'all' },
            { label: t('statusPage.enabled'), value: 'enabled' },
            { label: t('statusPage.disabled'), value: 'disabled' },
          ]"
        />
        <t-select
          v-model="sort"
          :aria-label="t('statusPage.sort')"
          :options="[
            { label: t('statusPage.sortNewest'), value: 'newest' },
            { label: t('statusPage.sortName'), value: 'name' },
            { label: t('statusPage.sortMonitors'), value: 'monitors' },
          ]"
        />
      </div>

      <div
        v-if="error"
        class="status-page-page__empty"
      >
        <t-alert
          theme="error"
          :message="error"
        />
        <t-button @click="load">{{ t('statusPage.retry') }}</t-button>
      </div>
      <div
        v-else-if="loading"
        class="status-page-page__empty"
      >
        <t-loading :text="t('common.loading')" />
      </div>
      <div
        v-else-if="!orgId"
        class="status-page-page__empty"
      >
        {{ t('statusPage.noOrganization') }}
      </div>
      <template v-else-if="rows.length">
        <div class="status-page-page__table">
          <div class="status-page-page__table-head">
            <span>{{ t('statusPage.pageColumn') }}</span
            ><span>{{ t('statusPage.monitorsColumn') }}</span
            ><span>{{ t('statusPage.displayColumn') }}</span
            ><span>{{ t('statusPage.statusColumn') }}</span
            ><span>{{ t('statusPage.actions') }}</span>
          </div>
          <article
            v-for="item in rows"
            :key="item.id"
            class="status-row"
          >
            <div class="status-row__identity">
              <span class="status-row__title">{{ item.title }}</span>
              <p
                class="status-row__path"
                :title="publicStatusPagePath(item.slug)"
              >
                {{ publicStatusPagePath(item.slug) }}
              </p>
            </div>
            <span class="status-row__count">{{
              item.visibleMonitorIds.length
            }}</span>
            <StatusPageFieldTags
              :show-latency="item.showLatency"
              :show-uptime="item.showUptime"
            />
            <StatusPageStatusTag :enabled="item.enabled" />
            <StatusPageActions
              :page="item"
              :pending="pending[item.id]"
              :can-manage="canManage"
              @edit="edit(item)"
              @action="act(orgId, item, $event)"
            />
          </article>
        </div>
        <t-pagination
          :total="filtered.length"
          :current="page"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>
      <div
        v-else
        class="status-page-page__empty"
      >
        <p>
          {{ t(pages.length ? 'statusPage.noMatches' : 'statusPage.empty') }}
        </p>
        <t-button
          v-if="pages.length"
          variant="outline"
          @click="router.replace({ query: {} })"
          >{{ t('statusPage.reset') }}</t-button
        >
        <t-button
          v-else-if="canManage"
          @click="create()"
          >{{ t('statusPage.create') }}</t-button
        >
      </div>
    </t-card>

    <StatusPageEditorDialog
      v-model:visible="editor"
      :org-id="orgId"
      :page="editing"
      :template="editorTemplate"
      @saved="load"
    />
  </section>
</template>

<style scoped lang="less">
.status-page-page {
  min-width: 0;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__filters {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 130px 150px;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .status-row {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 110px 170px 90px 150px;
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

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    min-height: 240px;
    justify-content: center;
  }

  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

.status-row {
  &__identity {
    min-width: 0;
  }

  &__title {
    color: @beacon-text-primary;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 6px 0 0;
    font-size: 12px;
    color: @beacon-text-secondary;
  }

  &__count {
    color: @beacon-text-primary;
    font-variant-numeric: tabular-nums;
  }
}

@media (max-width: 1200px) {
  .status-page-page__table-head,
  .status-page-page .status-row {
    grid-template-columns: minmax(180px, 1fr) 90px 150px 140px;
  }
  .status-page-page__table-head > :nth-child(2),
  .status-row > :nth-child(2) {
    display: none;
  }
}

@media (max-width: 900px) {
  .status-page-page__filters {
    grid-template-columns: minmax(0, 1fr) 130px;
  }
  .status-page-page__table-head {
    display: none;
  }
  .status-page-page .status-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 16px 8px;
  }
  .status-row__identity {
    grid-column: 1 / -1;
  }
  .status-row > :nth-child(2),
  .status-row > :nth-child(3),
  .status-row > :nth-child(4) {
    display: inline-flex;
  }
}
</style>
