import type { CreateInvitationParams, Invitation } from '../types'
import type { UserInvitation, PublicInvitationPreview } from '../types/invitation'
import { del, get, post } from '@/utils/request'

/** 发送邀请（ADMIN+） */
export function sendInvitation(orgId: string, data: CreateInvitationParams) {
  return post<Invitation>(`/organizations/${orgId}/invitations`, data)
}

/** 组织内全部邀请（ADMIN+） */
export function listInvitations(orgId: string) {
  return get<Invitation[]>(`/organizations/${orgId}/invitations`)
}

/** 撤销待处理邀请（ADMIN+） */
export function revokeInvitation(orgId: string, id: string) {
  return del<Invitation>(`/organizations/${orgId}/invitations/${id}`)
}

/** 受邀人查看邀请详情（公开，凭令牌） */
export async function getInvitationByToken(token: string) {
  const value = await get<PublicInvitationPreview>(
    `/invitations/${encodeURIComponent(token)}`,
    undefined,
    { headers: { 'X-Anonymous': '1', 'X-Silent-Error': '1' } },
  )
  return {
    organizationName: value.organizationName,
    status: value.status,
    requiresLogin: value.requiresLogin,
  }
}

/** 接受邀请（需登录） */
export function acceptInvitation(token: string) {
  return post<Invitation>(`/invitations/${encodeURIComponent(token)}/accept`)
}

/** 拒绝邀请（需登录） */
export function declineInvitation(token: string) {
  return post<Invitation>(`/invitations/${encodeURIComponent(token)}/decline`)
}

function withoutToken(invitation: UserInvitation): UserInvitation {
  // Select the public fields explicitly, including on pending discovery responses.
  return {
    id: invitation.id,
    email: invitation.email,
    organizationId: invitation.organizationId,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    sentById: invitation.sentById,
    acceptedAt: invitation.acceptedAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    organization: invitation.organization,
    sentBy: invitation.sentBy,
    accessMode: invitation.accessMode,
    projects:
      invitation.projects?.map((project) => ({
        projectId: project.projectId,
        projectName: project.projectName,
        role: project.role,
      })) ?? [],
  }
}

export async function listPendingInvitations() {
  const invitations = await get<UserInvitation[]>('/invitations/pending')
  return invitations.map(withoutToken)
}

export async function getInvitationById(id: string) {
  return withoutToken(await get<UserInvitation>(`/invitations/by-id/${encodeURIComponent(id)}`))
}

export async function acceptInvitationById(id: string) {
  return withoutToken(
    await post<UserInvitation>(`/invitations/by-id/${encodeURIComponent(id)}/accept`),
  )
}

export async function declineInvitationById(id: string) {
  return withoutToken(
    await post<UserInvitation>(`/invitations/by-id/${encodeURIComponent(id)}/decline`),
  )
}
