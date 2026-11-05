import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { getMonitorCapacity, listMonitors, listProjects, selectMonitorCapacity } from '@/api'
import type { Monitor } from '@/api/types'
import type { MonitorCapacity } from '@/api/types/billing'
import { useMonitorCapacity } from '@/composables/useMonitorCapacity'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { monitorCapacityRestricted, monitorStatus } from '@/utils/monitor-presenter'
import {
  notificationLabelKey,
  notificationTheme,
  resolveNotificationTarget,
} from '@/utils/notification-presenter'
import type { UserNotification } from '@/api/types/notification-center'
import { componentOptions } from '../fixtures/components'
import { ownerPermissions, project, orgPermissions } from '../fixtures/access'

vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  getMonitorCapacity: vi.fn(),
  selectMonitorCapacity: vi.fn(),
  listMonitors: vi.fn(),
  listProjects: vi.fn(),
}))

const snapshot = (patch: Partial<MonitorCapacity> = {}): MonitorCapacity => ({
  cycleId: 'cycle-1',
  status: 'GRACE',
  startsAt: '2026-10-29T00:00:00Z',
  graceEndsAt: '2026-11-01T00:00:00Z',
  limit: 1,
  total: 2,
  excess: 1,
  overLimit: true,
  selectedMonitorIds: [],
  retainedMonitorIds: ['a'],
  restrictedMonitorIds: [],
  monitorDeadlines: [{ id: 'b', quotaGraceEndsAt: '2026-11-01T00:00:00Z', enabled: false }],
  ...patch,
})
const wrappers: ReturnType<typeof mount>[] = []
function harness() {
  let state!: ReturnType<typeof useMonitorCapacity>
  wrappers.push(
    mount(
      defineComponent({
        setup() {
          const org = useOrganizationStore()
          state = useMonitorCapacity(computed(() => org.currentOrganizationId))
          return () => h('div')
        },
      }),
      { global: componentOptions() },
    ),
  )
  return state
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  useOrganizationStore().currentOrganizationId = 'o1'
  const permissions = usePermissionsStore()
  permissions.organizations.o1 = { state: 'ready', data: ownerPermissions, error: '' }
  vi.spyOn(permissions, 'ensureOrganization').mockResolvedValue(ownerPermissions)
  vi.mocked(getMonitorCapacity).mockResolvedValue(snapshot())
  vi.mocked(listProjects).mockResolvedValue([project('p1')])
  vi.mocked(listMonitors).mockResolvedValue([{ id: 'a' }, { id: 'b', enabled: false }] as Monitor[])
  vi.mocked(selectMonitorCapacity).mockResolvedValue(
    snapshot({ selectedMonitorIds: ['b'], retainedMonitorIds: ['b'] }),
  )
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('downgrade capacity workflow', () => {
  it('uses backend allocation, without turning automatic slots into explicit choices', async () => {
    const state = harness()
    await flushPromises()
    expect(state.selected.value).toEqual([])
    expect(state.capacity.value?.retainedMonitorIds).toEqual(['a'])
    expect(state.dirty.value).toBe(false)
    state.selected.value = ['b']
    expect(await state.save()).toBe(true)
    expect(selectMonitorCapacity).toHaveBeenCalledWith('o1', {
      cycleId: 'cycle-1',
      monitorIds: ['b'],
    })
    expect(state.capacity.value?.retainedMonitorIds).toEqual(['b'])
    expect(state.monitors.value.find((row) => row.id === 'b')?.enabled).toBe(false)
  })
  it('saves an empty selection to restore default ordering, without extending the cycle', async () => {
    vi.mocked(getMonitorCapacity).mockResolvedValue(snapshot({ selectedMonitorIds: ['a'] }))
    const state = harness()
    await flushPromises()
    state.selected.value = []
    await state.save()
    expect(selectMonitorCapacity).toHaveBeenCalledWith('o1', { cycleId: 'cycle-1', monitorIds: [] })
  })
  it('rejects excess selections locally', async () => {
    const state = harness()
    await flushPromises()
    state.selected.value = ['a', 'b']
    expect(await state.save()).toBe(false)
    expect(selectMonitorCapacity).not.toHaveBeenCalled()
  })
  it('blocks saving a partial project list and allows retry', async () => {
    vi.mocked(listProjects).mockResolvedValue([project('p1'), project('p2')])
    vi.mocked(listMonitors).mockImplementation((id) =>
      id === 'p2'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve([{ id: 'a' }] as Monitor[]),
    )
    const state = harness()
    await flushPromises()
    expect(state.monitorsError.value).toBeTruthy()
    state.selected.value = ['a']
    expect(await state.save()).toBe(false)
    vi.mocked(listMonitors).mockResolvedValue([])
    await state.load()
    expect(state.monitorsError.value).toBe('')
  })
  it('refreshes an expired cycle after a failed save without retrying the old request', async () => {
    const state = harness()
    await flushPromises()
    state.selected.value = ['b']
    vi.mocked(selectMonitorCapacity).mockRejectedValue(new Error('cycle changed'))
    vi.mocked(getMonitorCapacity).mockResolvedValue(
      snapshot({ cycleId: 'cycle-2', limit: 0, selectedMonitorIds: [] }),
    )
    expect(await state.save()).toBe(false)
    expect(selectMonitorCapacity).toHaveBeenCalledTimes(1)
    expect(state.capacity.value?.cycleId).toBe('cycle-2')
    expect(state.selected.value).toEqual([])
    expect(state.error.value).toContain('cycle changed')
  })
  it('discards the old organization response when switching teams', async () => {
    let finish!: (value: MonitorCapacity) => void
    vi.mocked(getMonitorCapacity).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const state = harness()
    await flushPromises()
    const permissions = usePermissionsStore()
    permissions.organizations.o2 = {
      state: 'ready',
      data: { ...ownerPermissions, organizationId: 'o2' },
      error: '',
    }
    vi.mocked(getMonitorCapacity).mockResolvedValue(snapshot({ cycleId: 'o2-cycle' }))
    useOrganizationStore().currentOrganizationId = 'o2'
    await flushPromises()
    finish(snapshot({ cycleId: 'stale-cycle' }))
    await flushPromises()
    expect(state.capacity.value?.cycleId).toBe('o2-cycle')
  })
  it('clears the draft and makes no capacity request after losing admin access', async () => {
    const state = harness()
    await flushPromises()
    state.selected.value = ['b']
    const count = vi.mocked(getMonitorCapacity).mock.calls.length
    usePermissionsStore().organizations.o1 = { state: 'ready', data: orgPermissions, error: '' }
    await flushPromises()
    expect(state.capacity.value).toBeNull()
    expect(state.selected.value).toEqual([])
    expect(await state.save()).toBe(false)
    expect(getMonitorCapacity).toHaveBeenCalledTimes(count)
  })
})

describe('restriction presentation', () => {
  it('masks historical UP exactly at each deadline, preserving manual pause', () => {
    const deadline = '2026-11-01T00:00:00Z'
    expect(
      monitorCapacityRestricted({ quotaGraceEndsAt: deadline }, Date.parse(deadline) - 1),
    ).toBe(false)
    expect(monitorCapacityRestricted({ quotaGraceEndsAt: deadline }, Date.parse(deadline))).toBe(
      true,
    )
    expect(
      monitorStatus({
        enabled: true,
        status: 'UP',
        executionBlockedReason: 'MONITOR_QUOTA_EXCEEDED',
      }),
    ).toBe('UNKNOWN')
    expect(
      monitorStatus({ enabled: false, status: 'UP', quotaGraceEndsAt: '2020-01-01T00:00:00Z' }),
    ).toBe('PAUSED')
  })
  it.each([
    'MONITOR_CAPACITY_GRACE_STARTED',
    'MONITOR_CAPACITY_GRACE_ENDING',
    'MONITOR_CAPACITY_LIMITED',
    'MONITOR_CAPACITY_RESTORED',
  ] as const)('routes %s to the scoped capacity page', (type) => {
    const notice = {
      type,
      resourceType: 'MonitorCapacityCycle',
      meta: { organizationId: 'o2' },
    } as UserNotification
    expect(notificationLabelKey(type)).toBe('notificationCenter.type.billing')
    expect(notificationTheme(type)).toBe(
      type === 'MONITOR_CAPACITY_LIMITED'
        ? 'danger'
        : type === 'MONITOR_CAPACITY_RESTORED'
          ? 'success'
          : 'warning',
    )
    expect(resolveNotificationTarget(notice)).toEqual({
      kind: 'route',
      to: { path: '/billing', hash: '#monitor-capacity', query: { organizationId: 'o2' } },
    })
  })
})
