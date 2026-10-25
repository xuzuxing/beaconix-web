import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  adaptKpis,
  adaptTimeline,
  finiteSegments,
  formatMetric,
  timeLabel,
} from '../src/utils/monitoring-adapter.ts'

test('window KPI means and failure-rate sparklines come from backend, never bucket means', () => {
  const data = {
    kpis: {
      uptimePercent: 75,
      avgLatencyMs: 100,
      p95LatencyMs: 185,
      failureRatePercent: 25,
      monitorCount: 3,
      failingCount: 1,
      uptimeDeltaPercent: null,
      avgLatencyDeltaMs: -10,
      p95LatencyDeltaMs: 5,
      failureRateDeltaPercent: null,
      monitorDelta: 0,
      failingDelta: -1,
    },
    sparklines: {
      uptime: [null, 75],
      avgLatency: [null, 100],
      p95Latency: [null, 185],
      failureRate: [null, 25],
      monitorCount: [2, 3],
      failing: [0, 1],
    },
  }
  const kpis = adaptKpis(data)
  assert.equal(kpis[1].value, '100')
  assert.deepEqual(kpis[1].trend, [null, 100])
  assert.deepEqual(kpis[3].trend, [null, 25])
  assert.equal(kpis[0].deltaText, '')
  assert.equal(kpis[1].good, true)
  assert.equal(kpis[2].good, false)
})
test('empty and null arrays never produce NaN or bridge missing observations', () => {
  assert.deepEqual(finiteSegments([], 0, 1), [])
  assert.deepEqual(finiteSegments([null, null], 0, 1), [])
  const segments = finiteSegments([1, null, 3], 0, 3)
  assert.equal(segments.length, 2)
  assert.equal(segments[0][0].x, 0)
  assert.equal(segments[1][0].x, 100)
  assert.equal(formatMetric(null), '-')
  assert.deepEqual(adaptTimeline({ timeline: { points: [] } }).checks, [])
})
test('repeated local hours retain offsets', () => {
  assert.notEqual(
    timeLabel('2026-11-01T01:00:00.000-04:00'),
    timeLabel('2026-11-01T01:00:00.000-05:00'),
  )
  assert.equal(timeLabel('2026-11-01T01:00:00-04:00'), '11-01 01:00 -04:00')
  assert.equal(timeLabel('2026-11-01T01:00:00.000-04:00'), '11-01 01:00 -04:00')
  assert.equal(timeLabel('2026-11-01T01:00:00Z'), '11-01 01:00 Z')
})
test('average latency is not substituted with a percentile', () => {
  const timeline = adaptTimeline({
    timeline: {
      points: [
        {
          time: '2026-10-10T18:00:00.000+08:00',
          avgLatencyMs: 100,
          latencyP50Ms: 95,
        },
      ],
    },
  })
  assert.deepEqual(timeline.avgLatency, [100])
  assert.deepEqual(timeline.latencyP50, [95])
})
