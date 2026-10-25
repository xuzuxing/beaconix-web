import { useOrganizationStore, useUserStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'

export function navigationScope(path: string) {
  if (/^\/admin(?:\/|$)/.test(path)) return 'platform'
  if (/^\/(?:channels|probes|status-pages|billing|teams)(?:\/|$)/.test(path)) return 'organization'
  if (/^\/monitor(?:\/|$)/.test(path)) return 'project'
  if (path === '/dashboard') return 'workspace'
  return 'account'
}
export function canVisitNavigation(path: string, projectId?: string) {
  const org = useOrganizationStore()
  const permissions = usePermissionsStore()
  switch (navigationScope(path)) {
    case 'platform':
      return useUserStore().isSuperAdmin
    case 'organization':
      return permissions.canOrganization(org.currentOrganizationId)
    case 'workspace':
      return permissions.organizations[org.currentOrganizationId]?.state === 'ready'
    case 'project':
      return (
        permissions.organizations[org.currentOrganizationId]?.state === 'ready' &&
        (!(projectId ?? org.currentProjectId) ||
          permissions.canProject(projectId ?? org.currentProjectId, 'monitor.read'))
      )
    default:
      return true
  }
}
