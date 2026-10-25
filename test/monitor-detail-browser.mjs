import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.MONITORING_BROWSER_URL || 'http://127.0.0.1:5179'
const output = resolve('test/artifacts/monitor-detail')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const date = '2026-10-10T20:00:00+08:00'
const monitor = {
  id: 'm1',
  projectId: 'p1',
  organizationId: 'o1',
  name: 'Production API',
  type: 'HTTP',
  target: 'https://api.example.test/health',
  interval: 60,
  timeout: 5000,
  expectedStatus: 200,
  failureThreshold: 3,
  failCount: 3,
  enabled: true,
  status: 'DOWN',
  lastCheckAt: date,
  lastLatency: 200,
  lastError: 'Request timed out',
  checkSsl: true,
  sslExpiryThreshold: 30,
  sslExpiresAt: '2026-10-22T00:00:00Z',
  sslIssuer: 'Example CA',
  sslSubject: 'api.example.test',
  sslDaysRemaining: 999,
  notificationChannelIds: [],
  availabilityEnabled: true,
  availabilityThreshold: 90,
  availabilityWindow: 10,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: date,
}
const insights = {
  monitorId: 'm1',
  range: '24h',
  tz: 'Asia/Shanghai',
  asOf: date,
  from: '2026-10-09T20:00:00+08:00',
  to: date,
  metricBasis: {
    sampleSource: 'LOCAL',
    availability: 'EFFECTIVE_SUCCESS',
    latency: 'LOCAL_DURATION',
  },
  history: {
    retentionDays: 90,
    availableFrom: '2026-08-01T00:00:00Z',
    status: 'AVAILABLE',
    alertsAvailableFrom: '2026-08-01T00:00:00Z',
    alertsStatus: 'AVAILABLE',
  },
  latest: {
    status: 'DOWN',
    failCount: 3,
    lastCheckAt: date,
    lastLatency: 200,
    lastError: 'Request timed out',
    ongoingCount: 1,
  },
  metrics: {
    totalChecks: 1440,
    failedChecks: 4,
    rescuedChecks: 2,
    uptimePercent: 99.72,
    avgLatencyMs: 100,
    p50LatencyMs: 95,
    p95LatencyMs: 185,
    p99LatencyMs: 197,
  },
  timeline: {
    interval: '1h',
    points: Array.from({ length: 24 }, (_, i) => ({
      time: `2026-10-10T${String(i).padStart(2, '0')}:00:00+08:00`,
      durationSeconds: 3600,
      checks: 60,
      failures: i % 4,
      avgLatencyMs: 100 + i,
      latencyP50Ms: 95 + i,
      latencyP95Ms: 185 + i,
      latencyP99Ms: 197 + i,
      uptimePercent: 100 - (i % 4),
    })),
  },
  checksLimit: 50,
  eventsLimit: 20,
  checks: Array.from({ length: 15 }, (_, i) => ({
    id: `c${i}`,
    success: i !== 3,
    localSuccess: i !== 3 && i !== 2,
    rescuedByProbe: i === 2,
    latency: 100 + i,
    statusCode: i === 3 ? 500 : 200,
    error: i === 3 ? 'HTTP 500' : null,
    source: 'LOCAL',
    checkedAt: date,
  })),
  events: [
    {
      id: 'e1',
      monitorId: 'm1',
      monitorName: monitor.name,
      target: monitor.target,
      monitorDeleted: false,
      kind: 'CONNECTIVITY',
      level: 'critical',
      status: 'ongoing',
      origin: 'BASELINE',
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
    {
      id: 'e2',
      monitorId: 'm1',
      monitorName: monitor.name,
      target: monitor.target,
      monitorDeleted: false,
      kind: 'SSL',
      level: 'warning',
      status: 'resolved',
      origin: 'OBSERVED',
      suppressedReason: null,
      reason: 'SSL_EXPIRING',
      threshold: 30,
      actual: 12,
      unit: 'days',
      message: 'Certificate expires soon',
      startedAt: date,
      resolvedAt: date,
      updatedAt: date,
      durationSeconds: 10,
      notified: true,
    },
  ],
}
// 监控大盘（云监控 → 概览用的 /monitoring/dashboard）
const dashboard = {
  range: '24h',
  tz: 'Asia/Shanghai',
  asOf: date,
  from: '2026-10-09T20:00:00+08:00',
  to: date,
  previousFrom: '2026-10-08T20:00:00+08:00',
  previousTo: '2026-10-09T20:00:00+08:00',
  metricBasis: {
    sampleSource: 'LOCAL',
    availability: 'EFFECTIVE_SUCCESS',
    latency: 'LOCAL_DURATION',
  },
  history: {
    retentionDays: 90,
    availableFrom: '2026-08-01T00:00:00Z',
    countsAvailableFrom: '2026-08-01T00:00:00Z',
    probeAvailableFrom: '2026-08-01T00:00:00Z',
    alertsAvailableFrom: '2026-08-01T00:00:00Z',
    current: 'AVAILABLE',
    previous: 'AVAILABLE',
    countsCurrent: 'AVAILABLE',
    countsPrevious: 'AVAILABLE',
    probeCurrent: 'AVAILABLE',
    probePrevious: 'AVAILABLE',
    alertsCurrent: 'AVAILABLE',
    alertsPrevious: 'AVAILABLE',
  },
  summary: {
    monitors: { total: 16, up: 3, down: 1, degraded: 4, paused: 4, unknown: 4 },
    probes: { scope: 'PROJECT_ASSIGNED', total: 2, online: 1 },
    alertingCount: 1,
    sslExpiringCount: 1,
    expiringCertificates: [],
  },
  kpis: {
    totalChecks: 1440,
    failedChecks: 36,
    uptimePercent: 97.5,
    uptimeDeltaPercent: -1,
    avgLatencyMs: 172,
    avgLatencyDeltaMs: 12,
    p95LatencyMs: 388,
    p95LatencyDeltaMs: 23,
    failureRatePercent: 2.5,
    failureRateDeltaPercent: 1,
    monitorCount: 16,
    monitorDelta: 1,
    failingCount: 5,
    failingDelta: 1,
  },
  timeline: {
    interval: '2h',
    points: Array.from({ length: 6 }, (_, i) => ({
      time: `2026-10-10T${String(i * 2).padStart(2, '0')}:00:00+08:00`,
      durationSeconds: 7200,
      checks: 60,
      failures: i % 3,
      avgLatencyMs: 150 + i,
      latencyP50Ms: 140 + i,
      latencyP95Ms: 300 + i,
      latencyP99Ms: 320 + i,
      uptimePercent: 100 - (i % 4),
    })),
  },
  sparklines: {
    uptime: [99, 98, 97, 99, 98, 99],
    avgLatency: [150, 155, 160, 158, 165, 172],
    p95Latency: [300, 310, 320, 318, 330, 388],
    failureRate: [1, 2, 3, 1, 2, 2.5],
    monitorCount: [14, 15, 15, 16, 16, 16],
    failing: [3, 4, 5, 4, 5, 5],
  },
  distribution: {
    protocols: [
      { type: 'HTTP', count: 8 },
      { type: 'TCP', count: 8 },
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
    ],
    latencyHistogram: {
      unit: 'ms',
      buckets: [
        { from: 0, to: 100, count: 120 },
        { from: 100, to: 200, count: 80 },
        { from: 200, to: null, count: 10 },
      ],
    },
  },
  slowestMonitors: [],
  recentAlerts: [],
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
    const observed = []
    let mode = 'normal'
    let role = 'ADMIN'
    let delayedStartup = false
    let rows = Array.from({ length: 16 }, (_, i) => ({
      ...monitor,
      id: `m${i + 1}`,
      name: i ? `Service ${String(i).padStart(2, '0')}` : monitor.name,
      type: i % 2 ? 'TCP' : 'HTTP',
      target: i % 2 ? `database-${i}.test:5432` : monitor.target,
      status: i ? ['UP', 'DEGRADED', 'UNKNOWN', 'PAUSED'][i % 4] : 'DOWN',
      enabled: i % 4 !== 3,
    }))
    rows[0] = { ...monitor }
    page.on('pageerror', (error) => errors.push(error.message))
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
      const request = route.request()
      const url = new URL(request.url())
      if (!url.pathname.startsWith('/api/')) return route.continue()
      const path = url.pathname
      const send = (data) => route.fulfill({ json: { data, meta: { timestamp: date } } })
      if (path === '/api/organizations')
        return send([
          { id: 'o1', name: 'Test Team', slug: 'test-team' },
          { id: 'o2', name: 'Other Team', slug: 'other-team' },
        ])
      if (path.endsWith('/projects')) {
        if (mode === 'startup-race' && path.includes('/o1/')) {
          delayedStartup = true
          await new Promise((resolve) => setTimeout(resolve, 900))
        }
        return send(
          path.includes('/o2/')
            ? [{ id: 'p3', name: 'Other project', key: 'OTHER' }]
            : [
                { id: 'p1', name: 'Production', key: 'PROD' },
                { id: 'p2', name: 'Empty', key: 'EMPTY' },
              ],
        )
      }
      if (path.endsWith('/members')) return send([{ userId: 'u1', role }])
      if (path.endsWith('/subscription')) return send({ effectivePlan: null, stack: [] })
      if (path.endsWith('/monitoring/dashboard')) return send(dashboard)
      if (!path.includes('/monitors')) return send([])
      if (mode === 'startup-race' && path.includes('/p3/'))
        await new Promise((resolve) => setTimeout(resolve, 150))
      if (mode === 'resolve-race' && path.includes('/p3/'))
        await new Promise((resolve) => setTimeout(resolve, 900))
      observed.push({ method: request.method(), url: url.href })
      if (mode === 'error' && request.method() === 'GET')
        return route.fulfill({
          status: 503,
          json: { message: 'Test monitor unavailable' },
        })
      if (mode === 'delayed' && path.includes('/p1/'))
        await new Promise((resolve) => setTimeout(resolve, 900))
      if (path.endsWith('/monitors') && request.method() === 'GET')
        return send(path.includes('/p2/') ? [] : rows)
      if (path.endsWith('/monitors') && request.method() === 'POST') {
        const created = {
          ...monitor,
          ...request.postDataJSON(),
          id: 'created',
          status: 'UNKNOWN',
        }
        rows.push(created)
        return send(created)
      }
      const id = path.split('/monitors/')[1].split('/')[0]
      if (id === 'missing')
        return route.fulfill({
          status: 404,
          json: { message: 'Monitor not found' },
        })
      const item = path.includes('/p3/')
        ? {
            ...monitor,
            id: 'x3',
            projectId: 'p3',
            organizationId: 'o2',
            name: 'Other team API',
          }
        : (rows.find((row) => row.id === id) ?? monitor)
      if (path.endsWith('/insights')) {
        const data = structuredClone(insights)
        data.monitorId = item.id
        data.range = url.searchParams.get('range')
        data.tz = url.searchParams.get('tz')
        data.latest.status = item.enabled ? item.status : 'PAUSED'
        if (mode === 'truncated') {
          data.history.status = data.history.alertsStatus = 'TRUNCATED'
          Object.keys(data.metrics).forEach((key) => {
            data.metrics[key] = null
          })
          data.timeline.points.forEach((p) => {
            Object.keys(p).forEach((key) => {
              if (!['time', 'durationSeconds'].includes(key)) p[key] = null
            })
          })
        }
        return send(data)
      }
      if (path.endsWith('/pause')) {
        item.enabled = false
        item.status = 'PAUSED'
        return send(item)
      }
      if (path.endsWith('/resume')) {
        item.enabled = true
        item.status = 'UNKNOWN'
        return send(item)
      }
      if (path.endsWith('/check')) {
        item.status = 'UP'
        item.lastError = null
        return send(insights.checks[0])
      }
      if (request.method() === 'PATCH') {
        assert.deepEqual(Object.keys(request.postDataJSON()), ['name'])
        Object.assign(item, request.postDataJSON())
        return send(item)
      }
      if (request.method() === 'DELETE') {
        rows = rows.filter((row) => row.id !== id)
        return send(item)
      }
      return send(item)
    })
    const overflow = async () =>
      page.evaluate(() => {
        const content = document.querySelector('.layout__content-body')
        return {
          page: document.documentElement.scrollWidth > innerWidth + 1,
          content: content.scrollWidth > content.clientWidth + 1,
        }
      })
    // 云监控 → 概览：状态统计与带筛选的跳转
    await page.goto(`${origin}/monitor/overview`)
    await page.locator('.monitor-overview__cell').first().waitFor({ timeout: 60000 })
    assert.deepEqual(
      (await page.locator('.monitor-overview__cell').allInnerTexts()).map((text) =>
        text.replace(/\s+/g, ' ').trim(),
      ),
      ['全部 16', '正常 3', '故障 1', '降级 4', '已暂停 4', '未检查 4'],
    )
    // 概览只保留核心指标与数据概览
    await page.locator('.monitor-overview .kpi').first().waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.monitor-overview .kpi').count(), 6)
    assert.equal(await page.locator('.monitor-overview .metric-card').count(), 4)
    await page.screenshot({
      path: `${output}/${viewport.width}-overview.png`,
      fullPage: true,
    })
    await page.locator('.monitor-overview__cell').nth(2).click()
    await page.waitForURL(/\/monitor\?status=DOWN/)
    await page.locator('.monitor-row').first().waitFor()
    assert.equal(await page.locator('.monitor-row').count(), 1)

    await page.goto(`${origin}/monitor`)
    await page.locator('.monitor-row').first().waitFor({ timeout: 60000 })
    await page.screenshot({
      path: `${output}/${viewport.width}-list.png`,
      fullPage: true,
    })
    assert.equal(await page.locator('.monitor-row').count(), 10)
    assert.deepEqual(await overflow(), { page: false, content: false })
    await page.locator('.t-pagination').getByText('2', { exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.monitor-row').length === 6)
    assert.equal(new URL(page.url()).searchParams.get('page'), '2')
    await page.locator('.t-pagination').getByText('1', { exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.monitor-row').length === 10)
    await page.getByRole('button', { name: '新建监控项', exact: true }).click()
    const creator = page.locator('.t-dialog').filter({ hasText: '新建监控项' })
    await creator.locator('input').first().fill('Browser added HTTP')
    await creator.locator('input').nth(2).fill('https://browser.test/health')
    await creator.getByRole('button', { name: '确定', exact: true }).click()
    await creator.waitFor({ state: 'hidden' })
    await page.getByPlaceholder('搜索名称或检查目标').fill('Browser added')
    await page.getByRole('link', { name: 'Browser added HTTP' }).waitFor()
    await page.locator('.monitor-row').getByRole('button', { name: '删除', exact: true }).click()
    await page.getByRole('button', { name: '确定', exact: true }).click()
    await page.getByText('没有符合条件的监控项', { exact: true }).waitFor()
    await page.getByPlaceholder('搜索名称或检查目标').fill('Production')
    await page.getByRole('link', { name: 'Production API', exact: true }).waitFor()
    assert.equal(await page.locator('.monitor-row').count(), 1)
    await page.getByRole('link', { name: 'Production API', exact: true }).click()
    await page.locator('.monitor-detail__status').waitFor()
    await page.locator('canvas').first().waitFor({ state: 'visible' })
    await page.waitForTimeout(300)
    await page.screenshot({
      path: `${output}/${viewport.width}-detail.png`,
      fullPage: true,
    })
    assert.match(page.url(), /monitor\/p1\/m1/)
    const canvases = await page.locator('canvas').evaluateAll((elements) =>
      elements.map((canvas) => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        let painted = 0
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) painted++
        return { width: canvas.width, height: canvas.height, painted }
      }),
    )
    assert.equal(canvases.length, 2)
    assert.ok(canvases.every((c) => c.width > 0 && c.height > 0 && c.painted > 0))
    assert.deepEqual(await overflow(), { page: false, content: false })
    for (const [part, fraction] of [
      ['middle', 0.5],
      ['bottom', 1],
    ]) {
      await page.locator('.layout__content-body').evaluate((element, value) => {
        element.scrollTop = (element.scrollHeight - element.clientHeight) * value
      }, fraction)
      await page.screenshot({
        path: `${output}/${viewport.width}-detail-${part}.png`,
        fullPage: true,
      })
    }
    await page.locator('.layout__content-body').evaluate((element) => {
      element.scrollTop = 0
    })
    await page.getByText('近 7 天', { exact: true }).click()
    await page.waitForTimeout(250)
    assert.ok(observed.some((r) => r.url.includes('range=7d')))
    await page.locator('[aria-label="时区"]').click()
    await page.getByText('America/New_York', { exact: true }).last().click()
    await page.waitForTimeout(250)
    assert.ok(observed.some((r) => new URL(r.url).searchParams.get('tz') === 'America/New_York'))
    await page.locator('.t-tabs__nav-item').filter({ hasText: '检查记录' }).click()
    assert.equal(await page.locator('.monitor-detail__checks tbody tr').count(), 10)
    await page.locator('.t-tabs__nav-item').filter({ hasText: '最近事件' }).click()
    assert.equal(await page.locator('.monitor-event').count(), 2)
    await page.locator('.t-tabs__nav-item').filter({ hasText: '基本信息' }).click()
    assert.ok((await page.locator('.monitor-detail').innerText()).includes('Example CA'))
    assert.ok(!(await page.locator('.monitor-detail').innerText()).includes('999'))
    await page.screenshot({
      path: `${output}/${viewport.width}-configuration.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: '暂停', exact: true }).click()
    await page.waitForTimeout(250)
    assert.ok((await page.locator('.monitor-detail__status').innerText()).includes('暂停'))
    assert.equal(
      await page.getByRole('button', { name: '立即检查', exact: true }).isDisabled(),
      true,
    )
    await page.getByRole('button', { name: '恢复', exact: true }).click()
    await page.waitForTimeout(250)
    await page.getByRole('button', { name: '立即检查', exact: true }).click()
    await page.waitForTimeout(250)
    assert.ok((await page.locator('.monitor-detail__status').innerText()).includes('正常'))
    await page.getByRole('button', { name: '编辑监控项', exact: true }).click()
    const editor = page.locator('.t-dialog').filter({ hasText: '编辑监控项' })
    await editor.waitFor({ state: 'visible' })
    await editor.locator('input').first().fill('Production API updated')
    await page.screenshot({
      path: `${output}/${viewport.width}-editor.png`,
      fullPage: true,
    })
    await editor.getByRole('button', { name: '确定', exact: true }).click()
    await page.getByRole('heading', { name: 'Production API updated' }).waitFor()
    mode = 'truncated'
    await page.getByText('近 30 天', { exact: true }).click()
    await page.locator('.t-alert--warning').first().waitFor()
    assert.equal(await page.locator('canvas').count(), 0)
    await page.screenshot({
      path: `${output}/${viewport.width}-truncated.png`,
      fullPage: true,
    })
    mode = 'error'
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    await page.locator('.t-alert--error').first().waitFor()
    mode = 'normal'
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await page.locator('.monitor-detail__status').waitFor()
    await page.getByRole('button', { name: '返回', exact: true }).click()
    await page.getByPlaceholder('搜索名称或检查目标').waitFor()
    assert.equal(await page.getByPlaceholder('搜索名称或检查目标').inputValue(), 'Production')
    // Delayed responses from the old project cannot repopulate the new project.
    mode = 'delayed'
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    await page.locator('.app-header__project').click()
    await page.locator('.project-list__item').filter({ hasText: 'Empty' }).click()
    await page.waitForTimeout(1200)
    assert.equal(await page.locator('.monitor-row').count(), 0)
    await page.screenshot({
      path: `${output}/${viewport.width}-empty.png`,
      fullPage: true,
    })
    mode = 'normal'
    await page.locator('.app-header__project').click()
    await page.locator('.project-list__item').filter({ hasText: 'Production' }).click()
    await page.locator('.monitor-row').first().waitFor()
    await page.getByRole('link', { name: 'Production API updated', exact: true }).click()
    await page.locator('.monitor-detail__status').waitFor()
    await page.locator('.app-header__project').click()
    await page.locator('.project-list__item').filter({ hasText: 'Empty' }).click()
    await page.waitForURL(/\/monitor\?/)
    assert.equal(await page.locator('.monitor-detail__status').count(), 0)
    // Direct detail links select their project, and viewer cannot see mutating actions.
    role = 'VIEWER'
    await page.goto(`${origin}/monitor/p1/m1`)
    await page.locator('.monitor-detail__status').waitFor()
    await page.waitForTimeout(150)
    assert.equal(await page.getByRole('button', { name: '编辑监控项', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: '立即检查', exact: true }).count(), 0)
    assert.equal(await page.locator('.secondary-nav a[href*=":"]').count(), 0)
    mode = 'startup-race'
    await page.goto(`${origin}/monitor/p3/x3`)
    await page.getByRole('heading', { name: 'Other team API' }).waitFor()
    assert.ok((await page.locator('.app-header__team').innerText()).includes('Other Team'))
    assert.ok((await page.locator('.app-header__project').innerText()).includes('Other project'))
    await page.waitForTimeout(1200)
    assert.ok((await page.locator('.app-header__project').innerText()).includes('Other project'))
    assert.match(page.url(), /\/monitor\/p3\/x3/)
    assert.equal(delayedStartup, true)
    mode = 'resolve-race'
    await page.goto(`${origin}/monitor/p3/x3`)
    await page.locator('.app-header__project').click()
    await page.locator('.project-list__item').filter({ hasText: 'Empty' }).click()
    await page.waitForTimeout(1200)
    assert.ok((await page.locator('.app-header__project').innerText()).includes('Empty'))
    assert.ok(!page.url().includes('/p3/x3'))
    mode = 'normal'
    await page.goto(`${origin}/monitor/p1/missing`)
    await page.getByRole('button', { name: '重试', exact: true }).waitFor()
    assert.equal(await page.locator('.monitor-detail__status').count(), 0)
    assert.equal(await page.locator('.monitor-detail .t-loading').count(), 0)
    await page.goto(`${origin}/monitor?type=TCP`)
    await page.locator('.monitor-row').first().waitFor()
    assert.equal(await page.locator('.monitor-page__filters input').nth(2).inputValue(), 'TCP')
    await page.locator('.app-header__project').click()
    await page.locator('.project-list__item').filter({ hasText: 'Empty' }).click()
    await page.waitForTimeout(200)
    assert.equal(await page.locator('.monitor-page__filters input').nth(2).inputValue(), 'TCP')
    assert.equal(await page.locator('.monitor-row').count(), 0)
    assert.deepEqual(errors, [])
    results.push({
      viewport,
      canvases,
      requests: observed.length,
      errors,
      overflow: await overflow(),
    })
    await context.close()
  }
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
