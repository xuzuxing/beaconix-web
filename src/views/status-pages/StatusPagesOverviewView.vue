<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getPublicStatusPage } from '@/api'
import type { MonitorStatus } from '@/api/types'
import type { StatusPage } from '@/api/types/status-page'
import MonitorStatusTag from '@/components/monitor/MonitorStatusTag.vue'
import StatusPageStatusTag from '@/components/status-pages/StatusPageStatusTag.vue'
import { useStatusPageList } from '@/composables/useStatusPageList'
import { useOrganizationStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'
import {
  publicStatusPagePath,
  publicStatusPageUrl,
  summarizeStatusPages,
} from '@/utils/status-page-presenter'

/**
 * 状态页 → 概览。
 * 后端暂无状态页汇总接口（见 docs/menu-structure.md），这里基于 GET /status-pages 的列表
 * 在前端聚合统计，并对每个已启用的状态页调用公开接口 GET /status/:slug 取整体状态。
 */
defineOptions({ name: 'StatusPagesOverviewView' })
const { t } = useI18n()
const org = useOrganizationStore()
const orgId = computed(() => org.currentOrganizationId)
const { pages, loading, error, load } = useStatusPageList(orgId)

/** 公开页整体状态；取不到（404 / 网络异常）时记 UNKNOWN */
const publicStatus = ref<Record<string, MonitorStatus>>({})
const publicLoading = ref(false)
let publicGeneration = 0

async function loadPublicStatus() {
  const token = ++publicGeneration
  const targets = pages.value.filter((page) => page.enabled)
  if (!targets.length) {
    publicStatus.value = {}
    publicLoading.value = false
    return
  }
  publicLoading.value = true
  const results = await Promise.allSettled(targets.map((page) => getPublicStatusPage(page.slug)))
  if (token !== publicGeneration) return
  const next: Record<string, MonitorStatus> = {}
  results.forEach((result, index) => {
    const target = targets[index]
    if (!target) return
    next[target.id] = result.status === 'fulfilled' ? result.value.overallStatus : 'UNKNOWN'
  })
  publicStatus.value = next
  publicLoading.value = false
}

// 列表每次加载都会替换数组引用，据此重新取公开状态
watch(pages, () => void loadPublicStatus())

const summary = computed(() => summarizeStatusPages(pages.value))
const stats = computed(() => [
  { key: 'total', label: t('statusPage.total'), value: summary.value.total, query: {} },
  {
    key: 'enabled',
    label: t('statusPage.enabled'),
    value: summary.value.enabled,
    query: { status: 'enabled' },
  },
  {
    key: 'disabled',
    label: t('statusPage.disabled'),
    value: summary.value.disabled,
    query: { status: 'disabled' },
  },
  {
    key: 'monitors',
    label: t('statusPage.monitorsColumn'),
    value: summary.value.monitors,
    query: {},
  },
])
const recent = computed(() =>
  [...pages.value].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5),
)
const target = (query: Record<string, string | undefined>) => ({ name: 'status-pages', query })
const openUrl = (page: StatusPage) => publicStatusPageUrl(page.slug)
const statusOf = (page: StatusPage) => publicStatus.value[page.id] ?? 'UNKNOWN'
</script>

<template>
  <section class="status-overview">
    <t-card class="status-overview__card">
      <template #title>{{ t('statusPage.overviewTitle') }}</template>
      <template #actions>
        <span class="status-overview__scope">{{ org.currentOrganization?.name ?? '-' }}</span>
      </template>

      <div v-if="error" class="status-overview__state">
        <t-alert theme="error" :message="error" />
        <t-button @click="load">{{ t('statusPage.retry') }}</t-button>
      </div>
      <div v-else-if="loading" class="status-overview__state">
        <t-loading :text="t('common.loading')" />
      </div>
      <div v-else-if="!orgId" class="status-overview__state">
        {{ t('statusPage.noOrganization') }}
      </div>
      <div v-else class="status-overview__grid">
        <RouterLink
          v-for="item in stats"
          :key="item.key"
          class="status-overview__cell"
          :to="target(item.query)"
        >
          <span class="status-overview__label">{{ item.label }}</span>
          <strong class="status-overview__value" :class="`status-overview__value--${item.key}`">
            {{ item.value }}
          </strong>
        </RouterLink>
      </div>
    </t-card>

    <t-card class="status-overview__card">
      <template #title>{{ t('statusPage.publicCardTitle') }}</template>
      <template #actions>
        <span v-if="publicLoading" class="status-overview__scope">{{ t('common.loading') }}</span>
      </template>

      <div v-if="error || loading || !orgId" class="status-overview__state">
        <t-loading v-if="loading" :text="t('common.loading')" />
        <span v-else>-</span>
      </div>
      <p v-else-if="!pages.length" class="status-overview__empty">{{ t('statusPage.empty') }}</p>
      <ul v-else class="status-overview__list">
        <li v-for="item in pages" :key="item.id" class="status-overview__item">
          <div class="status-overview__item-main">
            <RouterLink class="status-overview__item-title" :to="target({ q: item.slug })">
              {{ item.title }}
            </RouterLink>
            <span class="status-overview__item-path">{{ publicStatusPagePath(item.slug) }}</span>
          </div>
          <MonitorStatusTag v-if="item.enabled" :status="statusOf(item)" />
          <StatusPageStatusTag v-else :enabled="false" />
          <a
            class="status-overview__open"
            :href="openUrl(item)"
            target="_blank"
            rel="noopener"
            >{{ t('statusPage.preview') }}</a
          >
        </li>
      </ul>
    </t-card>

    <t-card class="status-overview__card">
      <template #title>{{ t('statusPage.recentTitle') }}</template>
      <div v-if="error || loading || !orgId" class="status-overview__state">
        <t-loading v-if="loading" :text="t('common.loading')" />
        <span v-else>-</span>
      </div>
      <p v-else-if="!recent.length" class="status-overview__empty">{{ t('statusPage.empty') }}</p>
      <ul v-else class="status-overview__list">
        <li v-for="item in recent" :key="item.id" class="status-overview__item">
          <div class="status-overview__item-main">
            <span class="status-overview__item-title">{{ item.title }}</span>
            <span class="status-overview__item-path">
              {{ t('statusPage.updatedAt', { time: formatDateTime(item.updatedAt) }) }}
            </span>
          </div>
          <StatusPageStatusTag :enabled="item.enabled" />
        </li>
      </ul>
    </t-card>
  </section>
</template>

<style scoped lang="less">
.status-overview {
  min-width: 0;

  &__card {
    margin-bottom: 16px;
  }

  &__scope {
    color: @beacon-text-secondary;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 120px;
    color: @beacon-text-secondary;
  }

  &__empty {
    margin: 0;
    padding: 16px 0;
    color: @beacon-text-tertiary;
    text-align: center;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 4px 0;
    color: @beacon-text-secondary;

    &:hover .status-overview__value {
      color: @beacon-brand;
    }
  }

  &__label {
    font-size: @beacon-font-size-base;
  }

  &__value {
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
    color: @beacon-text-primary;
    font-variant-numeric: tabular-nums;

    &--disabled {
      color: @beacon-warning;
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid @beacon-border;

    &:last-child {
      border-bottom: 0;
    }
  }

  &__item-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  &__item-title {
    color: @beacon-text-primary;
    font-weight: 500;
    overflow-wrap: anywhere;

    &:hover {
      color: @beacon-brand;
    }
  }

  &__item-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: @beacon-text-secondary;
  }

  &__open {
    flex: none;
    font-size: @beacon-font-size-base;
    color: @beacon-brand;
  }
}

@media (max-width: 900px) {
  .status-overview__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
