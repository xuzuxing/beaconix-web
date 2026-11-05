<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import { updateRumError } from '@/api/modules/rum'
import type { RumErrorStatus } from '@/api/types/rum'
import RumBreadcrumbs from '@/components/rum/RumBreadcrumbs.vue'
import RumErrorNotes from '@/components/rum/RumErrorNotes.vue'
import RumErrorSummary from '@/components/rum/RumErrorSummary.vue'
import RumOccurrenceContext from '@/components/rum/RumOccurrenceContext.vue'
import RumOccurrenceList from '@/components/rum/RumOccurrenceList.vue'
import RumState from '@/components/rum/RumState.vue'
import { usePageHeader } from '@/composables/usePageHeader'
import { useRumErrorDetail } from '@/composables/useRumErrorDetail'

const { t } = useI18n()
const {
  route,
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

const statusLabels = computed<Record<RumErrorStatus, string>>(() => ({
  UNRESOLVED: t('rum.statusUnresolved'),
  RESOLVED: t('rum.statusResolved'),
  IGNORED: t('rum.statusIgnored'),
}))
const statusTheme = computed<
  Record<RumErrorStatus, 'warning' | 'success' | 'default'>
>(() => ({
  UNRESOLVED: 'warning',
  RESOLVED: 'success',
  IGNORED: 'default',
}))
const updating = ref(false)
async function setStatus(status: RumErrorStatus, ignoredUntil?: string) {
  const current = error.data.value
  if (!current || updating.value) return
  updating.value = true
  try {
    await updateRumError(projectId.value, appId.value, current.id, {
      status,
      ...(ignoredUntil ? { ignoredUntil } : {}),
    })
    await error.reload()
  } catch {
    void MessagePlugin.error(t('rum.statusUpdateFailed'))
  } finally {
    updating.value = false
  }
}
function ignoreFor(days: number) {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  void setStatus('IGNORED', until)
}

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
        <RumErrorSummary
          v-if="error.data.value"
          :error="error.data.value"
        />
      </RumState>

      <div
        v-if="error.data.value"
        class="error-detail__status"
      >
        <t-tag
          :theme="statusTheme[error.data.value.status]"
          variant="light"
          >{{ statusLabels[error.data.value.status] }}</t-tag
        >
        <t-tag
          v-if="error.data.value.reopenedAt"
          theme="warning"
          variant="outline"
          >{{ t('rum.reopened') }}</t-tag
        >
        <t-button
          size="small"
          theme="primary"
          :loading="updating"
          @click="setStatus('RESOLVED')"
          >{{ t('rum.markResolved') }}</t-button
        >
        <t-button
          size="small"
          variant="outline"
          :loading="updating"
          @click="ignoreFor(1)"
          >{{ t('rum.ignore1d') }}</t-button
        >
        <t-button
          size="small"
          variant="outline"
          :loading="updating"
          @click="ignoreFor(7)"
          >{{ t('rum.ignore7d') }}</t-button
        >
        <t-button
          size="small"
          variant="outline"
          :loading="updating"
          @click="setStatus('UNRESOLVED')"
          >{{ t('rum.reopen') }}</t-button
        >
      </div>

      <div
        v-if="error.data.value"
        class="error-detail__grid"
      >
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

      <RumErrorNotes
        v-if="error.data.value"
        class="error-detail__notes"
        :group-id="error.data.value.id"
      />
    </template>
  </section>
</template>

<style scoped lang="less">
.error-detail {
  min-width: 0;

  &__grid {
    display: grid;
    grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.4fr);
    align-items: start;
    gap: @beacon-gap-l;
    margin-top: @beacon-gap-l;
  }

  &__occurrence {
    display: grid;
    gap: @beacon-gap-l;
    min-width: 0;
  }

  &__status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: @beacon-gap;
    margin-top: @beacon-gap-l;
  }

  &__notes {
    display: block;
    margin-top: @beacon-gap-l;
  }

  @media (max-width: 980px) {
    &__grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
