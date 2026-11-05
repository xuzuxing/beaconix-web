<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProjectRumOverview } from '@/api/modules/rum'
import type { RumProjectOverview } from '@/api/types/rum'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { RefreshIcon } from '@/icons'
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
const appRows = computed(() => resource.data.value?.apps ?? [])
function appLink(app: RumProjectOverview['apps'][number]) {
  return {
    name: 'rum-app-detail',
    params: { projectId: projectId.value, appId: app.id },
  }
}
</script>

<template>
  <section class="project-page">
    <HeaderActions>
      <t-tooltip :content="t('rumProject.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="resource.loading.value"
          :disabled="!projectId"
          :aria-label="t('rumProject.refresh')"
          @click="resource.reload"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
    </HeaderActions>

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
        <t-card class="project-page__card">
          <template #title>{{ t('rumProject.keyMetrics') }}</template>
          <template #actions>
            <span class="project-page__scope">
              {{ org.currentOrganization?.name ?? '-' }} /
              {{ org.currentProject?.name ?? '-' }}
            </span>
          </template>
          <div class="project-page__kpis">
            <div
              v-for="card in cards"
              :key="card.label"
              class="project-page__kpi"
            >
              <span>{{ card.label }}</span>
              <strong>{{ card.value ?? '—' }}</strong>
              <small>{{ card.hint }}</small>
            </div>
          </div>
        </t-card>

        <t-card class="project-page__card">
          <template #title>{{ t('rumProject.appOverview') }}</template>
          <template #actions>
            <span class="project-page__hint">
              {{ t('rumProject.appCount') }}: {{ appRows.length }}
            </span>
          </template>
          <div
            v-if="!appRows.length"
            class="project-page__empty"
          >
            {{ t('rum.empty') }}
          </div>
          <div
            v-else
            class="project-page__table"
          >
            <div class="project-page__table-head">
              <span>{{ t('rumProject.appName') }}</span>
              <span>{{ t('rumProject.status') }}</span>
              <span>{{ t('rumProject.errorGroups') }}</span>
              <span>{{ t('rumProject.events7d') }}</span>
              <span>{{ t('rumApps.actions') }}</span>
            </div>
            <article
              v-for="app in appRows"
              :key="app.id"
              class="project-page__row"
            >
              <div class="project-page__app">
                <RouterLink :to="appLink(app)">{{ app.name }}</RouterLink>
              </div>
              <div>
                <t-tag
                  :theme="app.enabled ? 'success' : 'default'"
                  variant="light"
                >
                  {{ t(app.enabled ? 'rumApps.enabled' : 'rumApps.disabled') }}
                </t-tag>
              </div>
              <div class="project-page__num">{{ app.errorGroups }}</div>
              <div class="project-page__num">{{ app.events7d }}</div>
              <div>
                <RouterLink
                  class="project-page__action"
                  :to="appLink(app)"
                >
                  {{ t('rumProject.appLink') }}
                </RouterLink>
              </div>
            </article>
          </div>
        </t-card>
      </template>
    </RumState>
  </section>
</template>

<style scoped lang="less">
.project-page {
  min-width: 0;

  &__scope,
  &__hint {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__card {
    margin-bottom: 16px;
  }

  &__kpis {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 16px;
  }

  &__kpi {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 4px 0;

    span {
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    strong {
      font-size: 24px;
      font-weight: 600;
      line-height: 32px;
      overflow-wrap: anywhere;
      font-variant-numeric: tabular-nums;
    }

    small {
      min-height: 18px;
      color: @beacon-text-tertiary;
      font-size: 12px;
    }
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .project-page__row {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 120px 140px 160px 120px;
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

  &__row:hover {
    background: @beacon-bg-page;
  }

  &__app {
    min-width: 0;

    a {
      color: @beacon-text-primary;
      font-weight: 600;
      overflow-wrap: anywhere;

      &:hover {
        color: @beacon-brand;
      }
    }
  }

  &__num {
    font-variant-numeric: tabular-nums;
  }

  &__action {
    font-size: 12px;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 160px;
    color: @beacon-text-tertiary;
  }
}

@media (max-width: 1200px) {
  .project-page__kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .project-page__table-head,
  .project-page .project-page__row {
    grid-template-columns: minmax(180px, 1fr) 110px 130px 110px;
  }

  .project-page__table-head > :nth-child(3),
  .project-page__row > :nth-child(3) {
    display: none;
  }
}

@media (max-width: 700px) {
  .project-page__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-page__table-head {
    display: none;
  }

  .project-page .project-page__row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px 16px;
    padding: 16px 8px;
  }

  .project-page__row > :nth-child(1) {
    grid-column: 1 / -1;
  }
}
</style>
