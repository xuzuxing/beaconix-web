import type { Project } from '@/api/types'
import type { OrganizationPermissions, ProjectPermissions } from '@/api/types/permissions'

export const orgPermissions: OrganizationPermissions = {
  organizationId: 'o1',
  organizationRole: 'MEMBER',
  membershipId: 'm1',
  projectPermissionsVersion: 1,
  accessMode: 'SELECTED_PROJECTS',
  capabilities: {
    manageOrganization: false,
    manageProjectPermissions: false,
    inviteMembers: false,
    grantOrganizationAdmin: false,
  },
}
export const ownerPermissions: OrganizationPermissions = {
  ...orgPermissions,
  organizationRole: 'OWNER',
  accessMode: 'ALL_PROJECTS',
  capabilities: {
    manageOrganization: true,
    manageProjectPermissions: true,
    inviteMembers: true,
    grantOrganizationAdmin: true,
  },
}
export function projectPermission(
  id: string,
  role: 'VIEWER' | 'MEMBER' | 'ADMIN',
): ProjectPermissions {
  return {
    ...orgPermissions,
    projectId: id,
    assignedRole: role,
    effectiveRole: role,
    capabilities: {
      'monitor.read': true,
      'monitor.check': role !== 'VIEWER',
      'monitor.manage': role === 'ADMIN',
      'monitor.test-alert': role === 'ADMIN',
      'rule.manage': role === 'ADMIN',
    },
  }
}
export const project = (id: string, status: Project['status'] = 'ACTIVE'): Project => ({
  id,
  organizationId: 'o1',
  name: `Project ${id.toUpperCase()}`,
  key: id.toUpperCase(),
  status,
  description: null,
  createdById: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
})
