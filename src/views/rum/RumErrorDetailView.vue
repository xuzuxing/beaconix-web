<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { updateRumError } from '@/api/modules/rum'
import type { RumErrorStatus } from '@/api/types/rum'
import RumBreadcrumbs from '@/components/rum/RumBreadcrumbs.vue'
import RumErrorNotes from '@/components/rum/RumErrorNotes.vue'
import RumErrorStats from '@/components/rum/RumErrorStats.vue'
import RumErrorSummary from '@/components/rum/RumErrorSummary.vue'
import RumErrorWorkflow from '@/components/rum/RumErrorWorkflow.vue'
import RumOccurrenceContext from '@/components/rum/RumOccurrenceContext.vue'
import RumOccurrenceList from '@/components/rum/RumOccurrenceList.vue'
import RumState from '@/components/rum/RumState.vue'
import { usePageHeader } from '@/composables/usePageHeader'
import { useRumErrorDetail } from '@/composables/useRumErrorDetail'

const { t } = useI18n()
const {
  route,
  router,
  projectId,
  appId,
  canReadRum,
  error,
  occurrences,
  occurrencePage,
  selectedOccurrenceId,
  selectedOccurrence,
  selectOccurrence,
} = useRumErrorDetail()

usePageHeader({
  title: () => error.data.value?.message,
  back: () =>
    route.query.returnTo === 'project-errors'
      ? { path: '/rum/errors', query: { ...route.query, returnTo: undefined } }
      : {
          name: 'rum-app-detail',
          params: { projectId: projectId.value, appId: appId.value },
          query: { ...route.query, tab: 'errors' },
        },
})

const acting = ref(false)
const occurrenceItems = computed(() => occurrences.data.value?.items ?? [])
const canTrace = computed(() => Boolean(error.data.value?.replaySessionId))

async function setStatus(status: RumErrorStatus) {
  if (!error.data.value || acting.value) return
  acting.value = true
  try {
    await updateRumError(projectId.value, appId.value, error.data.value.id, {
      status,
    })
    await error.reload()
    void MessagePlugin.success(
      t(status === 'RESOLVED' ? 'rum.quickResolved' : 'rum.quickIgnored'),
    )
  } catch {
    void MessagePlugin.error(t('rum.failed'))
  } finally {
    acting.value = false
  }
}

function openTrace() {
  const replayId = error.data.value?.replaySessionId
  if (!replayId) {
    void MessagePlugin.warning(t('rum.traceUnavailable'))
    return
  }
  void router.push({
    name: 'rum-replay-detail',
    params: { projectId: projectId.value, appId: appId.value, replayId },
    query: { ...route.query, tab: 'replays' },
  })
}

async function locateUser() {
  const value =
    selectedOccurrence.value?.endUserId ||
    selectedOccurrence.value?.anonymousId ||
    error.data.value?.replaySessionId
  if (!value) {
    void MessagePlugin.warning(t('rum.noUserLocated'))
    return
  }
  try {
    await navigator.clipboard.writeText(value)
    void MessagePlugin.success(t('rum.userLocated', { value }))
  } catch {
    void MessagePlugin.warning(t('rum.failed'))
  }
}
</script>

<template>
  <section class="error-detail">
    <t-alert
      v-if="!canReadRum"
      theme="warning"
      :message="t('rum.noPermission')"
    />
    <template v-else>
      <RumState
        :loading="error.loading.value"
        :error="error.error.value"
        @retry="error.reload"
      >
        <div
          v-if="error.data.value"
          class="error-detail__layout"
        >
          <div class="error-detail__main">
            <RumErrorSummary
              :error="error.data.value"
              :can-trace="canTrace"
              :busy="acting"
              @resolve="setStatus('RESOLVED')"
              @ignore="setStatus('IGNORED')"
              @trace="openTrace"
              @locate="locateUser"
            />

            <RumErrorWorkflow
              :error="error.data.value"
              @updated="error.reload"
            />

            <div class="error-detail__grid">
              <RumState
                :loading="occurrences.loading.value"
                :error="occurrences.error.value"
                @retry="occurrences.reload"
              >
                <RumOccurrenceList
                  v-model="occurrencePage"
                  :data="occurrences.data.value"
                  :selected-id="selectedOccurrenceId"
                  @select="selectOccurrence"
                />
              </RumState>

              <div class="error-detail__occurrence">
                <RumOccurrenceContext
                  v-if="selectedOccurrence"
                  :occurrence="selectedOccurrence"
                />
                <RumBreadcrumbs
                  v-if="selectedOccurrence"
                  :breadcrumbs="selectedOccurrence.breadcrumbs"
                />
                <t-empty
                  v-else
                  :description="t('rum.selectOccurrence')"
                />
              </div>
            </div>

            <RumErrorNotes :error-id="error.data.value.id" />
          </div>

          <aside class="error-detail__side">
            <RumErrorStats
              :error="error.data.value"
              :occurrences="occurrenceItems"
            />
          </aside>
        </div>
      </RumState>
    </template>
  </section>
</template>

<style scoped lang="less">
.error-detail {
  min-width: 0;

  &__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 16px;
    align-items: start;
  }

  &__main {
    min-width: 0;
  }

  &__side {
    position: sticky;
    top: 16px;
    min-width: 0;
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.4fr);
    gap: 16px;
    align-items: start;
  }

  &__occurrence {
    display: grid;
    min-width: 0;
    gap: 16px;
  }
}

@media (max-width: 1280px) {
  .error-detail__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .error-detail__side {
    position: static;
  }
}

@media (max-width: 980px) {
  .error-detail__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
