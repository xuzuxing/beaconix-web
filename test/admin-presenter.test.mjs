import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  adminTenantMatches,
  adminTenantState,
  adminTenantTheme,
  formatCompactNumber,
  formatInterval,
  isOrderExpired,
  isProbeHeartbeatStale,
  jobSchedule,
  orderActions,
  orderStatusTheme,
  probeLiveness,
  probeLivenessTheme,
  probeOfflineThresholdMs,
  probeProviderLabelKey,
  probeProviderTheme,
  probeStatusTheme,
  queueBacklog,
  schedulerHealthLevel,
  selectAdminTenants,
  selectSystemProbes,
} from '../src/utils/admin-presenter.ts'

const probe = (overrides = {}) => ({
  id: 'probe-1',
  scope: 'SYSTEM',
  name: 'Tokyo probe',
  provider: 'TENCENT',
  region: 'ap-northeast-1',
  callbackUrl: 'https://probe.example.test/beacon',
  enabled: true,
  lastHeartbeat: '2026-03-05T12:00:00.000Z',
  heartbeatIntervalSeconds: 60,
  status: 'ONLINE',
  maxTenants: 100,
  priority: 0,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-05T12:00:00.000Z',
  monitors: [],
  ...overrides,
})

const tenant = (overrides = {}) => ({
  id: 'org-1',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  ownerId: 'user-1',
  active: true,
  memberCount: 3,
  projectCount: 2,
  monitorCount: 8,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
})

const queue = (overrides = {}) => ({
  waiting: 0,
  active: 0,
  delayed: 0,
  failed: 0,
  completed: 0,
  ...overrides,
})

const health = (overrides = {}) => ({
  scanQueue: queue(),
  checkQueue: queue(),
  scheduledQueue: queue(),
  schedulers: [],
  backlog: { enabledMonitors: 10, dueMonitors: 0 },
  probes: { online: 2, offline: 0 },
  ...overrides,
})

// ---------- 探针 ----------

test('供应商与状态映射到标签主题', () => {
  assert.equal(probeProviderTheme('TENCENT'), 'primary')
  assert.equal(probeProviderTheme('ALIYUN'), 'warning')
  assert.equal(probeProviderTheme('CUSTOM'), 'default')
  assert.equal(probeProviderLabelKey('ALIYUN'), 'adminPage.probe.providerLabel.ALIYUN')
  assert.equal(probeStatusTheme('ONLINE'), 'success')
  assert.equal(probeStatusTheme('OFFLINE'), 'danger')
})

test('离线阈值取心跳间隔的 3 倍，缺失时按 60 秒兜底', () => {
  assert.equal(probeOfflineThresholdMs(probe({ heartbeatIntervalSeconds: 10 })), 30_000)
  assert.equal(probeOfflineThresholdMs(probe({ heartbeatIntervalSeconds: null })), 180_000)
  assert.equal(probeOfflineThresholdMs(probe({ heartbeatIntervalSeconds: 0 })), 180_000)
})

test('心跳超时判定覆盖缺失、非法与过期三种情况', () => {
  const now = Date.parse('2026-03-05T12:01:00.000Z')
  assert.equal(isProbeHeartbeatStale(probe(), now), false)
  assert.equal(isProbeHeartbeatStale(probe({ lastHeartbeat: null }), now), true)
  assert.equal(isProbeHeartbeatStale(probe({ lastHeartbeat: 'not-a-date' }), now), true)
  assert.equal(
    isProbeHeartbeatStale(probe({ lastHeartbeat: '2026-03-05T11:55:00.000Z' }), now),
    true,
  )
  // 自定义心跳间隔把阈值压到 30 秒：同一份 60 秒前的心跳，默认阈值下不算超时，压到 30 秒后即超时
  assert.equal(
    isProbeHeartbeatStale(probe({ lastHeartbeat: '2026-03-05T12:00:00.000Z' }), now),
    false,
  )
  assert.equal(
    isProbeHeartbeatStale(
      probe({
        lastHeartbeat: '2026-03-05T12:00:00.000Z',
        heartbeatIntervalSeconds: 10,
      }),
      now,
    ),
    true,
  )
})

test('存活状态在后端标记在线但心跳过期时降级为 stale', () => {
  const now = Date.parse('2026-03-05T12:01:00.000Z')
  assert.equal(probeLiveness(probe(), now), 'online')
  assert.equal(probeLiveness(probe({ lastHeartbeat: '2026-03-05T11:00:00.000Z' }), now), 'stale')
  assert.equal(probeLiveness(probe({ status: 'OFFLINE' }), now), 'offline')
  assert.equal(probeLivenessTheme('online'), 'success')
  assert.equal(probeLivenessTheme('stale'), 'warning')
  assert.equal(probeLivenessTheme('offline'), 'danger')
})

test('探针关键词筛选覆盖名称、区域、回调地址与 ID', () => {
  const probes = [
    probe(),
    probe({ id: 'probe-2', name: 'Frankfurt probe', region: 'eu-central-1' }),
  ]
  assert.equal(selectSystemProbes(probes, '').length, 2)
  assert.deepEqual(
    selectSystemProbes(probes, 'frankfurt').map((item) => item.id),
    ['probe-2'],
  )
  assert.deepEqual(
    selectSystemProbes(probes, 'AP-NORTHEAST').map((item) => item.id),
    ['probe-1'],
  )
  assert.deepEqual(
    selectSystemProbes(probes, 'probe.example').map((item) => item.id),
    ['probe-1', 'probe-2'],
  )
})

// ---------- 租户 ----------

test('租户状态与标签主题', () => {
  assert.equal(adminTenantState(tenant()), 'active')
  assert.equal(adminTenantState(tenant({ active: false })), 'deleted')
  assert.equal(adminTenantTheme('active'), 'success')
  assert.equal(adminTenantTheme('deleted'), 'default')
})

test('租户关键词匹配名称、slug、所有者与 ID', () => {
  assert.equal(adminTenantMatches(tenant(), 'acme'), true)
  assert.equal(adminTenantMatches(tenant(), 'ACME-CORP'), true)
  assert.equal(adminTenantMatches(tenant(), 'user-1'), true)
  assert.equal(adminTenantMatches(tenant(), 'org-1'), true)
  assert.equal(adminTenantMatches(tenant(), 'nope'), false)
  assert.equal(adminTenantMatches(tenant(), '  '), true)
})

test('租户筛选按状态过滤，活跃优先、同级按创建时间倒序', () => {
  const tenants = [
    tenant({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
    tenant({
      id: 'deleted',
      active: false,
      createdAt: '2026-04-01T00:00:00.000Z',
    }),
    tenant({ id: 'new', createdAt: '2026-03-01T00:00:00.000Z' }),
  ]

  assert.deepEqual(
    selectAdminTenants(tenants, '').map((item) => item.id),
    ['new', 'old', 'deleted'],
  )
  assert.deepEqual(
    selectAdminTenants(tenants, '', 'active').map((item) => item.id),
    ['new', 'old'],
  )
  assert.deepEqual(
    selectAdminTenants(tenants, '', 'deleted').map((item) => item.id),
    ['deleted'],
  )
  assert.deepEqual(
    selectAdminTenants(tenants, 'acme', 'deleted').map((item) => item.id),
    ['deleted'],
  )
})

// ---------- 订单 ----------

test('订单状态主题与可执行动作对齐后端状态机', () => {
  assert.equal(orderStatusTheme('PAID'), 'success')
  assert.equal(orderStatusTheme('PENDING'), 'warning')
  assert.equal(orderStatusTheme('CANCELLED'), 'default')
  assert.equal(orderStatusTheme('REFUNDED'), 'default')

  assert.deepEqual(orderActions({ status: 'PENDING' }), {
    canCancel: true,
    canMarkPaid: true,
    canRefund: false,
  })
  assert.deepEqual(orderActions({ status: 'PAID' }), {
    canCancel: false,
    canMarkPaid: false,
    canRefund: true,
  })
  assert.deepEqual(orderActions({ status: 'CANCELLED' }), {
    canCancel: false,
    canMarkPaid: false,
    canRefund: false,
  })
  assert.deepEqual(orderActions({ status: 'REFUNDED' }), {
    canCancel: false,
    canMarkPaid: false,
    canRefund: false,
  })
})

test('待支付订单过期判定按 expiresAt', () => {
  const now = Date.parse('2026-03-05T13:00:00.000Z')
  assert.equal(isOrderExpired({ expiresAt: '2026-03-05T12:30:00.000Z' }, now), true)
  assert.equal(isOrderExpired({ expiresAt: '2026-03-05T13:30:00.000Z' }, now), false)
  assert.equal(isOrderExpired({ expiresAt: 'nonsense' }, now), false)
})

// ---------- 指标 / 调度 ----------

test('大数字压缩展示', () => {
  assert.equal(formatCompactNumber(0), '0')
  assert.equal(formatCompactNumber(999), '999')
  assert.equal(formatCompactNumber(1000), '1K')
  assert.equal(formatCompactNumber(1234), '1.2K')
  assert.equal(formatCompactNumber(180000), '180K')
  assert.equal(formatCompactNumber(1200000), '1.2M')
  assert.equal(formatCompactNumber(Number.NaN), '—')
})

test('队列积压为等待 + 处理中 + 延迟', () => {
  assert.equal(queueBacklog(queue({ waiting: 2, active: 1, delayed: 3, failed: 9 })), 6)
})

test('调度健康度按失败 / 到期待检测 / 探针离线分级', () => {
  assert.equal(schedulerHealthLevel(health()), 'ok')
  assert.equal(schedulerHealthLevel(health({ probes: { online: 1, offline: 2 } })), 'warning')
  assert.equal(
    schedulerHealthLevel(health({ backlog: { enabledMonitors: 10, dueMonitors: 3 } })),
    'danger',
  )
  assert.equal(schedulerHealthLevel(health({ checkQueue: queue({ failed: 1 }) })), 'danger')
})

test('定时任务区分间隔型与 cron 型', () => {
  assert.deepEqual(jobSchedule({ id: 'a', everyMs: 10000, pattern: null, nextRunAt: null }), {
    kind: 'interval',
    ms: 10000,
  })
  assert.deepEqual(
    jobSchedule({
      id: 'b',
      everyMs: null,
      pattern: '0 8 * * *',
      nextRunAt: null,
    }),
    { kind: 'cron', pattern: '0 8 * * *' },
  )
  assert.deepEqual(jobSchedule({ id: 'c', everyMs: null, pattern: null, nextRunAt: null }), {
    kind: 'unknown',
  })
})

test('间隔格式化按小时 / 分钟 / 秒选取单位', () => {
  assert.equal(formatInterval(10000), '10s')
  assert.equal(formatInterval(60000), '1m')
  assert.equal(formatInterval(3600000), '1h')
  assert.equal(formatInterval(1500), '1.5s')
  assert.equal(formatInterval(0), '—')
})
