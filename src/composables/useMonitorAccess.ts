import { computed, type MaybeRefOrGetter } from 'vue'
import { useRoute } from 'vue-router'
import { useOrganizationStore } from '@/stores'
import { useProjectAccess } from './useProjectAccess'

/**
 * Monitor capabilities always use the resource's project, including deep links.
 */
export function useMonitorAccess(projectId?: MaybeRefOrGetter<string>) {
  const route = useRoute()
  const org = useOrganizationStore()
  return useProjectAccess(
    projectId ??
      computed(() =>
        typeof route.params.projectId === 'string' ? route.params.projectId : org.currentProjectId,
      ),
  )
}
