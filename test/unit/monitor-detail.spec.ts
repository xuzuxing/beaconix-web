import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useMonitorDetail } from '@/composables/useMonitorDetail'
import { getMonitor, getMonitorInsights } from '@/api'
import type { Monitor } from '@/api/types'
import type { MonitorInsights, MonitorDetailRange } from '@/api/types/monitor-detail'
import { ApiError } from '@/utils/request'

vi.mock('@/api', () => ({ getMonitor: vi.fn(), getMonitorInsights: vi.fn() }))
let scope: EffectScope
beforeEach(() => {
  vi.resetAllMocks()
  scope = effectScope()
  vi.mocked(getMonitor).mockResolvedValue({
    id: 'm1',
    name: 'Private old title',
  } as Monitor)
  vi.mocked(getMonitorInsights).mockResolvedValue({
    monitorId: 'm1',
  } as MonitorInsights)
})
afterEach(() => scope.stop())
describe('monitor resource lifecycle', () => {
  it('a child 404 clears old detail and title without changing a valid project', async () => {
    const project = ref('a')
    const state = scope.run(() =>
      useMonitorDetail(project, ref('m1'), ref<MonitorDetailRange>('24h'), ref('UTC')),
    )!
    await flushPromises()
    expect(state.monitor.value?.name).toBe('Private old title')
    vi.mocked(getMonitor).mockRejectedValue(new ApiError('Monitor unavailable', 404))
    await state.refresh()
    expect(state.monitor.value).toBeUndefined()
    expect(state.insights.value).toBeUndefined()
    expect(project.value).toBe('a')
  })
  it('old resource requests cannot overwrite a new detail selection', async () => {
    let finish!: (monitor: Monitor) => void
    vi.mocked(getMonitor).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const id = ref('m1')
    const state = scope.run(() =>
      useMonitorDetail(ref('a'), id, ref<MonitorDetailRange>('24h'), ref('UTC')),
    )!
    vi.mocked(getMonitor).mockResolvedValue({
      id: 'm2',
      name: 'Current title',
    } as Monitor)
    id.value = 'm2'
    finish({ id: 'm1', name: 'Private old title' } as Monitor)
    await flushPromises()
    expect(state.monitor.value?.id).toBe('m2')
  })
})
