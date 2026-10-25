import type { MembershipRole } from '../types'
export type ProjectRole = 'VIEWER' | 'MEMBER' | 'ADMIN'
export type AccessMode = 'ALL_PROJECTS' | 'SELECTED_PROJECTS'
export type PermissionState = 'idle' | 'loading' | 'ready' | 'denied' | 'error'
export interface ProjectGrant {
  projectId: string
  role: ProjectRole
}
export interface OrganizationPermissions {
  organizationId: string
  organizationRole: MembershipRole | null
  membershipId: string | null
  projectPermissionsVersion: number | null
  accessMode: AccessMode
  capabilities: {
    manageOrganization: boolean
    manageProjectPermissions: boolean
    inviteMembers: boolean
    grantOrganizationAdmin: boolean
  }
}
export interface ProjectPermissions extends Omit<OrganizationPermissions, 'capabilities'> {
  projectId: string
  assignedRole: ProjectRole | null
  effectiveRole: ProjectRole
  capabilities: Record<string, boolean>
}
export interface MemberProjectPermissions {
  userId: string
  organizationId: string
  membershipId: string
  projectPermissionsVersion: number
  organizationRole: MembershipRole
  accessMode: AccessMode
  projects: {
    projectId: string
    projectName: string
    assignedRole: ProjectRole
    effectiveRole: ProjectRole
  }[]
}
export interface ReplaceProjectPermissions {
  expectedMembershipId: string
  expectedVersion: number
  projects: ProjectGrant[]
}
