<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { useProbeList } from '@/composables/useProbeList'
import { RefreshIcon, ServerIcon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import { PROBE_PROVIDERS, probeProviderLabelKey } from '@/utils/admin-presenter'
import { formatDateTime } from '@/utils/billing'

defineOptions({ name: 'ProbesOverviewView' })
const { t } = useI18n()
const org = useOrganizationStore()
const { canManage } = useOrganizationRole()
const { probes, loading, error, load } = useProbeList(computed(() => org.currentOrganizationId))
const stats = computed(() => [
  { key: 'total', value: probes.value.length, query: {} },
  {
    key: 'online',
    value: probes.value.filter((p) => p.enabled && p.status === 'ONLINE').length,
    query: { status: 'ONLINE' },
  },
  {
    key: 'offline',
    value: probes.value.filter((p) => p.enabled && p.status === 'OFFLINE').length,
    query: { status: 'OFFLINE' },
  },
  {
    key: 'disabled',
    value: probes.value.filter((p) => !p.enabled).length,
    query: { status: 'disabled' },
  },
])
const boundCount = computed(
  () => new Set(probes.value.flatMap((p) => p.monitors.map((m) => m.id))).size,
)
const resultCount = computed(() =>
  probes.value.reduce((sum, probe) => sum + (probe.resultCount ?? 0), 0),
)
const recent = computed(() =>
  [...probes.value].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8),
)
const providers = computed(() =>
  PROBE_PROVIDERS.map((provider) => ({
    provider,
    count: probes.value.filter((p) => p.provider === provider).length,
  })),
)
</script>

<template>
  <section class="probe-overview">
    <HeaderActions
      ><t-tooltip :content="t('probePage.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!canManage"
          :aria-label="t('probePage.refresh')"
          @click="load"
          ><AppIcon :icon="RefreshIcon" /></t-button></t-tooltip
    ></HeaderActions>
    <t-alert v-if="!canManage" theme="info" :message="t('probePage.noPermission')" />
    <t-alert v-else-if="error" theme="error" :message="error"
      ><t-button @click="load">{{ t('probePage.retry') }}</t-button></t-alert
    >
    <div v-else-if="loading" class="probe-overview__state">
      <t-loading :text="t('common.loading')" />
    </div>
    <template v-else>
      <header>
        <h3>{{ t('probePage.overview') }}</h3>
        <span>{{ org.currentOrganization?.name }}</span>
      </header>
      <div class="probe-overview__stats">
        <RouterLink
          v-for="stat in stats"
          :key="stat.key"
          :to="{ name: 'probes', query: stat.query }"
          :class="`is-${stat.key}`"
        >
          <span>{{ t(`probePage.${stat.key}`) }}</span
          ><strong>{{ stat.value }}</strong>
        </RouterLink>
        <div>
          <span>{{ t('probePage.bound') }}</span
          ><strong>{{ boundCount }}</strong>
        </div>
        <div>
          <span>{{ t('probePage.resultCount') }}</span
          ><strong>{{ resultCount }}</strong>
        </div>
      </div>
      <div class="probe-overview__sections">
        <section>
          <h3>{{ t('probePage.provider') }}</h3>
          <RouterLink
            v-for="item in providers"
            :key="item.provider"
            class="probe-overview__provider"
            :to="{ name: 'probes', query: { provider: item.provider } }"
          >
            <span>{{ t(probeProviderLabelKey(item.provider)) }}</span
            ><strong>{{ item.count }}</strong>
            <t-progress
              :percentage="probes.length ? Math.round((item.count / probes.length) * 100) : 0"
              :label="false"
            />
          </RouterLink>
        </section>
        <section>
          <h3>{{ t('probePage.recent') }}</h3>
          <div v-if="!recent.length" class="probe-overview__state">
            <AppIcon :icon="ServerIcon" :size="32" />{{ t('probePage.empty') }}
          </div>
          <RouterLink
            v-for="probe in recent"
            :key="probe.id"
            class="probe-overview__recent"
            :to="{ name: 'probes', query: { q: probe.id } }"
          >
            <AppIcon :icon="ServerIcon" />
            <div>
              <strong>{{ probe.name }}</strong
              ><small>{{ probe.region }}</small>
            </div>
            <time>{{ formatDateTime(probe.createdAt) }}</time>
          </RouterLink>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped lang="less">
.probe-overview {
  min-width: 0;
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  header > span {
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }
  h3 {
    font-size: 16px;
    margin: 0 0 16px;
  }
  &__stats {
    background: @beacon-bg-container;
    padding: 20px;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  &__stats > * {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: @beacon-text-secondary;
  }
  &__stats strong {
    font-size: 24px;
    line-height: 32px;
    color: @beacon-text-primary;
    font-variant-numeric: tabular-nums;
  }
  &__stats .is-online strong {
    color: @beacon-success;
  }
  &__stats .is-offline strong {
    color: @beacon-error;
  }
  &__sections {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: 24px;
  }
  &__sections > section {
    min-width: 0;
  }
  &__provider {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 16px 0;
    border-bottom: 1px solid @beacon-border;
    color: @beacon-text-primary;
  }
  &__provider :deep(.t-progress) {
    grid-column: 1 / -1;
  }
  &__recent {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 16px 0;
    color: @beacon-text-primary;
    border-bottom: 1px solid @beacon-border;
  }
  &__recent strong {
    overflow-wrap: anywhere;
  }
  &__recent small {
    display: block;
    margin-top: 6px;
    color: @beacon-text-secondary;
  }
  &__recent time {
    color: @beacon-text-secondary;
    font-size: 12px;
  }
  &__state {
    min-height: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: @beacon-text-secondary;
  }
  @media (max-width: 900px) {
    &__stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    &__sections {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 600px) {
    &__stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    &__recent {
      grid-template-columns: 16px minmax(0, 1fr);
    }
    &__recent time {
      grid-column: 2;
    }
  }
}
</style>
