import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOrganizationStore } from '@/stores'
import { createProject, listOrganizations, listProjects } from '@/api'
import { getOrganizationPermissions, getProjectPermissions } from '@/api/modules/permissions'
import { invalidateSession } from '@/utils/access-context'
import type { Organization } from '@/api/types'
import { orgPermissions, project, projectPermission } from '../fixtures/access'

vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  listOrganizations: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
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

describe('creating a project inside the workspace', () => {
  it('appends the new project and switches to it', async () => {
    vi.mocked(createProject).mockResolvedValue(project('c'))
    const org = useOrganizationStore()
    await org.loadWorkspace()
    expect(org.currentProjectId).toBe('a')

    await org.createProject({ name: 'Project C', key: 'C1' })

    expect(createProject).toHaveBeenCalledWith('o1', {
      name: 'Project C',
      key: 'C1',
    })
    expect(org.projects.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(org.currentProjectId).toBe('c')
    expect(org.currentProject?.name).toBe('Project C')
  })

  it('refuses to create without a current team', async () => {
    const org = useOrganizationStore()
    await expect(org.createProject({ name: 'Project C', key: 'C1' })).rejects.toThrow()
    expect(createProject).not.toHaveBeenCalled()
  })

  it('leaves the new team untouched when the team changed during creation', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([
      organization,
      { ...organization, id: 'o2', name: 'Second Team' },
    ])
    vi.mocked(getOrganizationPermissions).mockImplementation(async (id) => ({
      ...orgPermissions,
      organizationId: id,
    }))
    const org = useOrganizationStore()
    await org.loadWorkspace()
    vi.mocked(createProject).mockImplementation(async () => {
      await org.switchOrganization('o2')
      return project('c')
    })

    await org.createProject({ name: 'Project C', key: 'C1' })

    expect(org.currentOrganizationId).toBe('o2')
    expect(org.projects.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('keeps the workspace unchanged when creation fails', async () => {
    vi.mocked(createProject).mockRejectedValue(new Error('Project key already taken'))
    const org = useOrganizationStore()
    await org.loadWorkspace()

    await expect(org.createProject({ name: 'Project C', key: 'A' })).rejects.toThrow(
      'Project key already taken',
    )
    expect(org.projects.map((item) => item.id)).toEqual(['a', 'b'])
    expect(org.currentProjectId).toBe('a')
  })
})
