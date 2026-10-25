import { expect, it, vi } from 'vitest'
import { getInvitationById, getInvitationByToken } from '@/api/modules/invitation'
import { get } from '@/utils/request'
vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}))
it('authenticated invitation projection preserves grants but excludes credentials and issuer internals', async () => {
  vi.mocked(get).mockResolvedValue({
    id: 'invite',
    token: 'never-retain',
    issuerAuthorityVersion: 99,
    accessMode: 'SELECTED_PROJECTS',
    projects: [{ projectId: 'a', projectName: 'A', role: 'VIEWER', secret: 'hidden' }],
  })
  const result = await getInvitationById('invite')
  expect(result.projects).toEqual([{ projectId: 'a', projectName: 'A', role: 'VIEWER' }])
  expect(result).not.toHaveProperty('token')
  expect(result).not.toHaveProperty('issuerAuthorityVersion')
})
it('public invitation lookup explicitly omits account authorization', async () => {
  await getInvitationByToken('private/token')
  expect(get).toHaveBeenLastCalledWith('/invitations/private%2Ftoken', undefined, {
    headers: { 'X-Anonymous': '1', 'X-Silent-Error': '1' },
  })
})
