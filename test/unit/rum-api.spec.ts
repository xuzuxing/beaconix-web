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
  getRumPerformanceSeries,
  getRumPerformanceSummary,
  listRumPerformancePages,
  listRumPerformanceResources,
  listRumReleases,
  compareRumReleases,
  updateRumError,
  listRumErrorNotes,
  createRumErrorNote,
  deleteRumErrorNote,
  setRumAppEnabled,
  updateRumApp,
} from '@/api/modules/rum'
import { del, get, patch, post } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  upload: vi.fn(),
}))

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
  it('exposes performance and release query endpoints', () => {
    const signal = new AbortController().signal
    getRumPerformanceSeries('p/a', 'a/b', { release: 'r/1' }, { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/apps/a%2Fb/performance',
      { release: 'r/1' },
      { signal },
    )
    getRumPerformanceSummary('p/a', 'a/b', { page: '/checkout' }, { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/apps/a%2Fb/performance/summary',
      { page: '/checkout' },
      { signal },
    )
    listRumPerformancePages('p/a', 'a/b', { limit: 10 }, { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/apps/a%2Fb/performance/pages',
      { limit: 10 },
      { signal },
    )
    listRumPerformanceResources('p/a', 'a/b', { metric: 'HTTP' }, { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/apps/a%2Fb/performance/resources',
      { metric: 'HTTP' },
      { signal },
    )
    listRumReleases('p/a', 'a/b', { signal })
    expect(get).toHaveBeenCalledWith('/projects/p%2Fa/apps/a%2Fb/releases', undefined, { signal })
    compareRumReleases('p/a', 'a/b', 'base/1', 'target/2', { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/apps/a%2Fb/releases/compare',
      { base: 'base/1', target: 'target/2' },
      { signal },
    )
  })
  it('exposes error workflow and handling-note endpoints', () => {
    const signal = new AbortController().signal
    updateRumError('p/a', 'a/b', 'e/c', { status: 'IGNORED', ignoredUntil: null })
    expect(patch).toHaveBeenCalledWith('/projects/p%2Fa/apps/a%2Fb/errors/e%2Fc', {
      status: 'IGNORED',
      ignoredUntil: null,
    })
    listRumErrorNotes('p/a', 'a/b', 'e/c', { page: 2 }, { signal })
    expect(get).toHaveBeenCalledWith(
      '/projects/p%2Fa/apps/a%2Fb/errors/e%2Fc/notes',
      { page: 2 },
      { signal },
    )
    createRumErrorNote('p/a', 'a/b', 'e/c', 'Fixed in 1.2.3')
    expect(post).toHaveBeenCalledWith('/projects/p%2Fa/apps/a%2Fb/errors/e%2Fc/notes', {
      body: 'Fixed in 1.2.3',
    })
    deleteRumErrorNote('p/a', 'a/b', 'e/c', 'n/d')
    expect(del).toHaveBeenCalledWith('/projects/p%2Fa/apps/a%2Fb/errors/e%2Fc/notes/n%2Fd')
  })
})
