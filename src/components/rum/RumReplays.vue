<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listRumReplays } from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumState from './RumState.vue'
import RumPager from './RumPager.vue'
const { t } = useI18n()
const { projectId: p, appId: a } = useRumContext()
const page = ref(1)
const draft = reactive({ release: '', from: '', to: '' })
const filter = ref({ ...draft })
const resource = useRumResource(
  (signal) =>
    listRumReplays(
      p.value,
      a.value,
      {
        ...filter.value,
        from: filter.value.from
          ? new Date(filter.value.from).toISOString()
          : undefined,
        to: filter.value.to
          ? new Date(filter.value.to).toISOString()
          : undefined,
        page: page.value,
        limit: 20,
      },
      { signal },
    ),
  [p, a, page, filter],
)
const columns = [
  { colKey: 'sessionKey', title: t('rum.sessionKey'), ellipsis: true },
  { colKey: 'release', title: t('rum.release'), width: 140 },
  { colKey: 'startedAt', title: t('rum.started'), width: 180 },
  { colKey: 'lastSeenAt', title: t('rum.lastSeenReplay'), width: 180 },
  { colKey: 'chunkCount', title: t('rum.chunks'), width: 100 },
  { colKey: 'eventCount', title: t('rum.eventCount'), width: 100 },
  { colKey: 'sizeBytes', title: t('rum.size'), width: 120 },
]
function search() {
  page.value = 1
  filter.value = { ...draft }
}
function replayTarget(id: string) {
  return {
    name: 'rum-replay-detail',
    params: { projectId: p.value, appId: a.value, replayId: id },
  }
}
function formatSize(value?: number | null) {
  return typeof value === 'number' ? `${value} B` : '—'
}
</script>
<template>
  <t-card class="rum-replays">
    <template #title>{{ t('rum.replays') }}</template>
    <template #actions>
      <span class="rum-replays__total">
        {{ t('rum.total') }}: {{ resource.data.value?.total ?? '—' }}
      </span>
    </template>
    <form
      class="filters rum-filter"
      @submit.prevent="search"
    >
      <t-input
        v-model="draft.release"
        class="rum-filter__field"
        :placeholder="t('rum.release')"
      /><label class="rum-filter__field rum-filter__date"
        >{{ t('rum.from') }}
        <t-date-picker
          v-model="draft.from"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          clearable /></label
      ><label class="rum-filter__field rum-filter__date"
        >{{ t('rum.to') }}
        <t-date-picker
          v-model="draft.to"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          clearable /></label
      ><t-button type="submit">{{ t('rum.search') }}</t-button>
    </form>
    <RumState
      :loading="resource.loading.value"
      :error="resource.error.value"
      @retry="resource.reload"
    >
      <template v-if="resource.data.value">
        <t-table
          row-key="id"
          :data="resource.data.value.items"
          :columns="columns"
          :empty="t('rum.empty')"
          hover
        >
          <template #sessionKey="{ row }"
            ><router-link :to="replayTarget(row.id)">{{
              row.sessionKey
            }}</router-link></template
          >
          <template #sizeBytes="{ row }">{{
            formatSize(row.sizeBytes)
          }}</template>
        </t-table>
        <RumPager
          v-model="page"
          :total="resource.data.value.total"
          :limit="resource.data.value.limit"
        />
      </template>
    </RumState>
  </t-card>
</template>
<style scoped lang="less">
.rum-replays {
  min-width: 0;

  &__total {
    color: @beacon-text-secondary;
  }
}
</style>
