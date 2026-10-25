import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { invalidateSession } from '@/utils/access-context'
import { getOrganizationPermissions, getProjectPermissions } from '@/api/modules/permissions'

const { handlers, routerMock } = vi.hoisted(() => {
  const handlers: Array<(to: unknown) => unknown> = []
  return {
    handlers,
    routerMock: {
      beforeEach: (handler: (to: unknown) => unknown) => handlers.push(handler),
      afterEach: () => undefined,
      currentRoute: {
        value: {
          path: '/monitor',
          params: {},
          query: {},
          fullPath: '/monitor',
          matched: [],
          meta: {},
        },
      },
      replace: vi.fn(),
      push: vi.fn(),
    },
  }
})

vi.mock('@/router', () => ({ default: routerMock }))
vi.mock('@/utils/navigation-access', () => ({
  navigationScope: () => 'project',
  canVisitNavigation: () => true,
}))
vi.mock('@/api', () => ({
  getProfile: vi.fn(),
  isTwoFactorChallenge: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  listOrganizations: vi.fn(),
  listProjects: vi.fn(),
  getSubscriptionStack: vi.fn(),
}))
vi.mock('@/api/modules/permissions', () => ({
  getOrganizationPermissions: vi.fn(),
  getProjectPermissions: vi.fn(),
}))

import { useOrganizationStore, useUserStore } from '@/stores'
import '@/permission'

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
const project = {
  ...organization,
  projectId: 'a',
  assignedRole: 'ADMIN' as const,
  effectiveRole: 'ADMIN' as const,
  capabilities: {
    'monitor.read': true,
    'monitor.manage': true,
    'monitor.check': true,
    'monitor.test-alert': true,
    'rule.manage': true,
  },
}
const ROUTE = {
  path: '/monitor',
  params: {},
  matched: [{ meta: {} }],
  meta: {},
  fullPath: '/monitor',
  query: {},
}
const orgCalls = () => vi.mocked(getOrganizationPermissions).mock.calls.length
const projectCalls = () => vi.mocked(getProjectPermissions).mock.calls.length

describe('navigation permission reads', () => {
  beforeEach(() => {
    invalidateSession()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(getOrganizationPermissions).mockResolvedValue(organization)
    vi.mocked(getProjectPermissions).mockResolvedValue(project)
    const user = useUserStore()
    user.accessToken = 'access'
    user.refreshToken = 'refresh'
    user.setUser({
      id: 'u1',
      name: 'U',
      email: 'u@example.invalid',
      globalRole: 'USER',
      avatarUrl: null,
      emailVerified: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    const org = useOrganizationStore()
    org.workspaceState = 'ready'
    org.currentOrganizationId = 'o1'
    org.currentProjectId = 'a'
    org.projects = [{ id: 'a' } as never]
  })

  it('reuses fresh capabilities across consecutive navigations', async () => {
    const guard = handlers[0]!
    await guard(ROUTE)
    expect(orgCalls()).toBe(1)
    expect(projectCalls()).toBe(1)

    // 连续点击菜单不应每次都强刷组织与项目两份 /my-permissions
    await guard(ROUTE)
    await guard(ROUTE)
    expect(orgCalls()).toBe(1)
    expect(projectCalls()).toBe(1)
  })

  it('refreshes again once the freshness window lapses', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const guard = handlers[0]!
    await guard(ROUTE)
    expect(orgCalls()).toBe(1)
    expect(projectCalls()).toBe(1)

    clock.mockReturnValue(1_000_000 + 6_000)
    await guard(ROUTE)
    expect(orgCalls()).toBe(2)
    expect(projectCalls()).toBe(2)
    clock.mockRestore()
  })

  it('still reads a scope that has no fresh cache', async () => {
    const guard = handlers[0]!
    await guard(ROUTE)
    expect(projectCalls()).toBe(1)
    // 切到另一个项目：没有缓存，必须真实读取
    useOrganizationStore().currentProjectId = 'b'
    vi.mocked(getProjectPermissions).mockResolvedValue({
      ...project,
      projectId: 'b',
      effectiveRole: 'VIEWER',
    })
    await guard(ROUTE)
    expect(projectCalls()).toBe(2)
  })
})
