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
  <section class="replay">
    <t-alert
      theme="warning"
      :message="t('rum.replayNotice')"
    /><t-alert
      v-if="!canReadRum"
      theme="warning"
      :message="t('rum.noPermission')"
    /><template v-else
      ><RumState
        :loading="metadata.loading.value"
        :error="metadata.error.value"
        @retry="metadata.reload"
        ><p v-if="metadata.data.value">
          {{ metadata.data.value.sessionKey }} ·
          {{ metadata.data.value.startedAt }} ·
          {{ metadata.data.value.eventCount }} {{ t('rum.eventCount') }}
        </p></RumState
      ><RumState
        :loading="timeline.loading.value"
        :error="timeline.error.value"
        @retry="timeline.reload"
        ><template v-if="timeline.data.value?.length"
          ><div class="controls">
            <t-button @click="playing = !playing">{{
              t(playing ? 'rum.pause' : 'rum.play')
            }}</t-button
            ><label
              >{{ t('rum.speed') }}
              <t-select
                v-model="speed"
                :options="[
                  { value: 0.5, label: '0.5×' },
                  { value: 1, label: '1×' },
                  { value: 2, label: '2×' },
                  { value: 4, label: '4×' },
                ]" /></label
            ><label class="controls__position"
              >{{ t('rum.position') }}
              <t-slider
                v-model="index"
                :min="0"
                :max="timeline.data.value.length - 1" /></label
            ><span>{{ index + 1 }} / {{ timeline.data.value.length }}</span>
          </div>
          <t-alert
            v-if="timeline.data.value.some((e) => e.type === 'truncated')"
            theme="warning"
            :message="t('rum.truncated')"
          />
          <div class="replay__grid">
            <div>
              <h3>{{ t('rum.snapshot') }}</h3>
              <div
                v-if="snapshot"
                class="replay__frame"
              >
                <iframe
                  title="Replay snapshot"
                  sandbox=""
                  :srcdoc="snapshot"
                />
                <span
                  v-if="marker"
                  class="replay__marker"
                  :style="marker"
                  aria-hidden="true"
                ></span>
              </div>
              <p v-else>{{ t('rum.noSnapshot') }}</p>
            </div>
            <div>
              <h3>{{ current?.type }} · {{ current?.at }}</h3>
              <pre>{{ JSON.stringify(current?.data, null, 2) }}</pre>
              <ol>
                <li
                  v-for="(event, i) in timeline.data.value"
                  :key="i"
                >
                  <t-button
                    variant="text"
                    @click="index = i"
                    >{{ event.at }} · {{ event.type }}</t-button
                  >
                </li>
              </ol>
            </div>
          </div></template
        ><t-empty
          v-else
          :description="t('rum.empty')" /></RumState
    ></template>
  </section>
</template>
<style scoped>
.replay {
  min-width: 0;
}
.controls {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  margin: 16px 0;
}
.controls__position {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 220px;
  flex: 1;
}
.controls__position :deep(.t-slider) {
  flex: 1;
}
.replay__grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
.replay__frame {
  position: relative;
}
.replay__marker {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid white;
  background: #d54941;
  box-shadow: 0 0 0 3px #d5494180;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
iframe {
  width: 100%;
  height: 500px;
  border: 1px solid var(--td-border-level-1-color);
  background: white;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
ol {
  max-height: 360px;
  overflow: auto;
}
button {
  cursor: pointer;
}
@media (max-width: 768px) {
  .replay__grid {
    grid-template-columns: 1fr;
  }
}
</style>
