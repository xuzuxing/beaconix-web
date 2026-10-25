import { beforeEach, expect, it, vi } from 'vitest'
import { AxiosHeaders } from 'axios'
import { service, setupRequestAuth } from '@/utils/request'
import * as api from '@/api/modules/probe'
import { tenantProbe } from '../fixtures/probes'

vi.mock('tdesign-vue-next', () => ({ MessagePlugin: { error: vi.fn() } }))
beforeEach(() => {
  setupRequestAuth({ getAccessToken: () => undefined })
})
it('preserves inner pagination through the response envelope', async () => {
  const page = {
    data: [],
    meta: { total: 55, page: 2, limit: 20, totalPages: 3 },
  }
  service.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    data: { data: page, meta: { timestamp: '2026-10-13' } },
  })
  expect(
    await api.listProbeResults('org/a', 'probe/b', {
      page: 2,
      target: 'https://target.invalid',
    }),
  ).toEqual(page)
  expect(
    await api.listProbeExecutions('org/a', 'probe/b', {
      page: 2,
      status: 'TIMEOUT',
    }),
  ).toEqual(page)
})
it('uses the actual encoded organization routes and mutation payloads', async () => {
  const calls: {
    url?: string
    method?: string
    data: unknown
    params: unknown
  }[] = []
  service.defaults.adapter = async (config) => {
    calls.push({
      url: config.url,
      method: config.method,
      data: config.data ? JSON.parse(config.data) : undefined,
      params: config.params,
    })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: { data: tenantProbe() },
    }
  }
  await api.listProbes('org/a')
  await api.getProbe('org/a', 'probe/b')
  await api.createProbe('org/a', {
    name: 'Node',
    region: 'sh',
    callbackUrl: 'https://host.invalid',
    provider: 'CUSTOM',
  })
  await api.updateProbe('org/a', 'probe/b', { enabled: false })
  await api.bindProbeMonitors('org/a', 'probe/b', ['monitor-1'])
  await api.unbindProbeMonitor('org/a', 'probe/b', 'monitor/c')
  await api.rotateProbeSecret('org/a', 'probe/b')
  await api.validateProbe('org/a', 'probe/b')
  await api.createProbeEnrollment('org/a', { name: 'Node' })
  await api.deleteProbe('org/a', 'probe/b')
  expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
    'get /organizations/org%2Fa/probes',
    'get /organizations/org%2Fa/probes/probe%2Fb',
    'post /organizations/org%2Fa/probes',
    'patch /organizations/org%2Fa/probes/probe%2Fb',
    'post /organizations/org%2Fa/probes/probe%2Fb/monitors',
    'delete /organizations/org%2Fa/probes/probe%2Fb/monitors/monitor%2Fc',
    'post /organizations/org%2Fa/probes/probe%2Fb/rotate-secret',
    'post /organizations/org%2Fa/probes/probe%2Fb/validate',
    'post /organizations/org%2Fa/probes/enroll-token',
    'delete /organizations/org%2Fa/probes/probe%2Fb',
  ])
  expect(calls[3]?.data).toEqual({ enabled: false })
  expect(calls[4]?.data).toEqual({ monitorIds: ['monitor-1'] })
  expect(calls[8]?.data).toEqual({ name: 'Node' })
})
it('reads a device authorization and approves only through the dedicated confirmation endpoint', async () => {
  const calls: {
    url?: string
    method?: string
    data: unknown
    params: unknown
  }[] = []
  service.defaults.adapter = async (config) => {
    calls.push({
      url: config.url,
      method: config.method,
      data: config.data ? JSON.parse(config.data) : undefined,
      params: config.params,
    })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: {
        data:
          config.method === 'get'
            ? {
                userCode: 'WDJB-MJHT',
                status: 'pending',
                requestedAt: '2026-10-14T00:00:00Z',
                client: {},
              }
            : { probeId: 'probe-1', organizationId: 'o1', status: 'approved' },
      },
    }
  }
  const activation = await api.getProbeActivation('WDJB-MJHT')
  expect(activation.status).toBe('pending')
  const payload = {
    userCode: 'WDJB-MJHT',
    organizationId: 'o1',
    name: 'Shanghai node',
    region: 'cn-shanghai',
    provider: 'CUSTOM' as const,
  }
  expect(await api.approveProbeActivation(payload)).toEqual({
    probeId: 'probe-1',
    organizationId: 'o1',
    status: 'approved',
  })
  expect(calls).toEqual([
    {
      url: '/probes/enroll/activate',
      method: 'get',
      data: undefined,
      params: { code: 'WDJB-MJHT' },
    },
    {
      url: '/probes/enroll/approve',
      method: 'post',
      data: payload,
      params: undefined,
    },
  ])
})
