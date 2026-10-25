import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resetPublicSettingsCache, usePublicSettings } from '@/composables/usePublicSettings'
import { get } from '@/utils/request'

vi.mock('@/utils/request', () => ({ get: vi.fn() }))

describe('usePublicSettings', () => {
  beforeEach(() => {
    resetPublicSettingsCache()
  })

  it('loads once, sends the anonymous headers and reuses the cache', async () => {
    vi.mocked(get).mockResolvedValue({
      'system.siteName': 'Acme',
      'system.maintenanceMode': true,
    })

    const pub = usePublicSettings()
    await pub.load()
    await pub.load()

    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('/settings/public', undefined, {
      headers: { 'X-Anonymous': '1', 'X-Silent-Error': '1' },
    })
    expect(pub.siteName.value).toBe('Acme')
    expect(pub.maintenanceMode.value).toBe(true)
  })

  it('merges concurrent loads into a single request', async () => {
    vi.mocked(get).mockResolvedValue({ 'system.siteName': 'Acme' })

    await Promise.all([usePublicSettings().load(), usePublicSettings().load()])

    expect(get).toHaveBeenCalledTimes(1)
  })

  it('falls back when a key is missing or empty', async () => {
    vi.mocked(get).mockResolvedValue({ 'system.logoUrl': '' })

    const pub = usePublicSettings()
    await pub.load()

    expect(pub.siteName.value).toBe('Beacon')
    expect(pub.defaultLocale.value).toBe('zh-CN')
    expect(pub.logoUrl.value).toBe('')
    expect(pub.maintenanceMode.value).toBe(false)
  })

  it('records the error and keeps the previous snapshot', async () => {
    vi.mocked(get).mockRejectedValue(new Error('boom'))

    const pub = usePublicSettings()
    await pub.load()

    expect(pub.error.value).toBe('boom')
    expect(pub.siteName.value).toBe('Beacon')
  })
})
