import { describe, expect, it } from 'vitest'
import {
  accessContext,
  invalidatePermissions,
  invalidateSession,
  invalidateWorkspace,
  isCurrentContext,
} from '@/utils/access-context'
import { MonitoringRequestState } from '@/utils/monitoring-request-state'

describe('permission and cache epochs', () => {
  it('rejects workspace and permissions changes while preserving current account context', () => {
    const context = accessContext()
    invalidateWorkspace()
    expect(isCurrentContext(context)).toBe(false)
    expect(isCurrentContext(context, true)).toBe(true)
    invalidateSession()
    expect(isCurrentContext(context, true)).toBe(false)
  })
  it('clear rejects late results and never stores their ETag', async () => {
    const cache = new MonitoringRequestState()
    let complete!: (value: { status: number; etag: string; body: string }) => void
    const pending = cache.load(
      'dashboard',
      () =>
        new Promise<{ status: number; etag: string; body: string }>((resolve) => {
          complete = resolve
        }),
    )
    cache.clear()
    complete({ status: 200, etag: 'secret-old', body: 'old-admin-data' })
    await expect(pending).rejects.toThrow('Request context changed')
    let supplied: string | undefined = 'unread'
    const result = await cache.load('dashboard', async (etag) => {
      supplied = etag
      return { status: 200, body: 'viewer' }
    })
    expect(supplied).toBeUndefined()
    expect(result).toBe('viewer')
  })
  it('permission downgrade cannot reuse old body or 304', async () => {
    const cache = new MonitoringRequestState()
    await cache.load('item', async () => ({
      status: 200,
      body: 'admin',
      etag: 'admin-etag',
    }))
    invalidatePermissions()
    const sent: (string | undefined)[] = []
    const result = await cache.load('item', async (etag) => {
      sent.push(etag)
      return sent.length === 1 ? { status: 304 } : { status: 200, body: 'viewer' }
    })
    expect(sent).toEqual([undefined, undefined])
    expect(result).toBe('viewer')
  })
})
