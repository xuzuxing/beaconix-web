<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getRumReplay, listRumReplayChunks } from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import { usePageHeader } from '@/composables/usePageHeader'
import { loadReplayTimeline, sanitizeReplaySnapshot } from '@/utils/rum-replay'
import RumState from '@/components/rum/RumState.vue'
const { t } = useI18n()
const { route, projectId: p, appId: a, canReadRum } = useRumContext()
usePageHeader({
  back: () => ({
    name: 'rum-app-detail',
    params: { projectId: p.value, appId: a.value },
    query: { tab: 'replays' },
  }),
})
const id = computed(() => String(route.params.replayId ?? ''))
const index = ref(0)
const playing = ref(false)
const speed = ref(1)
const metadata = useRumResource(
  (signal) =>
    canReadRum.value
      ? getRumReplay(p.value, a.value, id.value, { signal })
      : Promise.reject(new Error('RUM access denied')),
  [p, a, id, canReadRum],
)
const timeline = useRumResource(
  (signal) =>
    canReadRum.value
      ? loadReplayTimeline((cursor) =>
          listRumReplayChunks(p.value, a.value, id.value, cursor, { signal }),
        )
      : Promise.reject(new Error('RUM access denied')),
  [p, a, id, canReadRum],
)
/** 元信息与时间轴是同一屏的两块数据，合并成一次加载与重试 */
const loading = computed(() => metadata.loading.value || timeline.loading.value)
const failed = computed(() => metadata.error.value || timeline.error.value)
function retry() {
  metadata.reload()
  timeline.reload()
}
watch(
  [p, a, id, canReadRum],
  () => {
    index.value = 0
    playing.value = false
  },
  { flush: 'sync' },
)
const snapshot = computed(() => {
  const event = timeline.data.value
    ?.slice(0, index.value + 1)
    .reverse()
    .find((x) => x.type === 'snapshot' && typeof x.data.html === 'string')
  return event ? sanitizeReplaySnapshot(String(event.data.html)) : ''
})
const current = computed(() => timeline.data.value?.[index.value])
const marker = computed(() => {
  const event = current.value
  if (
    event?.type !== 'click' ||
    typeof event.data.x !== 'number' ||
    typeof event.data.y !== 'number' ||
    !Number.isFinite(event.data.x) ||
    !Number.isFinite(event.data.y)
  )
    return null
  return {
    left: `clamp(0px, ${Math.max(0, event.data.x)}px, 100%)`,
    top: `clamp(0px, ${Math.max(0, event.data.y)}px, 100%)`,
  }
})
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  [playing, index, speed, () => timeline.data.value],
  () => {
    if (timer) clearTimeout(timer)
    const events = timeline.data.value ?? []
    if (!playing.value || index.value >= events.length - 1) {
      if (index.value >= events.length - 1) playing.value = false
      return
    }
    const wait = Math.max(
      100,
      Math.min(
        5000,
        (Date.parse(events[index.value + 1]!.at) -
          Date.parse(events[index.value]!.at)) /
          speed.value || 500,
      ),
    )
    timer = setTimeout(() => index.value++, wait)
  },
  { immediate: true },
)
onScopeDispose(() => {
  if (timer) clearTimeout(timer)
})
</script>
<template>
  <section class="rum-replay">
    <t-alert
      theme="warning"
      :message="t('rum.replayNotice')"
    />
    <t-alert
      v-if="!canReadRum"
      theme="warning"
      :message="t('rum.noPermission')"
    />
    <RumState
      v-else
      :loading="loading"
      :error="failed"
      @retry="retry"
    >
      <t-card class="rum-replay__card">
        <template #title>{{ t('rum.replayTitle') }}</template>
        <template #actions>
          <span
            v-if="metadata.data.value"
            class="rum-replay__meta"
          >
            {{ metadata.data.value.sessionKey }} ·
            {{ metadata.data.value.startedAt }} ·
            {{ metadata.data.value.eventCount }} {{ t('rum.eventCount') }}
          </span>
        </template>
        <template v-if="timeline.data.value?.length">
          <div class="rum-replay__controls">
            <t-button @click="playing = !playing">{{
              t(playing ? 'rum.pause' : 'rum.play')
            }}</t-button>
            <label class="rum-replay__speed"
              >{{ t('rum.speed') }}
              <t-select
                v-model="speed"
                :options="[
                  { value: 0.5, label: '0.5×' },
                  { value: 1, label: '1×' },
                  { value: 2, label: '2×' },
                  { value: 4, label: '4×' },
                ]"
            /></label>
            <label class="rum-replay__position"
              >{{ t('rum.position') }}
              <t-slider
                v-model="index"
                :min="0"
                :max="timeline.data.value.length - 1"
            /></label>
            <span class="rum-replay__meta"
              >{{ index + 1 }} / {{ timeline.data.value.length }}</span
            >
          </div>
          <t-alert
            v-if="timeline.data.value.some((e) => e.type === 'truncated')"
            theme="warning"
            :message="t('rum.truncated')"
          />
          <div class="rum-replay__grid">
            <section class="rum-replay__pane">
              <h3 class="rum-replay__title">{{ t('rum.snapshot') }}</h3>
              <div
                v-if="snapshot"
                class="rum-replay__frame"
              >
                <iframe
                  title="Replay snapshot"
                  sandbox=""
                  :srcdoc="snapshot"
                />
                <span
                  v-if="marker"
                  class="rum-replay__marker"
                  :style="marker"
                  aria-hidden="true"
                ></span>
              </div>
              <p
                v-else
                class="rum-replay__meta"
              >
                {{ t('rum.noSnapshot') }}
              </p>
            </section>
            <section class="rum-replay__pane">
              <h3 class="rum-replay__title">
                {{ current?.type }} · {{ current?.at }}
              </h3>
              <pre class="rum-replay__code">{{
                JSON.stringify(current?.data, null, 2)
              }}</pre>
              <ol class="rum-replay__timeline">
                <li
                  v-for="(event, i) in timeline.data.value"
                  :key="i"
                >
                  <t-link
                    theme="primary"
                    @click="index = i"
                    >{{ event.at }} · {{ event.type }}</t-link
                  >
                </li>
              </ol>
            </section>
          </div>
        </template>
        <t-empty
          v-else
          :description="t('rum.empty')"
        />
      </t-card>
    </RumState>
  </section>
</template>
<style scoped lang="less">
.rum-replay {
  min-width: 0;

  &__card {
    margin-top: @beacon-gap-l;
  }

  &__meta {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: @beacon-gap-l;
    margin-bottom: @beacon-gap-l;
  }

  &__speed {
    display: flex;
    align-items: center;
    gap: @beacon-gap;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__position {
    display: flex;
    flex: 1 1 220px;
    align-items: center;
    gap: @beacon-gap;
    min-width: 220px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;

    :deep(.t-slider) {
      flex: 1;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: @beacon-gap-l;
    margin-top: @beacon-gap-l;
  }

  &__pane {
    min-width: 0;
  }

  &__title {
    margin: 0 0 @beacon-gap;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__frame {
    position: relative;
  }

  &__frame iframe {
    width: 100%;
    height: 500px;
    background-color: #fff;
    border: 1px solid @beacon-border;
  }

  &__marker {
    position: absolute;
    width: 16px;
    height: 16px;
    pointer-events: none;
    background-color: @beacon-error;
    border: 2px solid @beacon-bg-container;
    border-radius: 50%;
    // @beacon-* 是 CSS 变量，less 的 fade() 处理不了，用 color-mix 稀释
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--td-error-color) 50%, transparent);
    transform: translate(-50%, -50%);
  }

  &__code {
    max-height: 240px;
    margin: 0;
    padding: @beacon-gap;
    overflow: auto;
    font-family: @beacon-font-family-code;
    font-size: @beacon-font-size-base;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background-color: @beacon-bg-active;
  }

  &__timeline {
    display: grid;
    gap: 4px;
    max-height: 240px;
    margin-top: @beacon-gap;
    overflow: auto;

    :deep(.t-link) {
      font-variant-numeric: tabular-nums;
    }
  }

  @media (max-width: 768px) {
    &__grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
