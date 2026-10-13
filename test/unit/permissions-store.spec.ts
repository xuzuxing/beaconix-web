import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { invalidateSession, invalidateWorkspace } from '@/utils/access-context'
import { projectPermission } from '../fixtures/access'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { getOrganizationPermissions, getProjectPermissions } from '@/api/modules/permissions'
vi.mock('@/api/modules/permissions', () => ({
  getOrganizationPermissions: vi.fn(),
  getProjectPermissions: vi.fn(),
}))
const organization = {
  organizationId: 'o1',
  organizationRole: 'MEMBER' as const,
  membershipId: 'm1',
  projectPermissionsVersion: 1,
  accessMode: 'SELECTED_PROJECTS' as const,
  capabilities: {
    manageOrganization: false,
    manageProjectPermissions: false,
    inviteMembers: false,
    grantOrganizationAdmin: false,
  },
}
describe('current capability store', () => {
  beforeEach(() => {
    invalidateSession()
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })
  it('deduplicates scope reads and never grants organization admin to project admins', async () => {
    vi.mocked(getOrganizationPermissions).mockResolvedValue(organization)
    vi.mocked(getProjectPermissions).mockResolvedValue({
      ...organization,
      projectId: 'b',
      assignedRole: 'ADMIN',
      effectiveRole: 'ADMIN',
      capabilities: {
        'monitor.read': true,
        'monitor.manage': true,
        'monitor.check': true,
        'monitor.test-alert': true,
        'rule.manage': true,
      },
    })
    const store = usePermissionsStore()
    await Promise.all([store.ensureOrganization('o1'), store.ensureOrganization('o1')])
    await store.ensureProject('b')
    expect(getOrganizationPermissions).toHaveBeenCalledTimes(1)
    expect(store.canOrganization('o1')).toBe(false)
    expect(store.canProject('b', 'monitor.manage')).toBe(true)
    expect(store.canProject('c', 'monitor.read')).toBe(false)
  })
  it('unknown fields, failed reload and stale identity cannot retain permissions', async () => {
    vi.mocked(getOrganizationPermissions).mockResolvedValue(organization)
    const store = usePermissionsStore()
    await store.ensureOrganization('o1')
    vi.mocked(getOrganizationPermissions).mockRejectedValue(new Error('offline'))
    await store.ensureOrganization('o1', true)
    expect(store.organizations.o1?.state).toBe('error')
    expect(store.canOrganization('o1')).toBe(false)
    expect(store.organizations.o1?.data).toBeNull()
  })
  it('does not accept an earlier account response into a later session', async () => {
    let complete!: (value: typeof organization) => void
    vi.mocked(getOrganizationPermissions).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const store = usePermissionsStore()
    const old = store.ensureOrganization('o1')
    invalidateSession()
    complete(organization)
    await old
    expect(store.organizations.o1).toBeUndefined()
  })
  it('rapid A-B-A switches never join an old workspace refresh or preserve stale ADMIN', async () => {
    const store = usePermissionsStore()
    vi.mocked(getProjectPermissions).mockResolvedValue(projectPermission('a', 'ADMIN'))
    await store.ensureProject('a')
    let complete!: (data: ReturnType<typeof projectPermission>) => void
    vi.mocked(getProjectPermissions).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const oldRefresh = store.ensureProject('a', true)
    invalidateWorkspace()
    invalidateWorkspace()
    vi.mocked(getProjectPermissions).mockResolvedValue(projectPermission('a', 'VIEWER'))
    const currentRefresh = store.ensureProject('a', true)
    complete(projectPermission('a', 'VIEWER'))
    await Promise.all([oldRefresh, currentRefresh])
    expect(store.canProject('a', 'monitor.manage')).toBe(false)
    expect(store.projects.a?.data?.effectiveRole).toBe('VIEWER')
  })
})
