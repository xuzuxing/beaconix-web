<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { compareRumReleases, listRumReleases } from '@/api/modules/rum'
import type { RumReleaseGroup } from '@/api/types/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumReleaseCompare from './RumReleaseCompare.vue'
import RumState from './RumState.vue'

const { t } = useI18n()
const { projectId: p, appId: a, router } = useRumContext()
const base = shallowRef('')
const target = shallowRef('')
const releases = useRumResource(
  (signal) => listRumReleases(p.value, a.value, { signal }),
  [p, a],
)
const comparison = useRumResource(
  (signal) =>
    base.value !== target.value
      ? compareRumReleases(p.value, a.value, base.value, target.value, {
          signal,
        })
      : Promise.resolve(null),
  [p, a, base, target],
)

const options = computed(() =>
  (releases.data.value?.items ?? []).map((item) => ({
    value: item.release ?? '',
    label: item.release ?? t('rum.unknownRelease'),
  })),
)

watch(
  () => releases.data.value,
  (data) => {
    const values = data?.items.map((item) => item.release ?? '') ?? []
    if (!values.includes(target.value)) target.value = values[0] ?? ''
    if (!values.includes(base.value) || base.value === target.value)
      base.value = values[1] ?? values[0] ?? ''
  },
  { immediate: true },
)

function openError(group: RumReleaseGroup) {
  void router.push({
    name: 'rum-error-detail',
    params: { projectId: p.value, appId: a.value, errorId: group.id },
  })
}
</script>

<template>
  <div class="releases">
    <RumState
      :loading="releases.loading.value"
      :error="releases.error.value"
      @retry="releases.reload"
    >
      <t-card>
        <h2 class="releases__title">{{ t('rum.releaseList') }}</h2>
        <t-empty
          v-if="!releases.data.value?.items.length"
          :description="t('rum.empty')"
        />
        <div
          v-else
          class="releases__scroll"
        >
          <table class="releases__table">
            <thead>
              <tr>
                <th>{{ t('rum.release') }}</th>
                <th>{{ t('rum.firstSeen') }}</th>
                <th>{{ t('rum.lastSeen') }}</th>
                <th>{{ t('rum.errorGroups') }}</th>
                <th>{{ t('rum.occurrences') }}</th>
                <th>{{ t('rum.events') }}</th>
                <th>{{ t('rum.replays') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in releases.data.value?.items"
                :key="item.release ?? '__unknown__'"
              >
                <td>{{ item.release ?? t('rum.unknownRelease') }}</td>
                <td>{{ item.firstSeenAt || '—' }}</td>
                <td>{{ item.lastSeenAt || '—' }}</td>
                <td>{{ item.errorGroups }}</td>
                <td>{{ item.occurrences }}</td>
                <td>{{ item.events }}</td>
                <td>{{ item.replays }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </t-card>
    </RumState>

    <t-card class="releases__compare">
      <h2 class="releases__title">{{ t('rum.releaseCompare') }}</h2>
      <div class="releases__selectors">
        <label>
          {{ t('rum.baseRelease') }}
          <t-select
            v-model="base"
            :options="options"
          />
        </label>
        <label>
          {{ t('rum.targetRelease') }}
          <t-select
            v-model="target"
            :options="options"
          />
        </label>
      </div>
      <t-alert
        v-if="base === target"
        theme="info"
        :message="t('rum.releaseCompareHint')"
      />
      <RumState
        v-else
        :loading="comparison.loading.value"
        :error="comparison.error.value"
        @retry="comparison.reload"
      >
        <RumReleaseCompare
          v-if="comparison.data.value"
          :comparison="comparison.data.value"
          @open-error="openError"
        />
      </RumState>
    </t-card>
  </div>
</template>

<style scoped>
.releases {
  display: grid;
  gap: 28px;
}

.releases__title {
  margin: 0 0 12px;
}

.releases__scroll {
  overflow-x: auto;
}

.releases__table {
  width: 100%;
  border-collapse: collapse;
}

.releases__table th,
.releases__table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  text-align: left;
  white-space: nowrap;
}

.releases__compare {
  display: grid;
  gap: 14px;
}

.releases__selectors {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 12px;
}

.releases__selectors label {
  display: grid;
  gap: 6px;
}

@media (max-width: 720px) {
  .releases__selectors {
    grid-template-columns: 1fr;
  }
}
</style>
