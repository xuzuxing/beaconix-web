<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOrganizationStore } from '@/stores'
import { canVisitNavigation, navigationScope } from '@/utils/navigation-access'
import { permissionEpoch, workspaceEpoch, sessionEpoch } from '@/utils/access-context'
/**
 * 主布局的内容区：默认对页面做 keep-alive 缓存，
 * 路由 meta.keepAlive === false 的页面则不缓存。
 */
defineOptions({ name: 'AppContent' })
const route = useRoute()
const org = useOrganizationStore()
const { t } = useI18n()
const key = computed(() => `${sessionEpoch.value}:${workspaceEpoch.value}:${permissionEpoch.value}`)
const readable = computed(
  () =>
    (['account', 'platform'].includes(navigationScope(route.path)) ||
      org.workspaceState === 'ready') &&
    canVisitNavigation(
      route.path,
      typeof route.params.projectId === 'string' ? route.params.projectId : undefined,
    ),
)
const noProject = computed(() => navigationScope(route.path) === 'project' && !org.currentProjectId)
</script>

<template>
  <div v-if="!readable || noProject" class="access-state">
    <t-loading
      v-if="org.workspaceState === 'idle' || org.workspaceState === 'loading'"
      :text="t('common.loading')"
    />
    <t-alert
      v-else-if="org.workspaceState === 'error'"
      theme="error"
      :message="org.workspaceError"
    />
    <t-empty v-else :description="t(noProject ? 'access.noProjects' : 'access.unavailable')" />
    <t-button variant="outline" @click="org.loadWorkspace(true)">{{ t('access.retry') }}</t-button>
  </div>
  <router-view v-else :key="key" v-slot="{ Component, route }">
    <transition name="fade" mode="out-in">
      <keep-alive v-if="route.meta.keepAlive !== false">
        <component :is="Component" />
      </keep-alive>
      <component :is="Component" v-else />
    </transition>
  </router-view>
</template>
<style scoped>
.access-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 16px;
}
</style>
