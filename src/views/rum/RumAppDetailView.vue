<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getRumApp } from '@/api/modules/rum'
import { RUM_APP_MANAGE_ONLY_SECTIONS, type RumAppSection } from '@/config/rum-app-nav'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import { usePageHeader } from '@/composables/usePageHeader'
import HeaderActions from '@/components/HeaderActions.vue'
import RumState from '@/components/rum/RumState.vue'
import RumOverview from '@/components/rum/RumOverview.vue'
import RumPerformance from '@/components/rum/RumPerformance.vue'
import RumErrorOverview from '@/components/rum/RumErrorOverview.vue'
import RumErrors from '@/components/rum/RumErrors.vue'
import RumReleases from '@/components/rum/RumReleases.vue'
import RumEvents from '@/components/rum/RumEvents.vue'
import RumReplays from '@/components/rum/RumReplays.vue'
import RumSourceMaps from '@/components/rum/RumSourceMaps.vue'
import RumAlerts from '@/components/rum/RumAlerts.vue'
import RumSetup from '@/components/rum/RumSetup.vue'
import RumAppSettings from '@/components/rum/RumAppSettings.vue'

/**
 * 应用工作台：一个应用的全部页面都在这里，具体展示哪一屏由路由参数 `section` 决定。
 * 左侧导航由 SecondaryNav 依据 `meta.rumAppScoped` 渲染，本页不再自带页签，
 * 因此每个页面都有独立地址、可深链、可书签。
 */
const props = defineProps<{ section: RumAppSection }>()

const { t } = useI18n()
const { projectId, appId, canReadRum } = useRumContext()
const app = useRumResource(
  (signal) => getRumApp(projectId.value, appId.value, { signal }),
  [projectId, appId],
)
usePageHeader({ title: () => app.data.value?.name, back: '/rum' })

/** 接入与配置类页面不依赖观测数据，没有 rum.read 也能进来 */
const needsRumRead = computed(
  () => !RUM_APP_MANAGE_ONLY_SECTIONS.includes(props.section),
)
const denied = computed(() => needsRumRead.value && !canReadRum.value)
</script>
<template>
  <section class="rum-detail">
    <HeaderActions to="#layout-header-title-addon">
      <t-tag
        v-if="app.data.value"
        :theme="app.data.value.enabled ? 'success' : 'default'"
      >
        {{ t(app.data.value.enabled ? 'rumApps.enabled' : 'rumApps.disabled') }}
      </t-tag>
    </HeaderActions>
    <RumState
      :loading="app.loading.value"
      :error="app.error.value"
      @retry="app.reload"
    >
      <template v-if="app.data.value">
        <t-alert
          v-if="denied"
          theme="warning"
          :message="t('rum.noPermission')"
        />
        <div
          v-else
          class="rum-detail__body"
        >
          <RumOverview v-if="section === 'overview'" />
          <template v-else-if="section === 'errors'">
            <RumErrorOverview />
            <RumErrors />
          </template>
          <RumPerformance v-else-if="section === 'performance'" />
          <RumReleases v-else-if="section === 'releases'" />
          <RumEvents v-else-if="section === 'events'" />
          <RumReplays v-else-if="section === 'replays'" />
          <RumSourceMaps v-else-if="section === 'source-maps'" />
          <RumAlerts v-else-if="section === 'alerts'" />
          <RumSetup
            v-else-if="section === 'setup'"
            :app="app.data.value"
          />
          <RumAppSettings
            v-else
            :app="app.data.value"
            @updated="app.reload"
          />
        </div>
      </template>
    </RumState>
  </section>
</template>
<style scoped>
.rum-detail {
  min-width: 0;
}
.rum-detail__body {
  display: grid;
  gap: 16px;
  min-width: 0;
}
</style>
