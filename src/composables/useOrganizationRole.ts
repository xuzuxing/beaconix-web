import { computed, watch } from 'vue'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'

/**
 * Current server-confirmed organization capabilities. Project authority is separate.
 */
export function useOrganizationRole() {
  const org = useOrganizationStore()
  const permissions = usePermissionsStore()
  watch(
    () => org.currentOrganizationId,
    (id) => {
      void permissions.ensureOrganization(id)
    },
    { immediate: true },
  )
  const entry = computed(() => permissions.organizations[org.currentOrganizationId])
  const role = computed(() => entry.value?.data?.organizationRole ?? undefined)
  const canManage = computed(() => permissions.canOrganization(org.currentOrganizationId))
  const canGrantAdmin = computed(() =>
    permissions.canOrganization(org.currentOrganizationId, 'grantOrganizationAdmin'),
  )
  return { role, canManage, canCheck: canManage, canGrantAdmin, entry }
}
