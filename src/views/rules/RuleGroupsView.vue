<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { listRuleGroups } from '@/api'
import type { RuleGroup } from '@/api/types/rule'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import RuleGroupDetailDrawer from '@/components/rules/RuleGroupDetailDrawer.vue'
import RuleGroupEditorDialog from '@/components/rules/RuleGroupEditorDialog.vue'
import { fieldLabelKey } from '@/config/rules'
import { useMonitorAccess } from '@/composables/useMonitorAccess'
import { useRuleMeta } from '@/composables/useRuleMeta'
import { PlusSignIcon, RefreshIcon, Search01Icon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import { formatMonitorTime } from '@/utils/monitor-presenter'
import { countRuleNodes } from '@/utils/rule-presenter'

/**
 * 告警规则（规则组）管理：当前组织下的规则组列表，含项目级规则组。
 * 列表提供搜索 / 范围 / 状态筛选、新建、编辑与只读详情；
 * 接口见 `GET|POST /organizations/:orgId/rule-groups`。
 */
defineOptions({ name: 'RuleGroupsView' })

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const org = useOrganizationStore()
const { canManage } = useMonitorAccess()
const { load: loadMeta } = useRuleMeta()

const orgId = computed(() => org.currentOrganizationId)
const projectId = computed(() => org.currentProjectId)
const groups = ref<RuleGroup[]>([])
const loading = ref(false)
const error = ref('')
const dialog = ref(false)
const editing = ref<RuleGroup | null>(null)
const detail = ref<RuleGroup | null>(null)
const detailVisible = ref(false)
let generation = 0
let controller: AbortController | undefined

const queryValue = (key: string) =>
  typeof route.query[key] === 'string' ? (route.query[key] as string) : ''
function setFilter(key: string, value: string) {
  void router.replace({
    query: { ...route.query, [key]: value === 'all' || value === '' ? undefined : value },
  })
}
const search = computed({ get: () => queryValue('q'), set: (value) => setFilter('q', value) })
const scope = computed({
  get: () => (['org', 'project'].includes(queryValue('scope')) ? queryValue('scope') : 'all'),
  set: (value) => setFilter('scope', value),
})
const state = computed({
  get: () => (['on', 'off'].includes(queryValue('state')) ? queryValue('state') : 'all'),
  set: (value) => setFilter('state', value),
})

async function load() {
  const token = ++generation
  const id = orgId.value
  controller?.abort()
  controller = new AbortController()
  error.value = ''
  if (!id) {
    groups.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const result = await listRuleGroups(id, { signal: controller.signal })
    if (token === generation) groups.value = result
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('ruleGroup.loadFailed')
  } finally {
    if (token === generation) loading.value = false
  }
}

// 切换团队时清空并重载；规则组的写操作依赖当前组织，因此同时关闭弹窗与抽屉
watch(
  orgId,
  () => {
    groups.value = []
    dialog.value = false
    detailVisible.value = false
    void load()
  },
  { immediate: true, flush: 'sync' },
)
onScopeDispose(() => {
  generation++
  controller?.abort()
})

const rows = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return groups.value.filter((group) => {
    const matchesQuery =
      !query || `${group.name} ${group.description ?? ''}`.toLocaleLowerCase().includes(query)
    const matchesScope =
      scope.value === 'all' ||
      (scope.value === 'project' ? Boolean(group.projectId) : !group.projectId)
    const matchesState =
      state.value === 'all' || (state.value === 'on' ? group.enabled : !group.enabled)
    return matchesQuery && matchesScope && matchesState
  })
})
const hasFilters = computed(() =>
  Boolean(search.value || queryValue('scope') || queryValue('state')),
)
const fieldLabels = (group: RuleGroup) =>
  group.fieldsUsed.map((field) => {
    const key = fieldLabelKey(field)
    return key ? t(key) : field
  })
const counts = (group: RuleGroup) => countRuleNodes(group.tree)

function create() {
  editing.value = null
  dialog.value = true
  void loadMeta()
}
function edit(group: RuleGroup) {
  editing.value = group
  detailVisible.value = false
  dialog.value = true
  void loadMeta()
}
function openDetail(group: RuleGroup) {
  detail.value = group
  detailVisible.value = true
}
</script>

<template>
  <section class="rule-groups">
    <HeaderActions>
      <t-tooltip :content="t('ruleGroup.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!orgId"
          :aria-label="t('ruleGroup.refresh')"
          @click="load"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
      <t-button v-if="canManage" :disabled="!orgId" @click="create()"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('ruleGroup.create') }}</t-button
      >
    </HeaderActions>
    <t-card class="rule-groups__panel">
      <template #title>{{ t('ruleGroup.title') }}</template>
      <template #actions>
        <span class="rule-groups__scope">
          {{ org.currentOrganization?.name ?? '-' }} / {{ org.currentProject?.name ?? '-' }}
        </span>
      </template>
      <p class="rule-groups__desc">{{ t('ruleGroup.pageHint') }}</p>
      <div class="rule-groups__filters">
        <t-input
          v-model="search"
          clearable
          :placeholder="t('ruleGroup.search')"
          :aria-label="t('ruleGroup.search')"
          ><template #prefix-icon><AppIcon :icon="Search01Icon" /></template
        ></t-input>
        <t-select
          v-model="scope"
          :aria-label="t('ruleGroup.scopeLabel')"
          :options="[
            { label: t('ruleGroup.allScopes'), value: 'all' },
            { label: t('ruleGroup.scope.org'), value: 'org' },
            { label: t('ruleGroup.scope.project'), value: 'project' },
          ]"
        />
        <t-select
          v-model="state"
          :aria-label="t('ruleGroup.stateLabel')"
          :options="[
            { label: t('ruleGroup.allStates'), value: 'all' },
            { label: t('ruleGroup.state.on'), value: 'on' },
            { label: t('ruleGroup.state.off'), value: 'off' },
          ]"
        />
      </div>
      <div v-if="error" class="rule-groups__empty">
        <t-alert theme="error" :message="error" /><t-button @click="load">{{
          t('ruleGroup.retry')
        }}</t-button>
      </div>
      <div v-else-if="loading" class="rule-groups__empty">
        <t-loading :text="t('common.loading')" />
      </div>
      <div v-else-if="!orgId" class="rule-groups__empty">{{ t('ruleGroup.noOrganization') }}</div>
      <template v-else-if="rows.length">
        <div class="rule-groups__table">
          <div class="rule-groups__table-head">
            <span>{{ t('ruleGroup.name') }}</span
            ><span>{{ t('ruleGroup.rulesLabel') }}</span
            ><span>{{ t('ruleGroup.updatedAt') }}</span
            ><span>{{ t('ruleGroup.actions') }}</span>
          </div>
          <article
            v-for="group in rows"
            :key="group.id"
            class="rule-group-row"
            @click="openDetail(group)"
          >
            <div class="rule-group-row__identity">
              <div class="rule-group-row__name">
                <span>{{ group.name }}</span>
                <t-tag
                  size="small"
                  variant="light"
                  :theme="group.enabled ? 'success' : 'default'"
                  >{{ t(group.enabled ? 'ruleGroup.state.on' : 'ruleGroup.state.off') }}</t-tag
                >
                <t-tag size="small" variant="outline">{{
                  group.projectId ? t('ruleGroup.scope.project') : t('ruleGroup.scope.org')
                }}</t-tag>
              </div>
              <p v-if="group.description" class="rule-group-row__desc">{{ group.description }}</p>
              <p class="rule-group-row__fields">{{ fieldLabels(group).join(' · ') || '-' }}</p>
            </div>
            <div class="rule-group-row__count">
              <span>{{
                t('ruleGroup.rulesCount', {
                  rules: counts(group).conditions,
                  groups: counts(group).logics,
                })
              }}</span>
            </div>
            <time class="rule-group-row__time">{{
              formatMonitorTime(group.updatedAt, locale)
            }}</time>
            <div class="rule-group-row__actions">
              <t-button v-if="canManage" variant="text" @click.stop="edit(group)">{{
                t('ruleGroup.edit')
              }}</t-button>
              <t-button variant="text" @click.stop="openDetail(group)">{{
                t('ruleGroup.detail')
              }}</t-button>
            </div>
          </article>
        </div>
      </template>
      <div v-else class="rule-groups__empty">
        <p>{{ t(groups.length ? 'ruleGroup.noMatches' : 'ruleGroup.empty') }}</p>
        <t-button v-if="hasFilters" variant="outline" @click="router.replace({ query: {} })">{{
          t('ruleGroup.reset')
        }}</t-button>
      </div>
    </t-card>
    <RuleGroupEditorDialog
      v-model:visible="dialog"
      :org-id="orgId"
      :group="editing"
      :project-id="projectId"
      @saved="load"
    />
    <RuleGroupDetailDrawer v-model:visible="detailVisible" :group="detail" @edit="edit" />
  </section>
</template>

<style scoped lang="less">
.rule-groups {
  min-width: 0;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__desc {
    margin: 0 0 16px;
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__filters {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 150px 150px;
    gap: 8px;
    margin-bottom: 16px;
  }

  // 表头与行之间用 1px 分割线；白底与边框由卡片提供
  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .rule-group-row {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 172px 168px 120px;
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
    justify-content: center;
    gap: 20px;
    min-height: 240px;
  }
}

.rule-group-row {
  cursor: pointer;

  &:hover {
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
    font-weight: 600;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__desc,
  &__fields {
    margin: 6px 0 0;
    font-size: 12px;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__count {
    color: @beacon-text-secondary;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  &__time {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
}

@media (max-width: 1200px) {
  .rule-groups__table-head,
  .rule-groups .rule-group-row {
    grid-template-columns: minmax(180px, 1fr) 150px 110px;
  }

  .rule-groups__table-head > :nth-child(2),
  .rule-group-row__count {
    display: none;
  }
}

@media (max-width: 600px) {
  .rule-groups__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    > :first-child {
      grid-column: 1 / -1;
    }
  }

  .rule-groups__table-head {
    display: none;
  }

  .rule-groups .rule-group-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 16px 8px;
  }

  .rule-group-row__identity {
    grid-column: 1 / -1;
  }
}
</style>
