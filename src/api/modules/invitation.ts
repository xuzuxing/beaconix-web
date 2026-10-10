import type { CreateInvitationParams, Invitation } from '../types'
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
export function getInvitationByToken(token: string) {
  return get<Invitation>(`/invitations/${token}`)
}

/** 接受邀请（需登录） */
export function acceptInvitation(token: string) {
  return post<Invitation>(`/invitations/${token}/accept`)
}

/** 拒绝邀请（需登录） */
export function declineInvitation(token: string) {
  return post<Invitation>(`/invitations/${token}/decline`)
}
