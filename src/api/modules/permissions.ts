import { get, put } from '@/utils/request'
import type {
  MemberProjectPermissions,
  OrganizationPermissions,
  ProjectPermissions,
  ReplaceProjectPermissions,
} from '../types/permissions'
const quiet = { headers: { 'X-Silent-Error': '1' } }
export const getOrganizationPermissions = (id: string) =>
  get<OrganizationPermissions>(`/organizations/${id}/my-permissions`, undefined, quiet)
export const getProjectPermissions = (id: string) =>
  get<ProjectPermissions>(`/projects/${id}/my-permissions`, undefined, quiet)
export const getMemberProjectPermissions = (orgId: string, userId: string) =>
  get<MemberProjectPermissions>(
    `/organizations/${orgId}/members/${userId}/project-permissions`,
    undefined,
    quiet,
  )
export const replaceMemberProjectPermissions = (
  orgId: string,
  userId: string,
  body: ReplaceProjectPermissions,
) =>
  put<MemberProjectPermissions>(
    `/organizations/${orgId}/members/${userId}/project-permissions`,
    body,
    quiet,
  )
export const getProjectMembers = (id: string) =>
  get<{ id: string; name: string; avatarUrl: string | null; effectiveRole: string }[]>(
    `/projects/${id}/members`,
  )
export const getProjectProbeOptions = (id: string) =>
  get<{ id: string; name: string; status: string }[]>(`/projects/${id}/probe-options`)
export const getProjectChannelOptions = (id: string) =>
  get<{ id: string; name: string; type: string }[]>(`/projects/${id}/notification-channel-options`)
