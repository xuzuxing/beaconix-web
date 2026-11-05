import { test, expect, type Page } from '@playwright/test'
import { mockWorkspace } from './fixture'

async function expectFieldsOnSameRow(page: Page, selector: string) {
  const fields = await page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width }
    }),
  )
  expect(fields.length).toBeGreaterThanOrEqual(2)
  expect(Math.abs(fields[0]!.y - fields[1]!.y)).toBeLessThan(2)
  expect(fields[1]!.x).toBeGreaterThan(fields[0]!.x + fields[0]!.width - 1)
}

const now = '2026-11-04T01:00:00.000Z'
const app = {
  id: 'app1',
  organizationId: 'o1',
  projectId: 'b',
  name: 'Portal RUM',
  platform: 'WEB',
  publicKey: 'rum_public',
  enabled: true,
  createdById: 'u1',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
const error = {
  id: 'error1',
  type: 'error',
  category: 'JAVASCRIPT',
  level: 'ERROR',
  status: 'UNRESOLVED',
  ignoredUntil: null,
  message: 'Example failure',
  stack: 'raw stack',
  resolvedStack: 'mapped stack',
  page: '/home',
  release: 'v1',
  replaySessionId: 'sessionkey1',
  sourceMapApplied: true,
  count: 3,
  firstSeenAt: now,
  lastSeenAt: now,
}
const replay = {
  id: 'replay1',
  sessionKey: 'sessionkey1',
  release: 'v1',
  page: '/home',
  startedAt: now,
  lastSeenAt: now,
  chunkCount: 1,
  eventCount: 2,
  sizeBytes: 500,
}
const pg = (items: unknown[]) => ({ items, total: items.length, page: 1, limit: 20 })

test('RUM app tabs, error details, events, safe replay, source maps and alerts', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const state = await mockWorkspace(page, { owner: true, projectId: 'b' })
  const calls: { method: string; path: string; body: string | null }[] = []
  let maps: unknown[] = []
  let rules: unknown[] = []
  await page.route('**/api/settings/public', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) }),
  )
  await page.route('**/api/organizations/o1/notification-channels', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
  await page.route(/\/api\/projects\/[^/]+\/rum\/overview(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          appCount: 1,
          errorGroups: 4,
          events7d: 7,
          replays: 1,
          openAlerts: 0,
          apps: [{ id: 'app1', name: 'Portal RUM', enabled: true, errorGroups: 4, events7d: 7 }],
        },
        meta: { timestamp: now },
      }),
    }),
  )
  await page.route(/\/api\/projects\/[^/]+\/apps(?:\/.*)?(?:\?.*)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    calls.push({ method, path, body: request.postData() })
    let data: unknown
    if (path.endsWith('/apps')) data = [app]
    else if (path.endsWith('/apps/app1/overview'))
      data = {
        from: now,
        to: now,
        bucketMinutes: 60,
        traffic: { pv: 120, uv: 48, clicks: 260 },
        requests: {
          total: 300,
          success: 288,
          failures: 12,
          successRate: 96,
          errorRate: 4,
          p75: 320,
          average: 210,
        },
        errors: { js: 6, custom: 2, total: 8, events: 9, jsRate: 5 },
        series: [
          {
            bucketStart: now,
            pv: 60,
            uv: 25,
            clicks: 130,
            requests: 150,
            failures: 6,
            jsErrors: 3,
            customErrors: 1,
            events: 5,
          },
          {
            bucketStart: now,
            pv: 60,
            uv: 23,
            clicks: 130,
            requests: 150,
            failures: 6,
            jsErrors: 3,
            customErrors: 1,
            events: 4,
          },
        ],
      }
    else if (path.endsWith('/apps/app1')) data = app
    else if (path.endsWith('/errors/error1')) data = error
    else if (path.endsWith('/errors')) data = pg([error])
    else if (path.endsWith('/events/stats'))
      data = {
        days: 7,
        eventName: null,
        total: 1,
        uniqueActors: 1,
        uniqueSessions: 1,
        daily: [{ day: '2026-11-04', count: 1 }],
        topEvents: [{ eventName: 'checkout', count: 1 }],
      }
    else if (path.endsWith('/events'))
      data = pg([
        {
          id: 'ev1',
          eventName: 'checkout',
          endUserId: 'u1',
          anonymousId: null,
          sessionId: 'sessionkey1',
          release: 'v1',
          page: '/home',
          properties: { plan: 'pro' },
          occurredAt: now,
          receivedAt: now,
        },
      ])
    else if (path.endsWith('/replays/replay1/chunks'))
      data =
        url.searchParams.get('afterSequence') === '-1'
          ? {
              items: [
                {
                  id: 'c1',
                  sequence: 0,
                  events: [
                    {
                      type: 'snapshot',
                      at: now,
                      data: {
                        html: '<main><h1>Safe Snapshot</h1><script>window.top.__xss=1</script><img src="https://evil.invalid/track"></main>',
                      },
                    },
                    { type: 'click', at: '2026-11-04T01:00:01.000Z', data: { x: 2, y: 4 } },
                  ],
                  eventCount: 2,
                  sizeBytes: 500,
                  occurredAt: now,
                },
              ],
              nextSequence: 0,
            }
          : { items: [], nextSequence: null }
    else if (path.endsWith('/replays/replay1')) data = replay
    else if (path.endsWith('/replays')) data = pg([replay])
    else if (path.endsWith('/source-maps')) {
      if (method === 'POST') {
        const item = {
          id: 'map1',
          appId: 'app1',
          release: 'v1',
          artifactPath: '/assets/app.js',
          checksum: 'abc123456789',
          sizeBytes: 14,
          uploadedById: 'u1',
          createdAt: now,
          updatedAt: now,
        }
        maps = [item]
        data = { ...item, reprocessed: 2 }
      } else data = maps
    } else if (path.endsWith('/alerts/channels'))
      data = [{ id: 'ch1', name: 'Operations', enabled: true }]
    else if (path.endsWith('/alerts/incidents')) data = pg([])
    else if (path.endsWith('/alerts')) {
      if (method === 'POST') {
        const payload = request.postDataJSON()
        const item = { ...payload, id: 'rule1', active: false, lastValue: 0, lastEvaluatedAt: null }
        rules = [item]
        data = item
      } else data = rules
    } else {
      await route.fulfill({ status: 404, body: 'not found' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data, meta: { timestamp: now } }),
    })
  })
  await page.setViewportSize({ width: 1920, height: 1000 })
  await page.goto('/rum')
  await expect(page.locator('.app-card').first()).toBeVisible({ timeout: 25_000 })
  await expect(page.locator('.app-card').getByText('错误分组')).toBeVisible()
  const appNav = page.locator('.secondary-nav')
  await page.getByRole('link', { name: 'Portal RUM' }).click()
  await expect(page).toHaveURL(/\/rum\/b\/app1\/errors$/)
  await expect(
    page.locator('.layout__page-title').getByText('Portal RUM', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.layout__content-header')).toContainText('启用')
  await expect(appNav.locator('.secondary-nav__link--active')).toHaveText('错误')
  await page.locator('.layout__header-back').click()
  await expect(page).toHaveURL(/\/rum$/)
  await page.getByRole('link', { name: 'Portal RUM' }).click()
  await expect(
    page.locator('.layout__page-title').getByText('Portal RUM', { exact: true }),
  ).toBeVisible()
  await expectFieldsOnSameRow(page, '.filters > .rum-filter__field')
  await page
    .locator('.errors-panel')
    .getByRole('button', { name: 'Example failure' })
    .click()
  await expect(page.getByText('mapped stack')).toBeVisible()
  await expect(page.locator('#layout-header-title-addon .t-tag')).toHaveCount(0)
  await expect(page.locator('.layout__page-title')).toHaveText('Example failure')
  await page.locator('.layout__header-back').click()
  await expect(page).toHaveURL(/\/rum\/b\/app1\/errors$/)
  // 概览页：访问 / 请求 / 错误与事件三组指标都有真实来源
  await appNav.getByRole('link', { name: '概览', exact: true }).click()
  await expect(page).toHaveURL(/\/rum\/b\/app1\/overview$/)
  await expect(page.getByText('PV（页面浏览）')).toBeVisible()
  await expect(page.getByText('UV（独立访客）')).toBeVisible()
  await expect(page.getByText('点击量')).toBeVisible()
  await expect(page.getByText('请求量')).toBeVisible()
  await expect(page.getByText('成功率')).toBeVisible()
  await expect(page.getByText('接口报错量')).toBeVisible()
  await expect(page.getByText('接口耗时 p75')).toBeVisible()
  await expect(page.getByText('JS 错误量')).toBeVisible()
  await expect(page.getByText('JS 错误率')).toBeVisible()
  await expect(page.getByText('自定义错误量')).toBeVisible()
  await expect(page.getByText('事件量')).toBeVisible()
  await expect(page.getByText('访问趋势')).toBeVisible()
  await expect(page.getByText('请求趋势')).toBeVisible()
  await expect(page.getByText('错误与事件趋势')).toBeVisible()
  await appNav.getByRole('link', { name: '事件', exact: true }).click()
  await expect(page.getByText('checkout', { exact: true }).first()).toBeVisible()
  await expectFieldsOnSameRow(page, '.filters form > .rum-filter__field')
  await appNav.getByRole('link', { name: '会话回放' }).click()
  await expectFieldsOnSameRow(page, '.filters > .rum-filter__field')
  await page.getByRole('button', { name: 'sessionkey1' }).click()
  await expect(page.getByText('近似回放 / 事件时间轴')).toBeVisible()
  await expect(
    page.frameLocator('iframe[title="Replay snapshot"]').getByText('Safe Snapshot'),
  ).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(calls.filter((c) => c.path.endsWith('/chunks'))).toHaveLength(2)
  await page.locator('.layout__header-back').click()
  await expect(page).toHaveURL(/\/rum\/b\/app1\/replays$/)
  await appNav.getByRole('link', { name: 'Source Map' }).click()
  await expect(page.getByText(/不超过 5 MiB/)).toBeVisible()
  await page.getByPlaceholder('版本').fill('v1')
  await page.getByPlaceholder('产物路径').fill('/assets/app.js')
  await page.locator('.upload input[type=file]').setInputFiles({
    name: 'app.js.map',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":3}'),
  })
  await page.getByRole('button', { name: '上传', exact: true }).click()
  await expect(page.getByText('/assets/app.js', { exact: true })).toBeVisible()
  const upload = calls.find((c) => c.path.endsWith('/source-maps') && c.method === 'POST')
  expect(upload?.body).toContain('name="release"')
  expect(upload?.body).toContain('name="artifactPath"')
  expect(upload?.body).toContain('name="file"')
  await appNav.getByRole('link', { name: '告警', exact: true }).click()
  await expect(page.getByRole('button', { name: '新建规则' })).toBeVisible()
  await page.getByRole('button', { name: '新建规则' }).click()
  await page.getByRole('textbox', { name: '名称' }).fill('Checkout alert')
  await page.locator('.alert-form label').filter({ hasText: '指标' }).locator('.t-select').click()
  await page.getByText('事件次数', { exact: true }).click()
  await page.getByText('指定渠道').click()
  await page.locator('fieldset .t-select').click()
  await page.getByText('Operations', { exact: true }).click()
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('Checkout alert', { exact: true })).toBeVisible()
  const alertCall = calls.find((c) => c.path.endsWith('/alerts') && c.method === 'POST')
  expect(JSON.parse(alertCall?.body || '{}')).toMatchObject({
    name: 'Checkout alert',
    metric: 'EVENT_COUNT',
    eventName: '*',
    channelIds: ['ch1'],
  })
  await appNav.getByRole('link', { name: '接入设置' }).click()
  await expect(page.getByText(/尚未发布 npm 包/)).toBeVisible()
  expect(state.pageErrors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('viewer can read but cannot mutate; unavailable project is rejected', async ({ page }) => {
  test.setTimeout(120_000)
  const state = await mockWorkspace(page, { projectId: 'a' })
  const paths: string[] = []
  await page.route('**/api/settings/public', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) }),
  )
  await page.route(/\/api\/projects\/[^/]+\/(?:apps|rum)(?:\/.*)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url())
    paths.push(url.pathname)
    let data: unknown = []
    if (url.pathname.endsWith('/rum/overview'))
      data = { appCount: 0, errorGroups: 0, events7d: 0, replays: 0, openAlerts: 0, apps: [] }
    else if (url.pathname.endsWith('/apps')) data = [{ ...app, projectId: 'a' }]
    else if (url.pathname.endsWith('/apps/app1')) data = { ...app, projectId: 'a' }
    else if (url.pathname.endsWith('/events/stats'))
      data = { days: 7, total: 0, uniqueActors: 0, uniqueSessions: 0, daily: [], topEvents: [] }
    else if (
      url.pathname.endsWith('/errors') ||
      url.pathname.endsWith('/replays') ||
      url.pathname.endsWith('/alerts/incidents')
    )
      data = pg([])
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) })
  })
  await page.goto('/rum')
  await expect(page.getByRole('link', { name: 'Portal RUM' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('button', { name: '新建应用' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Portal RUM' }).click()
  const appNav = page.locator('.secondary-nav')
  await appNav.getByRole('link', { name: 'Source Map' }).click()
  await expect(page.getByRole('button', { name: '上传' })).toHaveCount(0)
  await appNav.getByRole('link', { name: '告警', exact: true }).click()
  await expect(page.getByRole('button', { name: '新建规则' })).toHaveCount(0)
  await page.goto('/rum/c/app1')
  await expect(page).toHaveURL(/access-unavailable/)
  expect(paths.some((path) => path.includes('/projects/c/'))).toBe(false)
  expect(state.pageErrors).toEqual([])
})

test('RUM deep link adopts its authorized project and switching project returns to the app list', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const state = await mockWorkspace(page, { projectId: 'a' })
  await page.route('**/api/settings/public', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) }),
  )
  await page.route(/\/api\/projects\/[^/]+\/(?:apps|rum)(?:\/.*)?(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url())
    const projectId = url.pathname.split('/')[3]
    const data = url.pathname.endsWith('/rum/overview')
      ? { appCount: 1, errorGroups: 0, events7d: 0, replays: 0, openAlerts: 0, apps: [] }
      : url.pathname.endsWith('/apps')
        ? [{ ...app, projectId }]
        : { ...app, projectId }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) })
  })
  await page.goto('/rum/b/app1?tab=setup')
  await expect(page).toHaveURL(/\/rum\/b\/app1\/setup$/)
  await expect(
    page.locator('.layout__page-title').getByText('Portal RUM', { exact: true }),
  ).toBeVisible({
    timeout: 25_000,
  })
  await expect(page.locator('.app-header__project')).toContainText('Project B')
  await page.locator('.app-header__project').click()
  await page.locator('.project-list__item').filter({ hasText: 'Project A' }).click()
  await expect(page).toHaveURL(/\/rum$/)
  await expect(page.getByRole('link', { name: 'Portal RUM' })).toBeVisible()
  expect(state.pageErrors).toEqual([])
})

test('application header keeps a return path when app loading fails', async ({ page }) => {
  const state = await mockWorkspace(page, { owner: true, projectId: 'b' })
  await page.route('**/api/settings/public', (route) => route.fulfill({ json: { data: {} } }))
  await page.route(/\/api\/projects\/[^/]+\/(?:apps|rum)(?:\/.*)?(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/rum/overview'))
      return route.fulfill({
        json: { data: { appCount: 1, errorGroups: 0, events7d: 0, replays: 0, openAlerts: 0, apps: [] } },
      })
    return url.pathname.endsWith('/apps/app1')
      ? route.fulfill({ status: 500, json: { message: 'Unavailable' } })
      : route.fulfill({ json: { data: [app] } })
  })
  await page.goto('/rum/b/app1')
  await expect(page.locator('.layout__page-title')).toHaveText('应用详情', { timeout: 25_000 })
  await expect(page.locator('.layout__header-back')).toBeVisible()
  await page.locator('.layout__header-back').click()
  await expect(page).toHaveURL(/\/rum$/)
  await expect(page.getByRole('link', { name: 'Portal RUM' })).toBeVisible()
  expect(state.pageErrors).toEqual([])
})
