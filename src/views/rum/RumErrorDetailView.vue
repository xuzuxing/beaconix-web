<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RumBreadcrumbs from '@/components/rum/RumBreadcrumbs.vue'
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
    </template>
  </section>
</template>

<style scoped>
.error-detail {
  min-width: 0;
}

.error-detail__grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.4fr);
  gap: 16px;
  margin-top: 16px;
  align-items: start;
}

.error-detail__occurrence {
  display: grid;
  min-width: 0;
  gap: 16px;
}

@media (max-width: 980px) {
  .error-detail__grid {
    grid-template-columns: 1fr;
  }
}
</style>
