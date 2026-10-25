import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { useOrganizationStore, useUserStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { getSubscriptionStack, listOrganizations, listProjects } from '@/api'
import { getOrganizationPermissions, getProjectPermissions } from '@/api/modules/permissions'
import { canVisitNavigation } from '@/utils/navigation-access'
import { buildMenu } from '@/router/menu'
import { buildFeatureEntries } from '@/utils/feature-search'
import { invalidateSession } from '@/utils/access-context'
import type { Organization, User } from '@/api/types'
import type { OrganizationPermissions } from '@/api/types/permissions'
import { orgPermissions, ownerPermissions, project, projectPermission } from '../fixtures/access'

vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  listOrganizations: vi.fn(),
  listProjects: vi.fn(),
  getSubscriptionStack: vi.fn(),
}))
vi.mock('@/api/modules/permissions', () => ({
  getOrganizationPermissions: vi.fn(),
  getProjectPermissions: vi.fn(),
}))
const organization: Organization = {
  id: 'o1',
  ownerId: 'owner',
  name: 'Team',
  slug: 'team',
  description: null,
  logoUrl: null,
  website: null,
  createdAt: '',
  updatedAt: '',
}
beforeEach(() => {
  invalidateSession()
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(listOrganizations).mockResolvedValue([organization])
  vi.mocked(listProjects).mockResolvedValue([project('a'), project('b')])
  vi.mocked(getOrganizationPermissions).mockResolvedValue(orgPermissions)
  vi.mocked(getProjectPermissions).mockImplementation((id) =>
    Promise.resolve(projectPermission(id, id === 'a' ? 'VIEWER' : 'ADMIN')),
  )
})
describe('authorized workspace and shared navigation', () => {
  it('loads ordinary workspace without a full directory or subscription fallback', async () => {
    const org = useOrganizationStore()
    await org.loadWorkspace()
    expect(org.workspaceState).toBe('ready')
    expect(org.projects.map((item) => item.id)).toEqual(['a', 'b'])
    expect(org.subscription).toBeNull()
    expect(getSubscriptionStack).not.toHaveBeenCalled()
    expect(canVisitNavigation('/monitor', 'a')).toBe(true)
    expect(canVisitNavigation('/monitor', 'c')).toBe(false)
    expect(canVisitNavigation('/teams/members')).toBe(false)
    const permissions = usePermissionsStore()
    await permissions.ensureProject('b')
    expect(permissions.canProject('b', 'monitor.manage')).toBe(true)
    expect(canVisitNavigation('/channels')).toBe(false)
  })
  it('subscription failure is optional even for administrators', async () => {
    vi.mocked(getOrganizationPermissions).mockResolvedValue(ownerPermissions)
    vi.mocked(getSubscriptionStack).mockRejectedValue(new Error('billing offline'))
    const org = useOrganizationStore()
    await org.loadWorkspace()
    expect(org.workspaceState).toBe('ready')
    expect(org.projects).toHaveLength(2)
  })
  it('an old organization subscription failure cannot clear a newer subscription', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([
      organization,
      { ...organization, id: 'o2', name: 'Second Team' },
    ])
    vi.mocked(listProjects).mockResolvedValue([])
    vi.mocked(getOrganizationPermissions).mockImplementation(async (id) => ({
      ...ownerPermissions,
      organizationId: id,
    }))
    let failOld!: (error: Error) => void
    vi.mocked(getSubscriptionStack).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          failOld = reject
        }),
    )
    const newer = { effectivePlan: null, stack: [] }
    vi.mocked(getSubscriptionStack).mockResolvedValue(newer)
    const org = useOrganizationStore()
    await org.loadWorkspace()
    await org.switchOrganization('o2')
    await flushPromises()
    expect(org.subscription).toEqual(newer)
    failOld(new Error('Old billing request failed'))
    await flushPromises()
    expect(org.subscription).toEqual(newer)
  })
  it('zero grants is a valid empty workspace without automatic project creation', async () => {
    vi.mocked(listProjects).mockResolvedValue([])
    const org = useOrganizationStore()
    await org.loadWorkspace()
    expect(org.workspaceState).toBe('ready')
    expect(org.currentProjectId).toBe('')
    expect(canVisitNavigation('/notifications')).toBe(true)
    expect(canVisitNavigation('/access-tokens')).toBe(true)
  })
  it('unknown capability schema fails closed instead of showing a workspace', async () => {
    vi.mocked(getOrganizationPermissions).mockResolvedValue({
      ...ownerPermissions,
      capabilities: { legacyAdmin: true },
    } as unknown as OrganizationPermissions)
    const org = useOrganizationStore()
    await org.loadWorkspace()
    expect(org.workspaceState).toBe('error')
    expect(org.projects).toEqual([])
    expect(listProjects).not.toHaveBeenCalled()
    expect(canVisitNavigation('/monitor')).toBe(false)
  })
  it('menus, search and routes use the same authorization predicate', async () => {
    const org = useOrganizationStore()
    await org.loadWorkspace()
    const routes = [
      { path: 'monitor', redirect: '/monitor', meta: { titleKey: 'menu.monitor' } },
      { path: 'channels', redirect: '/channels', meta: { titleKey: 'menu.channels' } },
      { path: 'teams', redirect: '/teams', meta: { titleKey: 'menu.team' } },
      { path: 'admin', redirect: '/admin', meta: { titleKey: 'menu.admin' } },
    ]
    const menu = buildMenu(routes)
    const search = buildFeatureEntries(
      routes.map((item) => ({ ...item.meta, path: `/${item.path}` })),
    )
    expect(menu.map((item) => item.path)).toEqual(['/monitor'])
    expect(search.map((item) => item.path)).toEqual(['/monitor'])
  })
  it('persisted SUPER_ADMIN identity is not platform authorization', () => {
    const user = useUserStore()
    user.user = { id: 'stale-admin', globalRole: 'SUPER_ADMIN' } as User
    expect(user.identityVerified).toBe(false)
    expect(canVisitNavigation('/admin')).toBe(false)
  })
  it('permission version changes evict authority for other cached projects', async () => {
    const org = useOrganizationStore()
    await org.loadWorkspace()
    const permissions = usePermissionsStore()
    await permissions.ensureProject('b')
    expect(permissions.canProject('b', 'monitor.manage')).toBe(true)
    vi.mocked(getOrganizationPermissions).mockResolvedValue({
      ...orgPermissions,
      projectPermissionsVersion: 2,
    })
    await permissions.ensureOrganization('o1', true)
    expect(permissions.canProject('b', 'monitor.manage')).toBe(false)
    expect(permissions.organizations.o1?.state).toBe('ready')
  })
  it('a changed organization cannot accept an older list response', async () => {
    let complete!: (items: (typeof organization)[]) => void
    vi.mocked(listOrganizations).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const org = useOrganizationStore()
    const request = org.loadOrganizations()
    org.reset()
    complete([organization])
    await request
    expect(org.organizations).toEqual([])
    expect(org.currentOrganizationId).toBe('')
  })
  it('confirmed downgrades clear project names and subscription even on a readable route', async () => {
    vi.mocked(getOrganizationPermissions).mockResolvedValue(ownerPermissions)
    const org = useOrganizationStore()
    await org.loadWorkspace()
    org.subscription = { effectivePlan: null, stack: [] }
    const permissions = usePermissionsStore()
    vi.mocked(getOrganizationPermissions).mockResolvedValue({
      ...orgPermissions,
      projectPermissionsVersion: 2,
    })
    await permissions.ensureOrganization('o1', true)
    expect(org.projects).toEqual([])
    expect(org.subscription).toBeNull()
    expect(org.workspaceState).toBe('idle')
    expect(canVisitNavigation('/dashboard')).toBe(true)
  })
})
