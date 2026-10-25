import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationStore, useOrganizationStore, useUserStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  getUserNotificationUnreadCount,
  listUserNotifications,
  listOrganizations,
  listProjects,
} from '@/api'
import { consumeNotificationStream } from '@/api/modules/notification-center'
import {
  acceptInvitationById,
  getInvitationById,
  listPendingInvitations,
} from '@/api/modules/invitation'
import type { User, Organization, Paginated } from '@/api/types'
import type { UserNotification } from '@/api/types/notification-center'
import type { UserInvitation } from '@/api/types/invitation'
import { invalidatePermissions } from '@/utils/access-context'
import { orgPermissions, project, projectPermission } from '../fixtures/access'

vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  getUserNotificationUnreadCount: vi.fn(),
  listUserNotifications: vi.fn(),
  listOrganizations: vi.fn(),
  listProjects: vi.fn(),
}))
vi.mock('@/api/modules/notification-center', async (original) => ({
  ...(await original<typeof import('@/api/modules/notification-center')>()),
  consumeNotificationStream: vi.fn(),
}))
vi.mock('@/api/modules/invitation', async (original) => ({
  ...(await original<typeof import('@/api/modules/invitation')>()),
  getInvitationById: vi.fn(),
  acceptInvitationById: vi.fn(),
  listPendingInvitations: vi.fn(),
}))
const notification: UserNotification = {
  id: 'n1',
  userId: 'u1',
  type: 'MONITOR_ALERT',
  title: 'Old private title',
  body: 'old-private-body',
  isRead: false,
  readAt: null,
  resourceId: 'monitor-a',
  resourceType: 'Monitor',
  meta: { organizationId: 'o1', projectId: 'a' },
  createdAt: '2026-10-13T00:00:00Z',
}
const invitation: UserInvitation = {
  id: 'i1',
  email: 'fixture@example.invalid',
  organizationId: 'o1',
  role: 'MEMBER',
  status: 'PENDING',
  expiresAt: '2099-01-01T00:00:00Z',
  sentById: 'owner',
  acceptedAt: null,
  accessMode: 'SELECTED_PROJECTS',
  projects: [{ projectId: 'a', projectName: 'Project A', role: 'VIEWER' }],
  createdAt: '',
  updatedAt: '',
}
let store: ReturnType<typeof useNotificationStore>
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  setActivePinia(createPinia())
  const user = useUserStore()
  user.accessToken = 'fixture'
  user.setUser({ id: 'u1' } as User)
  vi.mocked(getUserNotificationUnreadCount).mockResolvedValue({ count: 1 })
  vi.mocked(listUserNotifications).mockResolvedValue({
    data: [notification],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  })
  vi.mocked(listPendingInvitations).mockResolvedValue([])
  vi.mocked(consumeNotificationStream).mockImplementation(
    (_token, signal) =>
      new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true })),
  )
  store = useNotificationStore()
})
afterEach(() => {
  store.$dispose()
  vi.useRealTimers()
})
describe('notifications follow current authorization', () => {
  it('SSE only invalidates; private frame content is never inserted', async () => {
    const before = store.unreadCount
    store.receiveNotification(notification)
    expect(store.recent).toEqual([])
    expect(store.unreadCount).toBe(before)
    await vi.advanceTimersByTimeAsync(101)
    expect(listUserNotifications).toHaveBeenCalled()
    expect(store.recent).toEqual([notification])
  })
  it('old connection callbacks cannot reinsert revoked content', async () => {
    const oldReceive = vi.mocked(consumeNotificationStream).mock.calls[0]![2]
    vi.mocked(listUserNotifications).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    })
    await store.refresh()
    invalidatePermissions()
    const revision = store.revision
    oldReceive({ ...notification, id: 'late-secret' })
    expect(store.revision).toBe(revision)
    expect(store.recent).toEqual([])
  })
  it('permission invalidation rejects old unread counts and list responses', async () => {
    let finish!: (items: Paginated<UserNotification>) => void
    vi.mocked(listUserNotifications).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const old = store.loadRecent()
    vi.mocked(listUserNotifications).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    })
    invalidatePermissions()
    finish({ data: [notification], meta: { total: 99, page: 1, limit: 20, totalPages: 5 } })
    await old
    await Promise.resolve()
    expect(store.recent).toEqual([])
    expect(store.total).toBe(0)
    expect(store.invitations).toEqual({})
  })
  it('failed unread revalidation clears the previous sensitive count', async () => {
    await store.refreshUnreadCount()
    expect(store.unreadCount).toBe(1)
    vi.mocked(getUserNotificationUnreadCount).mockRejectedValue(new Error('offline'))
    await store.refreshUnreadCount()
    expect(store.unreadCount).toBe(0)
  })
  it('invitation acceptance reloads workspace even when projects already exist', async () => {
    const org = useOrganizationStore()
    org.projects = [project('b')]
    const loadOrganizations = vi.spyOn(org, 'loadOrganizations').mockResolvedValue([])
    const loadWorkspace = vi.spyOn(org, 'loadWorkspace').mockResolvedValue()
    vi.mocked(getInvitationById).mockResolvedValue(invitation)
    vi.mocked(acceptInvitationById).mockResolvedValue({ ...invitation, status: 'ACCEPTED' })
    const item = {
      ...notification,
      type: 'INVITATION_RECEIVED' as const,
      resourceType: 'Invitation',
      resourceId: 'i1',
      meta: { invitationStatus: 'PENDING' as const, actionable: true },
    }
    store.invitations.i1 = invitation
    expect(await store.actOnInvitation(item, 'accept')).toBe(true)
    expect(loadOrganizations).toHaveBeenCalled()
    expect(loadWorkspace).toHaveBeenCalledWith(true)
  })
  it('a notification with mismatched organization/project hints cannot commit a workspace', async () => {
    const org = useOrganizationStore()
    const permissions = usePermissionsStore()
    vi.mocked(listOrganizations).mockResolvedValue([{ id: 'o1' }] as Organization[])
    vi.mocked(listProjects).mockResolvedValue([project('a')])
    vi.spyOn(permissions, 'ensureOrganization').mockResolvedValue(orgPermissions)
    vi.spyOn(permissions, 'ensureProject').mockResolvedValue({
      ...projectPermission('a', 'VIEWER'),
      organizationId: 'o2',
    })
    await expect(store.prepareNotificationTarget(notification)).rejects.toThrow(
      'Project unavailable',
    )
    expect(org.currentProjectId).toBe('')
  })
})
