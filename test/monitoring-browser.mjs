import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

// Browser fixtures are intercepted only in this test, never in application code.
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.MONITORING_BROWSER_URL || 'http://127.0.0.1:5178'
const output = resolve('test/artifacts/monitoring')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
})
const date = '2026-10-10T18:32:00+08:00'
const history = {
  retentionDays: 90,
  availableFrom: date,
  countsAvailableFrom: date,
  probeAvailableFrom: date,
  alertsAvailableFrom: date,
  current: 'AVAILABLE',
  previous: 'AVAILABLE',
  countsCurrent: 'AVAILABLE',
  countsPrevious: 'AVAILABLE',
  probeCurrent: 'AVAILABLE',
  probePrevious: 'AVAILABLE',
  alertsCurrent: 'AVAILABLE',
  alertsPrevious: 'AVAILABLE',
}
const points = Array.from({ length: 30 }, (_, i) => ({
  time: `2026-10-10T17:${String(i * 2).padStart(2, '0')}:00+08:00`,
  durationSeconds: 120,
  checks: 24,
  failures: i % 4,
  checksPerMinute: 12,
  avgLatencyMs: i === 12 ? null : 100 + i * 5,
  latencyP50Ms: 90 + i * 4,
  latencyP95Ms: 185 + i * 7,
  latencyP99Ms: 197 + i * 8,
  uptimePercent: 100 - (i % 4),
  monitorCount: 5,
  failingCount: 1,
}))
const populated = {
  range: '1h',
  tz: 'Asia/Shanghai',
  asOf: date,
  from: date,
  to: date,
  previousFrom: date,
  previousTo: date,
  metricBasis: {
    sampleSource: 'LOCAL',
    availability: 'EFFECTIVE_SUCCESS',
    latency: 'LOCAL_DURATION',
  },
  history,
  summary: {
    monitors: { total: 5, up: 1, down: 1, degraded: 1, paused: 1, unknown: 1 },
    probes: { scope: 'PROJECT_ASSIGNED', total: 2, online: 1 },
    alertingCount: 1,
    sslExpiringCount: 1,
    expiringCertificates: [
      {
        monitorId: 'm1',
        host: 'api.example.test',
        expiresAt: date,
        daysLeft: 5,
        issuer: null,
      },
    ],
  },
  kpis: {
    totalChecks: 720,
    failedChecks: 36,
    uptimePercent: 95,
    uptimeDeltaPercent: -1,
    avgLatencyMs: 172,
    avgLatencyDeltaMs: 12,
    p95LatencyMs: 388,
    p95LatencyDeltaMs: 23,
    failureRatePercent: 5,
    failureRateDeltaPercent: 1,
    monitorCount: 5,
    monitorDelta: 1,
    failingCount: 2,
    failingDelta: 1,
  },
  timeline: { interval: '2m', points },
  sparklines: {
    uptime: points.map((p) => p.uptimePercent),
    avgLatency: points.map((p) => p.avgLatencyMs),
    p95Latency: points.map((p) => p.latencyP95Ms),
    failureRate: points.map((p) => 100 - p.uptimePercent),
    monitorCount: points.map((p) => p.monitorCount),
    failing: points.map((p) => p.failingCount),
  },
  distribution: {
    protocols: [
      { type: 'HTTP', count: 4 },
      { type: 'TCP', count: 1 },
    ],
    probes: [
      {
        id: 'probe1',
        scope: 'SYSTEM',
        name: 'System (unknown-region)',
        region: 'unknown-region',
        enabled: true,
        online: true,
        latencyMs: 123,
      },
      {
        id: 'probe2',
        scope: 'TENANT',
        name: 'Tokyo',
        region: 'ap-northeast-1',
        enabled: true,
        online: false,
        latencyMs: null,
      },
    ],
    latencyHistogram: {
      unit: 'ms',
      buckets: [0, 100, 200, 300, 500, 1000].map((from, i, all) => ({
        from,
        to: all[i + 1] ?? null,
        count: 120,
      })),
    },
  },
  slowestMonitors: [
    {
      id: 'm1',
      name: 'Production API with a long name',
      type: 'HTTP',
      target: 'https://api.example.test/health',
      avgLatencyMs: 172,
      p95LatencyMs: 388,
      uptimePercent: 95,
      sparkline: points.map((p) => p.avgLatencyMs),
    },
  ],
  recentAlerts: [
    {
      id: 'event1',
      monitorId: 'm1',
      monitorName: 'Production API',
      target: 'https://api.example.test/health',
      monitorDeleted: false,
      kind: 'CONNECTIVITY',
      level: 'critical',
      status: 'ongoing',
      suppressedReason: null,
      reason: 'TIMEOUT',
      threshold: 5000,
      actual: 5001,
      unit: 'ms',
      message: 'Request timed out',
      startedAt: date,
      resolvedAt: null,
      updatedAt: date,
      durationSeconds: null,
      notified: false,
    },
  ],
}
const availability = {
  tz: 'Asia/Shanghai',
  asOf: date,
  from: '2026-09-11',
  to: '2026-10-10',
  history: { retentionDays: 90, availableFrom: date, status: 'AVAILABLE' },
  hours: Array.from({ length: 24 }, (_, i) => i),
  days: Array.from({ length: 30 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 11 + i)).toISOString().slice(0, 10),
  ),
  cells: Array.from({ length: 720 }, (_, i) => [i % 24, Math.floor(i / 24), i % 11 ? 100 : 90]),
  unavailableCells: [],
  worst: { day: '2026-09-11', hour: 0, value: 90 },
}
const statusCodes = {
  tz: 'Asia/Shanghai',
  asOf: date,
  from: date,
  to: date,
  history: availability.history,
  unclassifiedChecks: 2,
  unavailableBuckets: [],
  buckets: Array.from({ length: 12 }, (_, i) => ({
    time: `2026-10-10T${String(i + 7).padStart(2, '0')}:00:00+08:00`,
    httpChecks: 15,
    success2xx: 10,
    redirect3xx: 1,
    clientError4xx: 1,
    serverError5xx: 1,
    otherStatusCode: 1,
    noStatusCode: 1,
  })),
}
const results = []
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 375, height: 812 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    let mode = 'populated'
    let conditional = 0
    const observed = []
    await page.addInitScript(() => {
      localStorage.setItem(
        'beacon-vue3:user',
        JSON.stringify({
          accessToken: 'browser-test-only',
          refreshToken: '',
          user: {
            id: 'u1',
            name: 'Tester',
            email: 'tester@example.test',
            globalRole: 'USER',
          },
        }),
      )
      localStorage.setItem(
        'beacon-vue3:organization',
        JSON.stringify({ currentOrganizationId: 'o1', currentProjectId: 'p1' }),
      )
    })
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      if (url.pathname === '/api/organizations')
        return route.fulfill({
          json: {
            data: [
              {
                id: 'o1',
                name: 'Test Team',
                slug: 'test-team',
                createdAt: date,
              },
            ],
          },
        })
      if (url.pathname.endsWith('/projects'))
        return route.fulfill({
          json: {
            data: [
              { id: 'p1', name: 'Production', key: 'PROD' },
              { id: 'p2', name: 'Empty', key: 'EMPTY' },
            ],
          },
        })
      if (!url.pathname.includes('/monitoring/')) return route.fulfill({ json: { data: [] } })
      observed.push(url.href)
      if (mode === 'error')
        return route.fulfill({
          status: 503,
          json: { message: 'Test API unavailable' },
        })
      if (mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 400))
      const tag = `W/"${url.pathname}-${url.search}-${mode}"`
      if (route.request().headers()['if-none-match'] === tag) {
        conditional++
        return route.fulfill({ status: 304, headers: { ETag: tag } })
      }
      const empty = url.pathname.includes('/p2/')
      let body
      if (url.pathname.endsWith('/dashboard')) {
        body = structuredClone(populated)
        body.range = url.searchParams.get('range')
        body.tz = url.searchParams.get('tz')
        if (empty) {
          for (const key of Object.keys(body.kpis))
            body.kpis[key] = /Count|Checks|Delta/.test(key) ? 0 : null
          body.timeline.points = []
          Object.keys(body.sparklines).forEach((key) => {
            body.sparklines[key] = []
          })
          body.distribution = {
            protocols: [],
            probes: [],
            latencyHistogram: { unit: 'ms', buckets: [] },
          }
          body.slowestMonitors = []
          body.recentAlerts = []
          for (const key of Object.keys(body.summary.monitors)) body.summary.monitors[key] = 0
          body.summary.probes.total = 0
          body.summary.probes.online = 0
          body.summary.alertingCount = 0
          body.summary.sslExpiringCount = 0
          body.summary.expiringCertificates = []
        }
        if (mode === 'truncated') {
          body.history.current = 'TRUNCATED'
          for (const key of Object.keys(body.kpis))
            if (!/monitor|failing/.test(key)) body.kpis[key] = null
          Object.keys(body.sparklines).forEach((key) => {
            body.sparklines[key] = Array(30).fill(null)
          })
          body.timeline.points.forEach((p) => {
            Object.keys(p).forEach((key) => {
              if (key !== 'time' && key !== 'durationSeconds') p[key] = null
            })
          })
        }
      } else if (url.pathname.endsWith('/availability')) {
        body = structuredClone(availability)
        if (empty) {
          body.cells = []
          body.worst = null
        }
      } else {
        body = structuredClone(statusCodes)
        if (empty) body.buckets = []
      }
      return route.fulfill({
        headers: { ETag: tag },
        json: { data: body, meta: { timestamp: date } },
      })
    })
    await page.goto(`${origin}/dashboard`)
    await page
      .locator('.monitor-kpis, .kpi-grid, .kpis')
      .first()
      .waitFor({ timeout: 30000 })
      .catch(() => {})
    try {
      await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 60000 })
    } catch (error) {
      await page.screenshot({
        path: `${output}/${viewport.width}-startup-failure.png`,
        fullPage: true,
      })
      console.error(
        JSON.stringify({
          errors,
          url: page.url(),
          body: await page.locator('body').innerText(),
        }),
      )
      throw error
    }
    await page.waitForTimeout(800)
    const canvas = await page.locator('canvas').evaluateAll((elements) =>
      elements.map((canvas) => {
        const ctx = canvas.getContext('2d')
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let painted = 0
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) painted++
        return { width: canvas.width, height: canvas.height, painted }
      }),
    )
    assert.ok(canvas.length >= 8)
    assert.ok(canvas.every((c) => c.width > 0 && c.height > 0 && c.painted > 0))
    await page.screenshot({
      path: `${output}/${viewport.width}-populated.png`,
      fullPage: true,
    })
    for (const [part, fraction] of [
      ['middle', 0.5],
      ['bottom', 1],
    ]) {
      await page.locator('.layout__content-body').evaluate((el, value) => {
        el.scrollTop = (el.scrollHeight - el.clientHeight) * value
      }, fraction)
      await page.waitForTimeout(100)
      await page.screenshot({
        path: `${output}/${viewport.width}-${part}.png`,
        fullPage: true,
      })
    }
    await page.locator('.layout__content-body').evaluate((el) => {
      el.scrollTop = 0
    })
    const overflow = await page.evaluate(() => {
      const body = document.querySelector('.layout__content-body')
      return {
        page: document.documentElement.scrollWidth > innerWidth + 1,
        content: body.scrollWidth > body.clientWidth + 1,
      }
    })
    assert.deepEqual(overflow, { page: false, content: false })
    await page.getByText('近 7 天', { exact: true }).click()
    await page.waitForTimeout(100)
    await page.getByText('近 1 小时', { exact: true }).click()
    await page.waitForTimeout(300)
    assert.ok(conditional >= 3)
    assert.ok(observed.some((url) => url.includes('range=7d')))
    await page.locator('[aria-label="Time zone"]').click()
    await page.getByText('America/New_York', { exact: true }).last().click()
    await page.waitForTimeout(300)
    assert.ok(observed.some((url) => new URL(url).searchParams.get('tz') === 'America/New_York'))
    mode = 'truncated'
    await page.getByText('近 30 天', { exact: true }).click()
    await page.waitForTimeout(400)
    await page.screenshot({
      path: `${output}/${viewport.width}-truncated.png`,
      fullPage: true,
    })
    assert.ok((await page.locator('.t-alert--warning').count()) > 0)
    mode = 'error'
    await page.getByText('今天', { exact: true }).click()
    await page.locator('.t-alert--error').waitFor()
    await page.screenshot({
      path: `${output}/${viewport.width}-error.png`,
      fullPage: true,
    })
    mode = 'loading'
    await page.getByText('重试', { exact: true }).click()
    await page.locator('.t-loading').first().waitFor()
    await page.waitForTimeout(700)
    await page.locator('.app-header__project').click()
    await page.locator('.project-list__item').filter({ hasText: 'Empty' }).click()
    await page.waitForTimeout(700)
    assert.equal(await page.locator('canvas').count(), 0)
    await page.screenshot({
      path: `${output}/${viewport.width}-empty.png`,
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    results.push({
      viewport,
      charts: canvas.length,
      conditional,
      overflow,
      errors,
    })
    await context.close()
  }
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
