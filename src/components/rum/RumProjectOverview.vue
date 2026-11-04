<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProjectRumOverview } from '@/api/modules/rum'
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
const cards = computed(() => [
  {
    label: t('rumProject.appCount'),
    value: resource.data.value?.appCount,
    hint: '',
  },
  {
    label: t('rumProject.errorGroups'),
    value: resource.data.value?.errorGroups,
    hint: t('rumProject.retained'),
  },
  {
    label: t('rumProject.events7d'),
    value: resource.data.value?.events7d,
    hint: t('rum.recent7'),
  },
  {
    label: t('rum.replays'),
    value: resource.data.value?.replays,
    hint: t('rumProject.retained'),
  },
  {
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
  <section class="project-page">
    <header>
      <h1>{{ t('rumProject.overview') }}</h1>
      <p>{{ t('rumProject.overviewDesc') }}</p>
    </header>
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
        <div class="metrics">
          <t-card
            v-for="card in cards"
            :key="card.label"
            :bordered="false"
            class="metric"
          >
            <div class="metric__label">{{ card.label }}</div>
            <strong>{{ card.value ?? '—' }}</strong
            ><small>{{ card.hint }}</small>
          </t-card>
        </div>
        <t-card
          :title="t('rumProject.appOverview')"
          :bordered="false"
        >
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
<style scoped>
.project-page {
  min-width: 0;
}
header {
  margin-bottom: 24px;
}
h1 {
  margin: 0 0 8px;
  font-size: 24px;
}
header p,
.metric__label,
small {
  color: var(--td-text-color-secondary);
}
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.metric strong {
  display: block;
  font-size: 30px;
  line-height: 1.5;
}
small {
  display: block;
  min-height: 20px;
}
</style>
