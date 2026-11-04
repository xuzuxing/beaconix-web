<script setup lang="ts">
import '@/assets/styles/rum-filters.css'
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listRumReplays } from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumState from './RumState.vue'
import RumPager from './RumPager.vue'
const { t } = useI18n()
const { projectId: p, appId: a, router } = useRumContext()
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
function search() {
  page.value = 1
  filter.value = { ...draft }
}
</script>
<template>
  <form
    class="filters rum-filter"
    @submit.prevent="search"
  >
    <t-input
      class="rum-filter__field"
      v-model="draft.release"
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
    ><t-empty
      v-if="!resource.data.value?.items.length"
      :description="t('rum.empty')" />
    <article
      v-for="item in resource.data.value?.items"
      :key="item.id"
    >
      <t-button
        variant="text"
        @click="
          router.push({
            name: 'rum-replay-detail',
            params: { projectId: p, appId: a, replayId: item.id },
          })
        "
        >{{ item.sessionKey }}</t-button
      >
      <p>
        {{ t('rum.started') }}: {{ item.startedAt }} ·
        {{ t('rum.lastSeenReplay') }}: {{ item.lastSeenAt }}
      </p>
      <p>
        {{ t('rum.chunks') }}: {{ item.chunkCount }} ·
        {{ t('rum.eventCount') }}: {{ item.eventCount }} · {{ t('rum.size') }}:
        {{ item.sizeBytes }} B
      </p>
    </article>
    <RumPager
      v-if="resource.data.value"
      v-model="page"
      :total="resource.data.value.total"
      :limit="resource.data.value.limit"
  /></RumState>
</template>
<style scoped>
article {
  padding: 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  overflow-wrap: anywhere;
}
p {
  margin: 6px 0;
  color: var(--td-text-color-secondary);
}
</style>
