<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProjectRumOverview } from '@/api/modules/rum'
import RumKpiGrid from '@/components/rum/RumKpiGrid.vue'
import { useRumResource } from '@/composables/useRumResource'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import RumState from './RumState.vue'

const { t } = useI18n()
const org = useOrganizationStore()
const permissions = usePermissionsStore()
const projectId = computed(() => org.currentProjectId)
const canRead = computed(
  () =>
    !!projectId.value && permissions.canProject(projectId.value, 'rum.read'),
)
const resource = useRumResource(
  (signal) =>
    canRead.value
      ? getProjectRumOverview(projectId.value, { signal })
      : Promise.resolve(null),
  [projectId, canRead],
)
const kpis = computed(() => [
  {
    key: 'apps',
    label: t('rumProject.appCount'),
    value: resource.data.value?.appCount,
    hint: '',
  },
  {
    key: 'errorGroups',
    label: t('rumProject.errorGroups'),
    value: resource.data.value?.errorGroups,
    hint: t('rumProject.retained'),
  },
  {
    key: 'events7d',
    label: t('rumProject.events7d'),
    value: resource.data.value?.events7d,
    hint: t('rum.recent7'),
  },
  {
    key: 'replays',
    label: t('rum.replays'),
    value: resource.data.value?.replays,
    hint: t('rumProject.retained'),
  },
  {
    key: 'openAlerts',
    label: t('rum.openAlerts'),
    value: resource.data.value?.openAlerts,
    hint: t('rumProject.retained'),
  },
])
const columns = computed(() => [
  { colKey: 'name', title: t('rumProject.appName') },
  { colKey: 'enabled', title: t('rumProject.status'), width: 120 },
  { colKey: 'errorGroups', title: t('rumProject.errorGroups'), width: 150 },
  { colKey: 'events7d', title: t('rumProject.events7d'), width: 160 },
  { colKey: 'action', title: '', width: 130 },
])
</script>

<template>
  <section class="rum-project-overview">
    <t-alert
      v-if="!projectId"
      theme="info"
      :message="t('rumProject.noProject')"
    />
    <t-alert
      v-else-if="!canRead"
      theme="warning"
      :message="t('rum.noPermission')"
    />
    <RumState
      v-else
      :loading="resource.loading.value"
      :error="resource.error.value"
      @retry="resource.reload"
    >
      <template v-if="resource.data.value">
        <RumKpiGrid
          class="rum-project-overview__kpis"
          :items="kpis"
        />
        <t-card class="rum-project-overview__card">
          <template #title>{{ t('rumProject.appOverview') }}</template>
          <template #actions>
            <span class="rum-project-overview__scope">
              {{ org.currentOrganization?.name ?? '-' }} /
              {{ org.currentProject?.name ?? '-' }}
            </span>
          </template>
          <t-table
            row-key="id"
            :data="resource.data.value.apps"
            :columns="columns"
            :empty="t('rum.empty')"
            hover
          >
            <template #enabled="{ row }"
              ><t-tag
                :theme="row.enabled ? 'success' : 'default'"
                variant="light"
                >{{
                  t(row.enabled ? 'rumApps.enabled' : 'rumApps.disabled')
                }}</t-tag
              ></template
            >
            <template #action="{ row }"
              ><t-link
                theme="primary"
                :href="undefined"
                @click="
                  $router.push({
                    name: 'rum-app-detail',
                    params: { projectId, appId: row.id },
                  })
                "
                >{{ t('rumProject.appLink') }}</t-link
              ></template
            >
          </t-table>
        </t-card>
      </template>
    </RumState>
  </section>
</template>

<style scoped lang="less">
.rum-project-overview {
  min-width: 0;

  &__kpis {
    margin-bottom: @beacon-gap-l;
  }

  &__scope {
    color: @beacon-text-secondary;
  }
}
</style>
