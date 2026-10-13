import type { TenantProbe } from '@/api/types/probe'

export const tenantProbe = (id = 'probe-1', organizationId = 'o1'): TenantProbe => ({
  id,
  organizationId,
  scope: 'TENANT',
  name: `Probe ${id}`,
  provider: 'CUSTOM',
  region: 'cn-shanghai',
  callbackUrl: 'https://probe.example.invalid/callback',
  enabled: true,
  status: 'ONLINE',
  lastHeartbeat: '2026-10-13T08:00:00Z',
  heartbeatIntervalSeconds: 60,
  maxTenants: null,
  priority: 0,
  createdAt: '2026-10-13T08:00:00Z',
  updatedAt: '2026-10-13T08:00:00Z',
  resultCount: 25,
  monitors: [],
})
