import type { Invitation } from '../types'

/** User-level invitation discovery. Tokens are never retained in notification state. */
export interface UserInvitation extends Omit<Invitation, 'token'> {
  organization?: { id: string; name: string; slug: string }
  sentBy?: { id: string; name: string; email: string }
}

export type InvitationAction = 'accept' | 'decline'
export interface PublicInvitationPreview {
  organizationName: string
  status: string
  requiresLogin: boolean
}
