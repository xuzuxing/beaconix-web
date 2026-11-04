<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getRumApp } from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import { usePageHeader } from '@/composables/usePageHeader'
import HeaderActions from '@/components/HeaderActions.vue'
import RumState from '@/components/rum/RumState.vue'
import RumOverview from '@/components/rum/RumOverview.vue'
import RumErrors from '@/components/rum/RumErrors.vue'
import RumEvents from '@/components/rum/RumEvents.vue'
import RumReplays from '@/components/rum/RumReplays.vue'
import RumSourceMaps from '@/components/rum/RumSourceMaps.vue'
import RumAlerts from '@/components/rum/RumAlerts.vue'
import RumSetup from '@/components/rum/RumSetup.vue'
import RumAppSettings from '@/components/rum/RumAppSettings.vue'
const { t } = useI18n()
const { route, router, projectId, appId, canReadRum } = useRumContext()
const app = useRumResource(
  (signal) => getRumApp(projectId.value, appId.value, { signal }),
  [projectId, appId],
)
usePageHeader({ title: () => app.data.value?.name, back: '/rum' })
const tabs = [
  'overview',
  'errors',
  'events',
  'replays',
  'source-maps',
  'alerts',
  'setup',
  'settings',
] as const
type Tab = (typeof tabs)[number]
const tab = computed<Tab>(() =>
  tabs.includes(route.query.tab as Tab) ? (route.query.tab as Tab) : 'overview',
)
function selectTab(value: string | number) {
  void router.replace({ query: { ...route.query, tab: String(value) } })
}
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
        <div
          role="tablist"
          :aria-label="t('rumApps.title')"
        >
          <t-tabs
            :value="tab"
            @change="selectTab"
          >
            <t-tab-panel
              v-for="key in tabs"
              :key="key"
              :value="key"
            >
              <template #label
                ><span
                  role="tab"
                  tabindex="0"
                  :aria-selected="tab === key"
                  @keydown.enter.prevent="selectTab(key)"
                  @keydown.space.prevent="selectTab(key)"
                  >{{
                    key === 'settings'
                      ? t('rumProject.settings')
                      : t('rum.' + (key === 'source-maps' ? 'maps' : key))
                  }}</span
                ></template
              >
            </t-tab-panel>
          </t-tabs>
        </div>
        <div class="rum-detail__body">
          <t-alert
            v-if="
              !canReadRum && !['source-maps', 'setup', 'settings'].includes(tab)
            "
            theme="warning"
            :message="t('rum.noPermission')"
          />
          <template v-else
            ><RumOverview v-if="tab === 'overview'" /><RumErrors
              v-else-if="tab === 'errors'" /><RumEvents
              v-else-if="tab === 'events'" /><RumReplays
              v-else-if="tab === 'replays'" /><RumSourceMaps
              v-else-if="tab === 'source-maps'" /><RumAlerts
              v-else-if="tab === 'alerts'" /><RumSetup
              v-else-if="tab === 'setup'"
              :app="app.data.value" /><RumAppSettings
              v-else
              :app="app.data.value"
              @updated="app.reload"
          /></template>
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
  padding-top: 20px;
}
</style>
