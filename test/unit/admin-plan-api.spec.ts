import { AxiosHeaders } from 'axios'
import { beforeEach, expect, it, vi } from 'vitest'

import * as api from '@/api/modules/admin-plan'
import { service, setupRequestAuth } from '@/utils/request'

vi.mock('tdesign-vue-next', () => ({ MessagePlugin: { error: vi.fn() } }))

beforeEach(() => {
  setupRequestAuth({ getAccessToken: () => undefined })
})

/** 后端 PlanEntity + 管理端补充的协议白名单 */
function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    code: 'PRO',
    name: '专业版',
    description: null,
    price: 2900,
    durationDays: 30,
    sortOrder: 2,
    maxMonitors: 50,
    maxProbes: 3,
    maxMembers: 10,
    maxChannels: 5,
    minInterval: 60,
    allowTenantProbe: true,
    allowStatusPage: true,
    allowedMonitorTypes: ['HTTP', 'TCP'],
    enabled: true,
    createdAt: '2026-03-05T12:00:00.000Z',
    updatedAt: '2026-03-05T12:00:00.000Z',
    ...overrides,
  }
}

it('normalizes every list shape the admin plan endpoint may return', async () => {
  let payload: unknown = [plan(), plan({ id: 'plan-2', code: 'TEAM' })]
  service.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    data: { data: payload },
  })

  expect(await api.listAdminPlans()).toHaveLength(2)

  // 分页包装：只取 items，调用方拿到的始终是数组
  payload = { items: [plan()], total: 1, page: 1, limit: 20, totalPages: 1 }
  expect(await api.listAdminPlans()).toHaveLength(1)

  payload = null
  expect(await api.listAdminPlans()).toEqual([])
})

it('calls the /admin/plans CRUD routes with encoded ids and the given payloads', async () => {
  const calls: { url?: string; method?: string; data: unknown }[] = []
  service.defaults.adapter = async (config) => {
    calls.push({
      url: config.url,
      method: config.method,
      data: config.data ? JSON.parse(config.data) : undefined,
    })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: { data: plan() },
    }
  }

  await api.listAdminPlans()
  await api.getAdminPlan('plan/1')
  await api.createAdminPlan({
    code: 'PRO',
    name: '专业版',
    price: 2900,
    durationDays: 30,
  })
  await api.updateAdminPlan('plan/1', { enabled: false })
  await api.deleteAdminPlan('plan/1')

  expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
    'get /admin/plans',
    'get /admin/plans/plan%2F1',
    'post /admin/plans',
    'patch /admin/plans/plan%2F1',
    'delete /admin/plans/plan%2F1',
  ])
  expect(calls[2]?.data).toEqual({
    code: 'PRO',
    name: '专业版',
    price: 2900,
    durationDays: 30,
  })
  expect(calls[3]?.data).toEqual({ enabled: false })
})
