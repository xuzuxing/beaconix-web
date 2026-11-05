<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { compareRumReleases, listRumReleases } from '@/api/modules/rum'
import type { RumReleaseCompare } from '@/api/types/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumState from './RumState.vue'

const { t } = useI18n()
const { projectId, appId, canReadRum, route } = useRumContext()
const releases = useRumResource(
  (signal) =>
    canReadRum.value
      ? listRumReleases(projectId.value, appId.value, { signal })
      : Promise.reject(new Error('RUM access denied')),
  [projectId, appId, canReadRum],
)
const base = ref(
  typeof route.query.releaseBase === 'string' ? route.query.releaseBase : '',
)
const target = ref(
  typeof route.query.releaseTarget === 'string'
    ? route.query.releaseTarget
    : '',
)
const comparison = ref<RumReleaseCompare | null>(null)
const comparing = ref(false)
const compareFailed = ref(false)
const options = computed(() =>
  (releases.data.value?.items ?? []).map((item) => ({
    value: item.release ?? '',
    label: item.isUnknown ? t('rum.unknownRelease') : (item.release as string),
  })),
)
const columns = computed(() => [
  { colKey: 'release', title: t('rum.release'), width: 180 },
  { colKey: 'releaseRange', title: t('rum.releaseRange'), width: 340 },
  { colKey: 'errorGroups', title: t('rum.errorGroups'), width: 120 },
  { colKey: 'occurrences', title: t('rum.count'), width: 120 },
  { colKey: 'events', title: t('rum.events'), width: 100 },
  { colKey: 'replays', title: t('rum.replays'), width: 100 },
])
async function runCompare() {
  if (comparing.value || base.value === target.value) return
  comparing.value = true
  compareFailed.value = false
  try {
    comparison.value = await compareRumReleases(
      projectId.value,
      appId.value,
      base.value,
      target.value,
    )
  } catch {
    comparison.value = null
    compareFailed.value = true
  } finally {
    comparing.value = false
  }
}
const sections = computed(() => [
  { key: 'new' as const, label: t('rum.releaseNew'), tone: 'warning' },
  { key: 'fixed' as const, label: t('rum.releaseFixed'), tone: 'success' },
  {
    key: 'regressed' as const,
    label: t('rum.releaseRegressed'),
    tone: 'danger',
  },
])
</script>

<template>
  <div class="rum-releases">
    <t-card>
      <template #title>{{ t('rum.releases') }}</template>
      <template #actions>
        <span class="rum-releases__hint">{{
          t('rum.releaseUnknownHint')
        }}</span>
      </template>
      <RumState
        :loading="releases.loading.value"
        :error="releases.error.value"
        @retry="releases.reload"
      >
        <t-table
          v-if="releases.data.value"
          row-key="release"
          :data="releases.data.value.items"
          :columns="columns"
          :empty="t('rum.empty')"
          hover
        >
          <template #release="{ row }">
            {{ row.isUnknown ? t('rum.unknownRelease') : row.release }}
          </template>
          <template #releaseRange="{ row }">
            {{ row.firstSeenAt || '—' }} → {{ row.lastSeenAt || '—' }}
          </template>
        </t-table>
      </RumState>
    </t-card>

    <t-card class="rum-releases__compare">
      <template #title>{{ t('rum.releaseCompare') }}</template>
      <div class="rum-releases__controls">
        <label>
          {{ t('rum.releaseBase') }}
          <t-select
            v-model="base"
            :options="options"
            :placeholder="t('rum.releaseSelect')"
          />
        </label>
        <label>
          {{ t('rum.releaseTarget') }}
          <t-select
            v-model="target"
            :options="options"
            :placeholder="t('rum.releaseSelect')"
          />
        </label>
        <t-button
          theme="primary"
          :loading="comparing"
          :disabled="!base && !target"
          @click="runCompare"
          >{{ t('rum.releaseRunCompare') }}</t-button
        >
      </div>
      <t-alert
        v-if="compareFailed"
        theme="error"
        :message="t('rum.loadFailed')"
      />
      <template v-if="comparison">
        <div class="rum-releases__grid">
          <section
            v-for="section in sections"
            :key="section.key"
            class="rum-releases__column"
          >
            <header>
              <t-tag
                :theme="section.tone"
                variant="light"
                >{{ section.label }}</t-tag
              >
              <span>{{ comparison.counts[section.key] }}</span>
            </header>
            <t-empty
              v-if="!comparison[section.key].length"
              :description="t('rum.empty')"
            />
            <ul v-else>
              <li
                v-for="group in comparison[section.key]"
                :key="group.id"
              >
                <span class="rum-releases__message">{{ group.message }}</span>
                <small>{{ group.type }} · ×{{ group.count }}</small>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </t-card>
  </div>
</template>

<style scoped lang="less">
.rum-releases {
  display: grid;
  gap: @beacon-gap-l;
  min-width: 0;

  &__hint {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__compare {
    min-width: 0;
  }

  &__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: @beacon-gap-l;
    margin-bottom: @beacon-gap-l;

    label {
      display: grid;
      gap: 6px;
      min-width: 200px;
      color: @beacon-text-secondary;
      font-size: 12px;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: @beacon-gap-l;
  }

  &__column {
    min-width: 0;
    padding: 12px 14px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: @beacon-gap;
    }

    ul {
      display: grid;
      gap: @beacon-gap;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    small {
      color: @beacon-text-secondary;
    }
  }

  &__message {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
