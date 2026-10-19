<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import EnvCard from '@/components/env/EnvCard.vue'
import { HOME_PATH } from '@/config'
import { envList } from '@/config/env'
import { GridViewIcon, ListViewIcon, RefreshIcon, Search01Icon } from '@/icons'
import { useEnvStore } from '@/stores'

/**
 * 选择环境：控制台之外的独立整页（不带侧边菜单），
 * 点击环境卡片即切换当前环境并进入该环境的概览页。
 */
defineOptions({ name: 'EnvView' })

const { t } = useI18n()
const router = useRouter()
const envStore = useEnvStore()

const keyword = ref('')
const sort = ref<'newest' | 'oldest'>('newest')
const status = ref<'all' | 'active' | 'inactive'>('all')
const viewMode = ref<'card' | 'list'>('card')
const currentPage = ref(1)
const pageSize = ref(60)

const sortOptions = computed(() => [
  { label: t('env.sortNewest'), value: 'newest' },
  { label: t('env.sortOldest'), value: 'oldest' },
])

const statusOptions = computed(() => {
  const active = envList.filter((env) => env.active).length
  return [
    { label: `${t('env.filterAll')} (${envList.length})`, value: 'all' },
    { label: `${t('layout.envStatusActive')} (${active})`, value: 'active' },
    {
      label: `${t('layout.envStatusInactive')} (${envList.length - active})`,
      value: 'inactive',
    },
  ]
})

/** 关键词 + 状态筛选后再按创建时间排序 */
const filteredEnvs = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const list = envList.filter((env) => {
    if (status.value === 'active' && !env.active) return false
    if (status.value === 'inactive' && env.active) return false
    if (!kw) return true
    return (
      env.name.toLowerCase().includes(kw) || env.id.toLowerCase().includes(kw)
    )
  })

  return [...list].sort((a, b) =>
    sort.value === 'newest'
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt),
  )
})

const pagedEnvs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredEnvs.value.slice(start, start + pageSize.value)
})

// 筛选条件或每页条数变化时回到第一页
watch([keyword, status, sort, pageSize], () => {
  currentPage.value = 1
})

/** 选中环境：切到该环境并进入概览 */
function chooseEnv(id: string) {
  envStore.setCurrent(id)
  void router.push(HOME_PATH)
}
</script>

<template>
  <div class="env">
    <!-- 页头：标题 + 刷新 + 副标题（整页自带，不依赖主布局标题栏） -->
    <div class="env__header">
      <h2 class="env__title">{{ t('env.title') }}</h2>
      <button
        type="button"
        class="env__refresh"
        :aria-label="t('env.refresh')"
      >
        <AppIcon :icon="RefreshIcon" />
      </button>
      <span class="env__subtitle">{{ t('env.subtitle') }}</span>
    </div>

    <div class="env__panel">
      <!-- 工具栏：左侧新建，右侧排序 / 筛选 / 搜索 / 视图切换 -->
      <div class="env__toolbar">
        <t-button
          theme="primary"
          size="small"
          >{{ t('env.create') }}</t-button
        >

        <div class="env__operations">
          <t-select
            v-model="sort"
            class="env__select"
            :options="sortOptions"
            size="small"
          />
          <t-select
            v-model="status"
            class="env__select"
            :options="statusOptions"
            size="small"
          />
          <t-button
            variant="outline"
            size="small"
            >{{ t('env.filter') }}</t-button
          >

          <t-input
            v-model="keyword"
            class="env__search"
            size="small"
            clearable
            :placeholder="t('env.searchPlaceholder')"
          >
            <template #prefix-icon>
              <AppIcon
                :icon="Search01Icon"
                :size="14"
              />
            </template>
          </t-input>

          <div class="env__views">
            <button
              type="button"
              class="env__view"
              :class="{ 'is-active': viewMode === 'card' }"
              :aria-label="t('env.viewCard')"
              @click="viewMode = 'card'"
            >
              <AppIcon :icon="GridViewIcon" />
            </button>
            <button
              type="button"
              class="env__view"
              :class="{ 'is-active': viewMode === 'list' }"
              :aria-label="t('env.viewList')"
              @click="viewMode = 'list'"
            >
              <AppIcon :icon="ListViewIcon" />
            </button>
          </div>
        </div>
      </div>

      <!-- 环境列表：点击卡片切换当前环境并进入概览 -->
      <div
        v-if="pagedEnvs.length"
        class="env__list"
        :class="`env__list--${viewMode}`"
      >
        <EnvCard
          v-for="env in pagedEnvs"
          :key="env.id"
          :env="env"
          :mode="viewMode"
          :selected="env.id === envStore.currentId"
          @select="chooseEnv(env.id)"
        />
      </div>
      <div
        v-else
        class="env__empty"
      >
        {{ t('env.empty') }}
      </div>

      <!-- 分页 -->
      <div class="env__footer">
        <span class="env__total">{{
          t('env.total', { total: filteredEnvs.length })
        }}</span>
        <t-pagination
          v-model="currentPage"
          v-model:page-size="pageSize"
          :total="filteredEnvs.length"
          :page-size-options="[10, 20, 60]"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.env {
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

  &__empty {
    padding: 48px 0;
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
}
</style>
