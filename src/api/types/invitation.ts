import type { Invitation, InvitableRole, InvitationStatus } from '../types'
import type { AccessMode } from './permissions'

/** User-level invitation discovery. Tokens are never retained in notification state. */
export interface UserInvitation extends Omit<Invitation, 'token'> {
  organization?: { id: string; name: string; slug: string }
  sentBy?: { id: string; name: string; email: string }
}

export type InvitationAction = 'accept' | 'decline'
/** 公开邀请预览：未登录凭令牌可见的团队与授权范围，不含账号、令牌与项目明细 */
export interface PublicInvitationPreview {
  organizationName: string
  organizationSlug: string
  organizationLogoUrl: string | null
  inviterName: string
  role: InvitableRole
  accessMode: AccessMode
  /** SELECTED_PROJECTS 时授予访问的项目数量 */
  projectCount: number
  expiresAt: string
  status: InvitationStatus
  requiresLogin: boolean
}
