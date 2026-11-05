<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import RumProjectOverview from '@/components/rum/RumProjectOverview.vue'
import RumProjectRecords from '@/components/rum/RumProjectRecords.vue'
import { usePageHeader } from '@/composables/usePageHeader'

/**
 * 项目级（跨应用）视图：概览 / 错误 / 事件。
 * 入口在「前端监控」的应用卡片列表页顶部，因此这里自带一条返回与互相切换的导航条，
 * 而不是占用左侧二级菜单（左侧菜单只在进入具体应用后才出现应用内导航）。
 */
defineProps<{ section: 'overview' | 'errors' | 'events' }>()

const { t } = useI18n()
usePageHeader({ back: '/rum' })
const links = computed(() =>
  (
    [
      ['overview', '/rum/overview'],
      ['errors', '/rum/errors'],
      ['events', '/rum/events'],
    ] as const
  ).map(([key, path]) => ({ key, path, label: t(`rumProject.${key}`) })),
)
</script>

<template>
  <section class="rum-project">
    <nav
      class="rum-project-nav"
      :aria-label="t('rumApps.crossApp')"
    >
      <RouterLink
        class="rum-project-nav__back"
        to="/rum"
      >
        {{ t('rum.backToApps') }}
      </RouterLink>
      <span class="rum-project-nav__divider" />
      <RouterLink
        v-for="item in links"
        :key="item.key"
        class="rum-project-nav__link"
        :class="{ 'rum-project-nav__link--active': item.key === section }"
        :to="item.path"
        :aria-current="item.key === section ? 'page' : undefined"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
    <RumProjectOverview v-if="section === 'overview'" />
    <RumProjectRecords
      v-else
      :kind="section"
    />
  </section>
</template>

<style scoped>
.rum-project {
  min-width: 0;
}

.rum-project-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  font-size: 12px;
}

.rum-project-nav__back {
  color: var(--td-text-color-secondary);
}

.rum-project-nav__back:hover,
.rum-project-nav__link:hover {
  color: var(--td-brand-color);
}

.rum-project-nav__divider {
  width: 1px;
  height: 12px;
  background: var(--td-border-level-1-color);
}

.rum-project-nav__link {
  color: var(--td-text-color-primary);
}

.rum-project-nav__link--active {
  color: var(--td-brand-color);
  font-weight: 600;
}
</style>
