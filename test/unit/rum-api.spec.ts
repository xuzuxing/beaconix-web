import { describe, expect, it, vi } from 'vitest'
import {
  createRumApp,
  getRumApp,
  getProjectRumOverview,
  listProjectRumErrors,
  listProjectRumEvents,
  listRumErrorOccurrences,
  listRumApps,
  listRumAlertChannels,
  setRumAppEnabled,
  updateRumApp,
} from '@/api/modules/rum'
import { get, patch, post } from '@/utils/request'

vi.mock('@/utils/request', () => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))

describe('RUM app management API', () => {
  it('encodes identifiers and forwards abort signals to reads', () => {
    const signal = new AbortController().signal
    listRumApps('p/a', { signal })
    expect(get).toHaveBeenCalledWith('/projects/p%2Fa/apps', undefined, { signal })
    listRumAlertChannels('p/a', 'a/b', { signal })
    expect(get).toHaveBeenCalledWith('/projects/p%2Fa/apps/a%2Fb/alerts/channels', undefined, {
      signal,
    })
    getRumApp('p/a', 'a/b', { signal })
    expect(get).toHaveBeenCalledWith('/projects/p%2Fa/apps/a%2Fb', undefined, { signal })
    listRumErrorOccurrences('p/a', 'a/b', 'e/c', { page: 2, limit: 20 }, { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/apps/a%2Fb/errors/e%2Fc/occurrences',
      { page: 2, limit: 20 },
      { signal },
    )
  })
  it('uses project-scoped endpoints and forwards filters and abort signals', () => {
    const signal = new AbortController().signal
    getProjectRumOverview('p/a', { signal })
    expect(get).toHaveBeenCalledWith('/projects/p%2Fa/rum/overview', undefined, { signal })
    listProjectRumErrors('p/a', { appId: 'app/2', type: 'TypeError', page: 2 }, { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/rum/errors',
      { appId: 'app/2', type: 'TypeError', page: 2 },
      { signal },
    )
    listProjectRumEvents('p/a', { eventName: 'click', from: '2026-01-01' }, { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/rum/events',
      { eventName: 'click', from: '2026-01-01' },
      { signal },
    )
  })
  it('uses the management endpoints for writes', () => {
    createRumApp('p/a', { name: 'Example' })
    expect(post).toHaveBeenCalledWith('/projects/p%2Fa/apps', { name: 'Example' })
    updateRumApp('p/a', 'a/b', { name: 'New' })
    expect(patch).toHaveBeenCalledWith('/projects/p%2Fa/apps/a%2Fb', { name: 'New' })
    setRumAppEnabled('p/a', 'a/b', false)
    expect(post).toHaveBeenCalledWith('/projects/p%2Fa/apps/a%2Fb/disable')
  })
})
