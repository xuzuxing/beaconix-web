import { test, expect } from '@playwright/test'
import { mockWorkspace } from './fixture'

const now = '2026-11-04T01:00:00.000Z'
const apps = ['Alpha', 'Beta'].map((name, index) => ({
  id: `app${index + 1}`,
  name,
  organizationId: 'o1',
  projectId: 'b',
  platform: 'WEB',
  enabled: true,
  publicKey: `rum_key_${index + 1}`,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}))
const error = {
  id: 'e1',
  appId: 'app2',
  app: { id: 'app2', name: 'Beta' },
  type: 'TypeError',
  category: 'JAVASCRIPT',
  level: 'ERROR',
  status: 'UNRESOLVED',
  ignoredUntil: null,
  message: 'Cross app failure',
  count: 3,
  lastSeenAt: now,
  firstSeenAt: now,
  stack: null,
  resolvedStack: null,
  page: null,
  release: null,
  replaySessionId: null,
  sourceMapApplied: false,
}
const event = {
  id: 'v1',
  appId: 'app1',
  app: { id: 'app1', name: 'Alpha' },
  eventName: 'checkout',
  sessionId: 'session',
  receivedAt: now,
  occurredAt: now,
  properties: { product: 'sample' },
}

test('project menu and project-wide error/event queries use server pagination and filters', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { owner: true, projectId: 'b' })
  const requests: URL[] = []
  await page.route('**/api/settings/public', (route) => route.fulfill({ json: { data: {} } }))
  await page.route(/\/api\/projects\/[^/]+\/(rum|apps)(?:\/.*)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    let data: unknown
    if (url.pathname.endsWith('/rum/overview'))
      data = {
        appCount: 2,
        errorGroups: 1,
        events7d: 1,
        replays: 0,
        openAlerts: 0,
        apps: apps.map((app) => ({
          id: app.id,
          name: app.name,
          enabled: true,
          errorGroups: 1,
          events7d: 1,
        })),
      }
    else if (url.pathname.endsWith('/rum/errors'))
      data = {
        items: [error],
        total: 21,
        page: Number(url.searchParams.get('page') || 1),
        limit: Number(url.searchParams.get('limit') || 20),
      }
    else if (url.pathname.endsWith('/rum/events'))
      data = { items: [event], total: 1, page: 1, limit: 20 }
    else if (url.pathname.endsWith('/apps')) data = apps
    else if (url.pathname.endsWith('/apps/app2/errors/e1')) data = error
    else if (url.pathname.endsWith('/apps/app2')) data = apps[1]
    else data = { items: [], total: 0, page: 1, limit: 20 }
    await route.fulfill({ json: { data } })
  })
  await page.setViewportSize({ width: 1920, height: 1000 })
  await page.goto('/rum')
  // 一级入口直接落地应用卡片列表
  await expect(page.locator('.app-card').first()).toBeVisible({ timeout: 25_000 })
  const primary = page.locator('.side-nav')
  await expect(primary.getByText('云监控', { exact: true })).toBeVisible()
  await expect(primary.getByText('前端监控', { exact: true })).toBeVisible()
  await primary.getByText('前端监控', { exact: true }).click()
  await expect(page).toHaveURL(/\/rum$/)

  // 项目级跨应用查询的入口收在卡片列表页顶部
  const shortcuts = page.locator('.rum-apps__shortcuts')
  for (const name of ['概览', '错误', '事件'])
    await expect(shortcuts.getByRole('link', { name, exact: true })).toBeVisible()
  await shortcuts.getByRole('link', { name: '概览', exact: true }).click()
  await expect(page).toHaveURL(/\/rum\/overview/)

  await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible({
    timeout: 25_000,
  })
  await expect(page.getByText('Alpha', { exact: true })).toBeVisible()
  await expect(page.getByText('Beta', { exact: true })).toBeVisible()
  // 项目级页面之间用页内导航切换，不再占用左侧二级菜单
  const projectNav = page.locator('.rum-project-nav')
  await expect(projectNav.getByRole('link', { name: '概览', exact: true })).toHaveClass(
    /rum-project-nav__link--active/,
  )
  await projectNav.getByRole('link', { name: '错误', exact: true }).click()
  await expect(page).toHaveURL(/\/rum\/errors/)
  await expect(page.getByText('Cross app failure')).toBeVisible()
  const pageWidth = await page
    .locator('.project-page')
    .evaluate((el) => el.getBoundingClientRect().width)
  expect(pageWidth).toBeGreaterThan(1440)
  const desktopFields = await page.locator('.filters > .rum-filter__field').evaluateAll((fields) =>
    fields.map((field) => {
      const box = field.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width }
    }),
  )
  expect(desktopFields).toHaveLength(3)
  expect(Math.abs(desktopFields[0]!.y - desktopFields[1]!.y)).toBeLessThan(2)
  expect(desktopFields[1]!.x).toBeGreaterThan(desktopFields[0]!.x + desktopFields[0]!.width - 1)
  await page.locator('.filters .t-select').click()
  await page.locator('.t-select-option').filter({ hasText: 'Beta' }).click()
  await page.getByPlaceholder('错误类型（精确匹配）').fill('TypeError')
  const dateInputs = page.locator('.filters .t-date-range-picker input')
  await dateInputs.nth(0).fill('2026-11-01 00:00:00')
  await dateInputs.nth(0).press('Enter')
  await dateInputs.nth(1).fill('2026-11-04 23:59:59')
  await dateInputs.nth(1).press('Enter')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect
    .poll(() =>
      requests.some(
        (url) =>
          url.pathname.endsWith('/rum/errors') &&
          url.searchParams.get('type') === 'TypeError' &&
          url.searchParams.get('appId') === 'app2' &&
          !!url.searchParams.get('from') &&
          !!url.searchParams.get('to'),
      ),
    )
    .toBe(true)
  await page.locator('.t-pagination__btn-next').click()
  await expect
    .poll(() =>
      requests.some(
        (url) =>
          url.pathname.endsWith('/rum/errors') &&
          url.searchParams.get('page') === '2' &&
          url.searchParams.get('appId') === 'app2',
      ),
    )
    .toBe(true)
  await page.getByText('Cross app failure').click()
  await expect(page.locator('.layout__page-title')).toHaveText('Cross app failure')
  // 错误详情属于应用工作台，左侧切换成该应用的应用内导航
  const appNav = page.locator('.secondary-nav')
  await expect(appNav.locator('.secondary-nav__link--active')).toHaveText('错误')
  await page.locator('.layout__header-back').click()
  await expect(page).toHaveURL(/\/rum\/errors/)
  await expect(page.getByPlaceholder('错误类型（精确匹配）')).toHaveValue('TypeError')
  await expect(page.locator('.filters .t-select input')).toHaveValue('Beta')
  await expect(page.locator('.filters .t-date-range-picker input').nth(0)).toHaveValue(
    '2026-11-01 00:00:00',
  )
  await projectNav.getByRole('link', { name: '事件', exact: true }).click()
  await expect(page.getByText('checkout', { exact: true })).toBeVisible()
  await page.getByPlaceholder('事件名称（精确匹配）').fill('checkout')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect
    .poll(() =>
      requests.some(
        (url) =>
          url.pathname.endsWith('/rum/events') && url.searchParams.get('eventName') === 'checkout',
      ),
    )
    .toBe(true)
  // 回到应用卡片列表，点卡片进入应用工作台
  await projectNav.getByRole('link', { name: '返回应用列表' }).click()
  await expect(page).toHaveURL(/\/rum$/)
  await expect(page.getByRole('link', { name: 'Alpha' })).toBeVisible()
  await page.getByRole('link', { name: 'Beta' }).click()
  await expect(page).toHaveURL(/\/rum\/b\/app2\/errors$/)
  await expect(appNav.locator('.secondary-nav__link--active')).toHaveText('错误')
  await appNav.getByRole('link', { name: '返回应用列表' }).click()
  await expect(page).toHaveURL(/\/rum$/)
  await page.locator('.rum-apps__shortcuts').getByRole('link', { name: '概览', exact: true }).click()
  await page.locator('.app-header__project').click()
  await page.locator('.project-list__item').filter({ hasText: 'Project A' }).click()
  await expect
    .poll(() => requests.some((url) => url.pathname === '/api/projects/a/rum/overview'))
    .toBe(true)
  await page.goto('/rum/errors')
  await expect(page.locator('.filters')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.rum-project-nav')).toBeVisible()
  await page.locator('.rum-project-nav').getByRole('link', { name: '事件', exact: true }).click()
  await expect(page).toHaveURL(/\/rum\/events/)
  await expect
    .poll(() => page.locator('.filters').evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
    .toBe(true)
  expect(state.pageErrors).toEqual([])
  expect(state.unexpected).toEqual([])
})
