<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { Organization } from '@/api/types'
import AppIcon from '@/components/AppIcon.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import TeamCreateDialog from '@/components/team/TeamCreateDialog.vue'
import { useRefreshOnActivate } from '@/composables/useRefreshOnActivate'
import { useTeamPlans } from '@/composables/useTeamPlans'
import { HOME_PATH } from '@/config'
import {
  GridViewIcon,
  ListViewIcon,
  PlusSignIcon,
  RefreshIcon,
  Search01Icon,
} from '@/icons'
import { useOrganizationStore, useUserStore } from '@/stores'

/**
 * 选择团队：控制台之外的独立整页（只有精简顶栏，无侧边菜单）。
 * 支持新建团队、按名称搜索、按归属筛选、按创建时间排序，以及卡片 / 列表两种视图；
 * 选中某个团队后切换当前团队并进入该团队的控制台。
 */
defineOptions({ name: 'TeamSelectView' })

const { t } = useI18n()
const router = useRouter()
const orgStore = useOrganizationStore()
const userStore = useUserStore()
const { planOf, loadTeamPlans } = useTeamPlans()

/** 归属筛选：全部 / 我创建的 / 我加入的 */
type TeamScope = 'all' | 'owned' | 'joined'

const keyword = ref('')
const scope = ref<TeamScope>('all')
const sort = ref<'newest' | 'oldest'>('newest')
const viewMode = ref<'card' | 'list'>('card')
const currentPage = ref(1)
const pageSize = ref(12)
const loading = ref(false)
const createVisible = ref(false)

const currentUserId = computed(() => userStore.user?.id ?? '')

const sortOptions = computed(() => [
  { label: t('workspace.teamSelect.sortNewest'), value: 'newest' },
  { label: t('workspace.teamSelect.sortOldest'), value: 'oldest' },
])

const scopeOptions = computed(() => [
  { label: t('workspace.teamSelect.filterAll'), value: 'all' },
  { label: t('workspace.teamSelect.filterOwned'), value: 'owned' },
  { label: t('workspace.teamSelect.filterJoined'), value: 'joined' },
])

/** 关键词 + 归属筛选后再按创建时间排序 */
const filteredTeams = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const userId = currentUserId.value
  const list = orgStore.organizations.filter((org) => {
    if (scope.value === 'owned' && org.ownerId !== userId) return false
    if (scope.value === 'joined' && org.ownerId === userId) return false
    if (!kw) return true
    return (
      org.name.toLowerCase().includes(kw) || org.slug.toLowerCase().includes(kw)
    )
  })

  return [...list].sort((a, b) =>
    sort.value === 'newest'
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt),
  )
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filteredTeams.value.length / pageSize.value)),
)

const pagedTeams = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredTeams.value.slice(start, start + pageSize.value)
})

// 筛选条件或每页条数变化时回到第一页
watch([keyword, scope, sort, pageSize], () => {
  currentPage.value = 1
})
// 列表变短时收敛页码
watch(pageCount, (count) => {
  if (currentPage.value > count) currentPage.value = count
})

async function load() {
  loading.value = true
  try {
    await orgStore.loadOrganizations()
    await loadTeamPlans()
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
// keep-alive 页面：从别的页面返回时重新拉取团队列表
useRefreshOnActivate(load)

/** 清空搜索与归属筛选 */
function clearFilters() {
  keyword.value = ''
  scope.value = 'all'
}

/** 进入所选团队的控制台 */
async function enter(org: Organization) {
  await orgStore.switchOrganization(org.id)
  await router.push(HOME_PATH)
}

/** 卡片入口：先切到该团队，再进对应页面，避免看到别的团队的数据 */
async function openTeamPage(org: Organization, path: string) {
  await orgStore.switchOrganization(org.id)
  await router.push(path)
}

/** 新建成功：刷新列表后直接进入新团队 */
async function onCreated(org: Organization) {
  await orgStore.loadOrganizations()
  await enter(org)
}
</script>

<template>
  <div class="team-select">
    <!-- 页头：标题 + 刷新 + 副标题（整页自带，不依赖主布局标题栏） -->
    <div class="team-select__header">
      <h2 class="team-select__title">{{ t('workspace.teamSelect.title') }}</h2>
      <button
        type="button"
        class="team-select__refresh"
        :aria-label="t('workspace.teamSelect.refresh')"
        @click="load"
      >
        <AppIcon :icon="RefreshIcon" />
      </button>
      <span class="team-select__subtitle">{{
        t('workspace.teamSelect.subtitle')
      }}</span>
    </div>

    <div class="team-select__panel">
      <!-- 工具栏：左侧新建，右侧排序 / 筛选 / 搜索 / 视图切换 -->
      <div class="team-select__toolbar">
        <t-button
          theme="primary"
          size="small"
          @click="createVisible = true"
        >
          <template #icon><AppIcon :icon="PlusSignIcon" /></template>
          {{ t('workspace.team.create') }}
        </t-button>

        <div class="team-select__operations">
          <t-select
            v-model="sort"
            class="team-select__select"
            :options="sortOptions"
            size="small"
          />
          <t-select
            v-model="scope"
            class="team-select__select"
            :options="scopeOptions"
            size="small"
          />

          <t-input
            v-model="keyword"
            class="team-select__search"
            size="small"
            clearable
            :placeholder="t('layout.teamSearch')"
            :aria-label="t('layout.teamSearch')"
          >
            <template #prefix-icon>
              <AppIcon
                :icon="Search01Icon"
                :size="14"
              />
            </template>
          </t-input>

          <div class="team-select__views">
            <button
              type="button"
              class="team-select__view"
              :class="{ 'is-active': viewMode === 'card' }"
              :aria-label="t('workspace.teamSelect.viewCard')"
              @click="viewMode = 'card'"
            >
              <AppIcon :icon="GridViewIcon" />
            </button>
            <button
              type="button"
              class="team-select__view"
              :class="{ 'is-active': viewMode === 'list' }"
              :aria-label="t('workspace.teamSelect.viewList')"
              @click="viewMode = 'list'"
            >
              <AppIcon :icon="ListViewIcon" />
            </button>
          </div>
        </div>
      </div>

      <!-- 团队列表：点击卡片进入该团队 -->
      <div
        v-if="pagedTeams.length"
        class="team-select__list"
        :class="`team-select__list--${viewMode}`"
      >
        <TeamCard
          v-for="org in pagedTeams"
          :key="org.id"
          :org="org"
          :plan="planOf(org)"
          :selected="org.id === orgStore.currentOrganizationId"
          :owned="org.ownerId === currentUserId"
          :mode="viewMode"
          @select="enter(org)"
          @members="openTeamPage(org, '/teams/members')"
          @manage="openTeamPage(org, '/teams')"
        />
      </div>

      <div
        v-else
        class="team-select__state"
      >
        <p class="team-select__empty">
          {{
            loading
              ? t('common.loading')
              : orgStore.organizations.length
                ? t('workspace.teamSelect.noMatches')
                : t('workspace.team.empty')
          }}
        </p>
        <t-button
          v-if="orgStore.organizations.length && !loading"
          variant="outline"
          size="small"
          @click="clearFilters"
        >
          {{ t('workspace.teamSelect.reset') }}
        </t-button>
      </div>

      <!-- 底部：总数 + 分页 -->
      <div class="team-select__footer">
        <span class="team-select__total">
          {{ t('workspace.teamSelect.total', { total: filteredTeams.length }) }}
        </span>
        <t-pagination
          v-model="currentPage"
          v-model:page-size="pageSize"
          :total="filteredTeams.length"
          :page-size-options="[12, 24, 48]"
        />
      </div>
    </div>

    <TeamCreateDialog
      v-model:visible="createVisible"
      @created="onCreated"
    />
  </div>
</template>

<style scoped lang="less">
.team-select {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 12px 20px 20px;

  // ---------- 页头 ----------
  &__header {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: 700;
    line-height: 28px;
    color: @beacon-text-primary;
  }

  &__refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
  }

  &__subtitle {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  // ---------- 内容面板 ----------
  &__panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  &__operations {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
  }

  &__select {
    width: 160px;
  }

  &__search {
    width: 240px;
  }

  // 视图切换：图标按钮，选中态品牌色
  &__views {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  &__view {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }

    &.is-active {
      color: @beacon-brand;
      background-color: @beacon-bg-active;
    }
  }

  &__list {
    display: grid;
    align-content: start;
    gap: 12px;

    // 卡片视图三列，列表视图单列
    &--card {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    &--list {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 0;
  }

  &__empty {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-align: center;
  }

  &__footer {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: auto;
    padding-top: 16px;

    // 总条数由左侧自定义文案展示，隐藏分页组件自带的「共 N 条数据」
    :deep(.t-pagination__total) {
      display: none;
    }
  }

  &__total {
    flex: none;
    font-size: @beacon-font-size-base;
    white-space: nowrap;
    color: @beacon-text-secondary;
  }

  @media (max-width: 900px) {
    &__toolbar {
      flex-wrap: wrap;
    }

    &__operations {
      flex-wrap: wrap;
    }

    &__list--card {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 600px) {
    &__operations {
      width: 100%;

      .team-select__search {
        width: 100%;
      }
    }

    &__list--card {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
