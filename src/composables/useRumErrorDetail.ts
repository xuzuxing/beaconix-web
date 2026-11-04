import { computed, shallowRef, watch } from 'vue'
import { getRumError, listRumErrorOccurrences } from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'

export function useRumErrorDetail() {
  const context = useRumContext()
  const errorId = computed(() => String(context.route.params.errorId ?? ''))
  const occurrencePage = shallowRef(1)
  const selectedOccurrenceId = shallowRef<string | null>(null)

  const error = useRumResource(
    (signal) =>
      context.canReadRum.value
        ? getRumError(context.projectId.value, context.appId.value, errorId.value, { signal })
        : Promise.reject(new Error('RUM access denied')),
    [context.projectId, context.appId, errorId, context.canReadRum],
  )
  const occurrences = useRumResource(
    (signal) =>
      context.canReadRum.value
        ? listRumErrorOccurrences(
            context.projectId.value,
            context.appId.value,
            errorId.value,
            { page: occurrencePage.value, limit: 20 },
            { signal },
          )
        : Promise.reject(new Error('RUM access denied')),
    [context.projectId, context.appId, errorId, context.canReadRum, occurrencePage],
  )

  watch(
    [context.projectId, context.appId, errorId, context.canReadRum],
    () => {
      occurrencePage.value = 1
      selectedOccurrenceId.value = null
    },
    { flush: 'sync' },
  )
  watch(
    () => occurrences.data.value,
    (page) => {
      const items = page?.items ?? []
      if (!items.some((item) => item.id === selectedOccurrenceId.value)) {
        selectedOccurrenceId.value = items[0]?.id ?? null
      }
    },
    { immediate: true },
  )

  const selectedOccurrence = computed(
    () =>
      occurrences.data.value?.items.find((item) => item.id === selectedOccurrenceId.value) ?? null,
  )

  function selectOccurrence(id: string) {
    selectedOccurrenceId.value = id
  }

  return {
    ...context,
    errorId,
    error,
    occurrences,
    occurrencePage,
    selectedOccurrenceId,
    selectedOccurrence,
    selectOccurrence,
  }
}
