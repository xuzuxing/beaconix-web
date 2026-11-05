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
function openReplay(id: string) {
  void router.push({
    name: 'rum-replay-detail',
    params: { projectId: p.value, appId: a.value, replayId: id },
  })
}
</script>

<template>
  <t-card class="replays-panel">
    <template #title>{{ t('rum.replays') }}</template>
    <template #actions>
      <span class="replays-panel__hint">
        {{ t('rum.total') }}: {{ resource.data.value?.total ?? 0 }}
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
      />
      <label class="rum-filter__field rum-filter__date">
        {{ t('rum.from') }}
        <t-date-picker
          v-model="draft.from"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          clearable
        />
      </label>
      <label class="rum-filter__field rum-filter__date">
        {{ t('rum.to') }}
        <t-date-picker
          v-model="draft.to"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          clearable
        />
      </label>
      <t-button type="submit">{{ t('rum.search') }}</t-button>
    </form>

    <RumState
      :loading="resource.loading.value"
      :error="resource.error.value"
      @retry="resource.reload"
    >
      <div
        v-if="!resource.data.value?.items.length"
        class="replays-panel__empty"
      >
        {{ t('rum.empty') }}
      </div>
      <div
        v-else
        class="replays-panel__table"
      >
        <div class="replays-panel__head">
          <span>{{ t('rum.sessionId') }}</span>
          <span>{{ t('rum.started') }}</span>
          <span>{{ t('rum.lastSeenReplay') }}</span>
          <span>{{ t('rum.chunks') }} / {{ t('rum.eventCount') }} / {{ t('rum.size') }}</span>
        </div>
        <article
          v-for="item in resource.data.value.items"
          :key="item.id"
          class="replays-panel__row"
        >
          <div class="replays-panel__session">
            <t-button
              variant="text"
              @click="openReplay(item.id)"
            >
              {{ item.sessionKey }}
            </t-button>
            <small v-if="item.release">{{ item.release }}</small>
          </div>
          <time class="replays-panel__time">{{ item.startedAt }}</time>
          <time class="replays-panel__time">{{ item.lastSeenAt }}</time>
          <div class="replays-panel__meta">
            {{ item.chunkCount }} · {{ item.eventCount }} · {{ item.sizeBytes }} B
          </div>
        </article>
      </div>
      <RumPager
        v-if="resource.data.value"
        v-model="page"
        :total="resource.data.value.total"
        :limit="resource.data.value.limit"
      />
    </RumState>
  </t-card>
</template>

<style scoped lang="less">
.replays-panel {
  min-width: 0;

  &__hint {
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__head,
  .replays-panel__row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 180px 180px 200px;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__head {
    color: @beacon-text-secondary;
    font-size: 12px;
    background: @beacon-bg-page;
  }

  &__row {
    min-width: 0;
  }

  &__row:hover {
    background: @beacon-bg-page;
  }

  &__session {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;

    :deep(.t-button) {
      justify-content: flex-start;
      padding: 0;
      overflow: hidden;
      font-weight: 600;
      text-align: left;

      .t-button__text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    small {
      color: @beacon-text-tertiary;
      font-size: 11px;
    }
  }

  &__time,
  &__meta {
    overflow: hidden;
    color: @beacon-text-secondary;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    font-variant-numeric: tabular-nums;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    color: @beacon-text-tertiary;
  }
}

@media (max-width: 1100px) {
  .replays-panel__head,
  .replays-panel .replays-panel__row {
    grid-template-columns: minmax(180px, 1fr) 180px 200px;
  }

  .replays-panel__head > :nth-child(3),
  .replays-panel__row > :nth-child(3) {
    display: none;
  }
}

@media (max-width: 700px) {
  .replays-panel__head {
    display: none;
  }

  .replays-panel .replays-panel__row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 16px;
    padding: 16px 8px;
  }

  .replays-panel__session {
    grid-column: 1 / -1;
  }
}
</style>
