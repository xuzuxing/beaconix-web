import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, ref, type EffectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { listProbes } from '@/api/modules/probe'
import { useProbeActions } from '@/composables/useProbeActions'
import { useProbeList } from '@/composables/useProbeList'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { invalidatePermissions, invalidateSession } from '@/utils/access-context'
import {
  selectProbes,
  probeFormError,
  withoutProbeSecret,
  probeInstallCommand,
  probeActivationCode,
} from '@/utils/probe-presenter'
import { tenantProbe } from '../fixtures/probes'
import { ownerPermissions, orgPermissions } from '../fixtures/access'

vi.mock('@/api/modules/probe', () => ({ listProbes: vi.fn() }))
let scope: EffectScope
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  scope = effectScope()
  const permissions = usePermissionsStore()
  permissions.organizations.o1 = { state: 'ready', error: '', data: ownerPermissions }
  permissions.organizations.o2 = {
    state: 'ready',
    error: '',
    data: { ...ownerPermissions, organizationId: 'o2' },
  }
  vi.spyOn(permissions, 'ensureOrganization').mockImplementation(
    async (id) => permissions.organizations[id]?.data ?? null,
  )
  vi.mocked(listProbes).mockResolvedValue([tenantProbe()])
})
afterEach(() => scope.stop())
describe('tenant probe lifecycle', () => {
  it('never reads full probes for a project administrator without org authority', async () => {
    usePermissionsStore().organizations.o1!.data = orgPermissions
    const state = scope.run(() => useProbeList(ref('o1')))!
    await flushPromises()
    expect(listProbes).not.toHaveBeenCalled()
    expect(state.probes.value).toEqual([])
  })
  it('strips secrets even when a read response incorrectly includes one', async () => {
    vi.mocked(listProbes).mockResolvedValue([{ ...tenantProbe(), secret: 'private' }])
    const state = scope.run(() => useProbeList(ref('o1')))!
    await flushPromises()
    expect(state.probes.value[0]).not.toHaveProperty('secret')
  })
  it('aborts and ignores old organization responses, including ABA switches', async () => {
    let finish!: (result: ReturnType<typeof tenantProbe>[]) => void
    vi.mocked(listProbes).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const organization = ref('o1')
    const state = scope.run(() => useProbeList(organization))!
    const signal = vi.mocked(listProbes).mock.calls[0]![1]!.signal
    organization.value = 'o2'
    vi.mocked(listProbes).mockResolvedValue([tenantProbe('current')])
    organization.value = 'o1'
    finish([tenantProbe('obsolete')])
    await flushPromises()
    expect(signal?.aborted).toBe(true)
    expect(state.probes.value.map((probe) => probe.id)).toEqual(['current'])
  })
  it('clears rows and pending responses when organization authority is lost', async () => {
    const state = scope.run(() => useProbeList(ref('o1')))!
    await flushPromises()
    expect(state.probes.value).toHaveLength(1)
    usePermissionsStore().organizations.o1 = { state: 'ready', error: '', data: orgPermissions }
    invalidatePermissions()
    expect(state.probes.value).toEqual([])
    await flushPromises()
    expect(listProbes).toHaveBeenCalledTimes(1)
  })
  it('does not repopulate after logout or effect disposal', async () => {
    let finish!: (result: ReturnType<typeof tenantProbe>[]) => void
    vi.mocked(listProbes).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const state = scope.run(() => useProbeList(ref('o1')))!
    invalidateSession()
    scope.stop()
    finish([tenantProbe()])
    await flushPromises()
    expect(state.probes.value).toEqual([])
  })
  it('writes only after refreshing organization authority and serializes double clicks', async () => {
    let finish!: () => void
    const operation = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = () => resolve('done')
        }),
    )
    const state = scope.run(() => useProbeActions(ref('o1')))!
    const first = state.run('toggle', operation)
    await flushPromises()
    const second = await state.run('toggle', operation)
    expect(second).toBeUndefined()
    expect(usePermissionsStore().ensureOrganization).toHaveBeenCalledWith('o1', true)
    expect(operation).toHaveBeenCalledTimes(1)
    finish()
    expect(await first).toBe('done')
  })
  it('cancels a write if an editor closes during permission revalidation', async () => {
    let finish!: () => void
    vi.mocked(usePermissionsStore().ensureOrganization).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(ownerPermissions)
        }),
    )
    const organization = ref('o1')
    const state = scope.run(() => useProbeActions(organization))!
    const operation = vi.fn(async () => 'secret')
    const pending = state.run('save', operation)
    organization.value = ''
    finish()
    expect(await pending).toBeUndefined()
    expect(operation).not.toHaveBeenCalled()
  })
  it('does not surface old credentials or errors after switching teams', async () => {
    let finish!: (value: string) => void
    const organization = ref('o1')
    const state = scope.run(() => useProbeActions(organization))!
    const pending = state.run(
      'rotate',
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    await flushPromises()
    organization.value = 'o2'
    finish('old-secret')
    expect(await pending).toBeUndefined()
    expect(state.busy.value).toBe('')
    expect(state.error.value).toBe('')
  })
  it('fresh denial prevents an already open editor from writing', async () => {
    const permissions = usePermissionsStore()
    vi.mocked(permissions.ensureOrganization).mockImplementation(async () => {
      permissions.organizations.o1!.data = orgPermissions
      return orgPermissions
    })
    const state = scope.run(() => useProbeActions(ref('o1')))!
    const operation = vi.fn(async () => 'done')
    expect(await state.run('save', operation)).toBeUndefined()
    expect(operation).not.toHaveBeenCalled()
  })
})
describe('probe presentation and DTO constraints', () => {
  it('normalizes device authorization codes and rejects ambiguous query values', () => {
    expect(probeActivationCode(' wdjb - mjht ')).toBe('WDJB-MJHT')
    expect(probeActivationCode('WDJBMJHT')).toBe('WDJB-MJHT')
    for (const value of [undefined, ['WDJB-MJHT'], 'invalid', '<script>', 'x'.repeat(33)])
      expect(probeActivationCode(value)).toBe('')
  })
  it('combines enabled status, provider and keyword without mutating the list', () => {
    const nodes = [
      tenantProbe('shanghai'),
      { ...tenantProbe('offline'), status: 'OFFLINE' as const },
      { ...tenantProbe('disabled'), enabled: false },
    ]
    expect(selectProbes(nodes, 'SHANGHAI', 'ONLINE', 'CUSTOM')).toEqual([nodes[0]])
    expect(selectProbes(nodes, '', 'disabled')).toEqual([nodes[2]])
    expect(selectProbes(nodes, '', 'OFFLINE')).toEqual([nodes[1]])
    expect(nodes).toHaveLength(3)
  })
  it('validates URLs, limits and different registration modes', () => {
    const form = { name: 'Node', region: 'Shanghai', provider: 'CUSTOM' as const, callbackUrl: '' }
    expect(probeFormError(form, true)).toBe('')
    expect(probeFormError(form)).toBe('invalidUrl')
    expect(probeFormError({ ...form, callbackUrl: 'http://localhost/callback' })).toBe('')
    expect(probeFormError({ ...form, callbackUrl: 'https://user:password@host/cb' })).toBe(
      'invalidUrl',
    )
    expect(probeFormError({ ...form, callbackUrl: 'javascript:alert(1)' })).toBe('invalidUrl')
    expect(probeFormError({ ...form, name: 'x'.repeat(101) }, true)).toBe('tooLong')
    expect(probeFormError({ ...form, name: '  ' }, true)).toBe('required')
  })
  it('does not mutate a credential response when sanitizing it', () => {
    const response = { ...tenantProbe(), secret: 'once' }
    expect(withoutProbeSecret(response)).not.toHaveProperty('secret')
    expect(response.secret).toBe('once')
  })
  it('adapts legacy API options to the installer and quotes shell metacharacters', () => {
    const apiUrl = "https://api.example.invalid/api?name=owner's&region=sh"
    const response = {
      token: 'bet_once',
      apiUrl,
      expiresAt: '2026-10-14T00:15:00Z',
      command: `curl -fsSL https://custom.invalid/probe/install.sh | sudo sh -s -- --token=bet_once --api-url=${apiUrl}`,
    }
    expect(probeInstallCommand(response)).toBe(
      "curl -fsSL https://custom.invalid/probe/install.sh | sudo sh -s -- --token 'bet_once' --api-url 'https://api.example.invalid/api?name=owner'\\''s&region=sh'",
    )
    expect(response.command).toContain('--token=bet_once')
  })
  it('preserves already compatible backend commands', () => {
    const command =
      "curl -fsSL https://custom.invalid/install.sh | sudo sh -s -- --token 'bet_once' --api-url 'https://api.invalid/api'"
    expect(
      probeInstallCommand({
        token: 'bet_once',
        command,
        expiresAt: '',
        apiUrl: 'https://api.invalid/api',
      }),
    ).toBe(command)
  })
})
