import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  certificateDays,
  formatMonitorTime,
  monitorStatus,
  selectMonitors,
  summarizeMonitors,
} from '../src/utils/monitor-presenter.ts'

const rows = [
  {
    id: 'a',
    name: 'API',
    target: 'https://api.test',
    enabled: true,
    status: 'DOWN',
    type: 'HTTP',
    lastLatency: 400,
    createdAt: '2026-10-10',
  },
  {
    id: 'b',
    name: 'Database',
    target: 'db.test:5432',
    enabled: false,
    status: 'UP',
    type: 'TCP',
    lastLatency: 12,
    createdAt: '2026-10-09',
  },
  {
    id: 'c',
    name: 'Worker',
    target: 'https://job.test',
    enabled: true,
    status: 'PAUSED',
    type: 'HTTP',
    lastLatency: null,
    createdAt: '2026-10-08',
  },
]
test('enabled state wins over stale state snapshots', () => {
  assert.equal(monitorStatus(rows[1]), 'PAUSED')
  assert.equal(monitorStatus(rows[2]), 'UNKNOWN')
  assert.deepEqual(summarizeMonitors(rows), {
    total: 3,
    UP: 0,
    DOWN: 1,
    DEGRADED: 0,
    PAUSED: 1,
    UNKNOWN: 1,
  })
})
test('search matches name or target, respects normalized state and protocol', () => {
  assert.deepEqual(
    selectMonitors(rows, ' DB.TEST ', 'PAUSED', 'TCP', 'newest').map((r) => r.id),
    ['b'],
  )
  assert.deepEqual(selectMonitors(rows, 'database', 'UP', 'all', 'name'), [])
})
test('sorting is stable, null latency last, original input untouched', () => {
  assert.deepEqual(
    selectMonitors(rows, '', 'all', 'all', 'latency').map((r) => r.id),
    ['a', 'b', 'c'],
  )
  assert.deepEqual(
    selectMonitors(rows, '', 'all', 'all', 'status').map((r) => r.id),
    ['a', 'c', 'b'],
  )
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a', 'b', 'c'],
  )
})
test('invalid/missing times remain unknown and valid times use requested zone', () => {
  assert.equal(formatMonitorTime(null), '-')
  assert.equal(formatMonitorTime('not-a-date'), '-')
  assert.match(formatMonitorTime('2026-10-10T00:00:00Z', 'en-US', 'Asia/Shanghai'), /08:00:00/)
})
test('certificate remaining days recompute against snapshot, including expired and missing', () => {
  assert.equal(certificateDays('2026-10-12T00:00:00Z', '2026-10-10T12:00:00Z'), 2)
  assert.equal(certificateDays('2026-10-09T00:00:00Z', '2026-10-10T12:00:00Z'), -1)
  assert.equal(certificateDays(null, Date.now()), null)
  assert.equal(certificateDays('invalid', Date.now()), null)
})
