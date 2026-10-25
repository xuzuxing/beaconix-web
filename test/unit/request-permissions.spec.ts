import { beforeEach, expect, it, vi } from 'vitest'
import axios, { AxiosError, AxiosHeaders } from 'axios'
import { get, service, setupRequestAuth, type AuthTokens } from '@/utils/request'
import { invalidateSession } from '@/utils/access-context'
vi.mock('tdesign-vue-next', () => ({ MessagePlugin: { error: vi.fn() } }))
beforeEach(() => {
  invalidateSession()
  vi.restoreAllMocks()
})
it('a replayed 403 is not mistaken for failed refresh or logged out', async () => {
  const logout = vi.fn()
  setupRequestAuth({
    getAccessToken: () => 'old',
    getRefreshToken: () => 'refresh',
    setTokens: vi.fn(),
    onUnauthorized: logout,
    onAccessDenied: vi.fn(),
  })
  vi.spyOn(axios, 'post').mockResolvedValue({
    data: { data: { accessToken: 'new', refreshToken: 'new-refresh' } },
  })
  let calls = 0
  service.defaults.adapter = async (config) => {
    calls++
    const status = calls === 1 ? 401 : 403
    throw new AxiosError('denied', undefined, config, undefined, {
      data: { message: 'denied' },
      status,
      statusText: 'denied',
      headers: new AxiosHeaders(),
      config,
    })
  }
  await expect(get('/projects/b/monitors')).rejects.toMatchObject({
    status: 403,
  })
  expect(calls).toBe(2)
  expect(logout).not.toHaveBeenCalled()
})
it('logout during refresh prevents token writes and request replays', async () => {
  const setTokens = vi.fn<(tokens: AuthTokens) => void>()
  const logout = vi.fn()
  setupRequestAuth({
    getAccessToken: () => 'old',
    getRefreshToken: () => 'refresh',
    setTokens,
    onUnauthorized: logout,
  })
  let finish!: (response: unknown) => void
  vi.spyOn(axios, 'post').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  service.defaults.adapter = async (config) => {
    throw new AxiosError('expired', undefined, config, undefined, {
      data: {},
      status: 401,
      statusText: 'expired',
      headers: new AxiosHeaders(),
      config,
    })
  }
  const pending = get('/projects/b/monitors')
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  invalidateSession()
  finish({ data: { data: { accessToken: 'stale', refreshToken: 'stale' } } })
  await expect(pending).rejects.toThrow('Request context changed')
  expect(setTokens).not.toHaveBeenCalled()
  expect(logout).not.toHaveBeenCalled()
})
it('an earlier account refresh failure cannot log out a newer account', async () => {
  const logout = vi.fn()
  setupRequestAuth({
    getAccessToken: () => 'u1',
    getRefreshToken: () => 'u1-refresh',
    onUnauthorized: logout,
  })
  let fail!: (cause: Error) => void
  vi.spyOn(axios, 'post').mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject
      }),
  )
  service.defaults.adapter = async (config) => {
    throw new AxiosError('expired', undefined, config, undefined, {
      data: {},
      status: 401,
      statusText: 'expired',
      headers: new AxiosHeaders(),
      config,
    })
  }
  const request = get('/projects/a/monitors')
  await vi.waitFor(() => expect(fail).toBeTypeOf('function'))
  invalidateSession()
  setupRequestAuth({
    getAccessToken: () => 'u2',
    getRefreshToken: () => 'u2-refresh',
  })
  fail(new Error('U1 refresh network failure'))
  await expect(request).rejects.toThrow('Request context changed')
  expect(logout).not.toHaveBeenCalled()
})
