import { test, expect, type Page } from '@playwright/test'
import type { MonitorCapacity } from '../../src/api/types/billing'
import { mockWorkspace } from './fixture'

test.use({ viewport: { width: 1600, height: 1100 } })

async function setup(
  page: Page,
  options: { limited?: boolean; locale?: string; dark?: boolean } = {},
) {
  const workspace = await mockWorkspace(page, {
    owner: true,
    locale: options.locale,
    dark: options.dark,
  })
  workspace.monitorDrafts.b = { enabled: false }
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  let capacity: MonitorCapacity = {
    cycleId: 'cycle-1',
    status: options.limited ? 'LIMITED' : 'GRACE',
    startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    graceEndsAt: deadline,
    total: 4,
    limit: 2,
    excess: 2,
    overLimit: true,
    selectedMonitorIds: [],
    retainedMonitorIds: ['monitor-a', 'monitor-b'],
    restrictedMonitorIds: options.limited ? ['monitor-c'] : [],
    monitorDeadlines: [
      {
        id: 'monitor-c',
        quotaGraceEndsAt: options.limited
          ? '2020-01-01T00:00:00Z'
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        enabled: true,
      },
      { id: 'monitor-d', quotaGraceEndsAt: deadline, enabled: true },
    ],
  }
  const writes: unknown[] = []
  let failSave = false
  let failProject = false
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.slice(4)
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status < 400 ? { data } : data),
      })
    if (path === '/settings/public') return reply({})
    if (path === '/plans') return reply([])
    if (path.endsWith('/quota'))
      return reply({
        plan: { code: 'FREE', name: 'Free', price: 0 },
        resources: Object.fromEntries(
          ['monitors', 'probes', 'members', 'channels', 'apiKeys'].map((key) => [
            key,
            { used: key === 'monitors' ? 4 : 0, limit: 2, percent: key === 'monitors' ? 200 : 0 },
          ]),
        ),
        features: { allowTenantProbe: false, allowStatusPage: false },
        minInterval: 60,
      })
    if (failProject && path === '/projects/d/monitors')
      return reply({ message: 'Project offline' }, 503)
    if (path.endsWith('/subscription/monitor-capacity')) {
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON() as { cycleId: string; monitorIds: string[] }
        writes.push(body)
        if (failSave) {
          capacity = {
            ...capacity,
            cycleId: 'cycle-2',
            limit: 1,
            retainedMonitorIds: ['monitor-a'],
            selectedMonitorIds: [],
            excess: 3,
          }
          return reply({ message: 'The downgrade cycle has changed; refresh capacity' }, 400)
        }
        const all = ['monitor-a', 'monitor-b', 'monitor-c', 'monitor-d']
        const retained = [...new Set([...body.monitorIds, ...all])].slice(0, capacity.limit)
        capacity = {
          ...capacity,
          selectedMonitorIds: body.monitorIds,
          retainedMonitorIds: retained,
          restrictedMonitorIds: [],
        }
      }
      return reply(capacity)
    }
    return route.fallback()
  })
  return {
    workspace,
    writes,
    failSave: () => {
      failSave = true
    },
    failProject: () => {
      failProject = true
    },
    setCapacity: (value: Partial<MonitorCapacity>) => {
      capacity = { ...capacity, ...value }
    },
  }
}

test('admin selects across projects, preserves search-hidden selections, and resets to server defaults', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/billing')
  const card = page.locator('#monitor-capacity')
  await expect(card.getByText('降级宽限期', { exact: true })).toBeVisible()
  await expect(card.locator('tbody tr')).toHaveCount(4)
  await expect(card.getByText('手动暂停', { exact: true })).toBeVisible()
  await card.locator('tbody tr').filter({ hasText: 'Monitor C' }).locator('.t-checkbox').click()
  await card.getByRole('textbox').fill('Monitor D')
  await card.locator('tbody tr').filter({ hasText: 'Monitor D' }).locator('.t-checkbox').click()
  await expect(card.getByText('已优先选择 2 / 2')).toBeVisible()
  await card.getByRole('textbox').fill('')
  await expect(
    card.getByRole('checkbox', { name: '优先保留 Monitor A', exact: true }),
  ).toBeDisabled()
  await card.getByRole('button', { name: '保存优先名单' }).click()
  await page
    .locator('.t-popconfirm__buttons')
    .getByRole('button', { name: '确定', exact: true })
    .click()
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0]).toEqual({ cycleId: 'cycle-1', monitorIds: ['monitor-c', 'monitor-d'] })
  await expect(card.getByRole('button', { name: '保存优先名单' })).toBeDisabled()
  await card.getByRole('button', { name: '使用默认顺序' }).click()
  await page
    .locator('.t-popconfirm__buttons')
    .getByRole('button', { name: '确定', exact: true })
    .click()
  await expect.poll(() => state.writes.length).toBe(2)
  expect(state.writes[1]).toEqual({ cycleId: 'cycle-1', monitorIds: [] })
  expect(state.workspace.unexpected).toEqual([])
  expect(state.workspace.pageErrors).toEqual([])
})

test('limited state shows separate batches and preserves manual pause in dark English UI', async ({
  page,
}) => {
  const state = await setup(page, { limited: true, locale: 'en-US', dark: true })
  await page.goto('/billing')
  const card = page.locator('#monitor-capacity')
  await expect(card.getByText('Capacity restriction active', { exact: true })).toBeVisible()
  await expect(card.getByText('Observation stopped', { exact: true })).toHaveCount(1)
  await expect(card.getByText('In grace period', { exact: true })).toHaveCount(1)
  await expect(card.getByText('Manually paused', { exact: true })).toBeVisible()
  await expect(card.locator('tbody tr').filter({ hasText: 'Monitor C' })).toContainText('2020')
  await expect(card.locator('tbody tr').filter({ hasText: 'Monitor D' })).toContainText(
    /\([A-Za-z_/]+\)/,
  )
  await card.screenshot({ path: test.info().outputPath('limited-dark-en.png') })
  expect(state.workspace.pageErrors).toEqual([])
})

test('outdated cycle errors refresh the selection and do not automatically retry PATCH', async ({
  page,
}) => {
  const state = await setup(page)
  state.failSave()
  await page.goto('/billing')
  const card = page.locator('#monitor-capacity')
  await card.locator('tbody tr').filter({ hasText: 'Monitor C' }).locator('.t-checkbox').click()
  await card.getByRole('button', { name: '保存优先名单' }).click()
  await page
    .locator('.t-popconfirm__buttons')
    .getByRole('button', { name: '确定', exact: true })
    .click()
  await expect(card.getByText(/保存未完成/)).toBeVisible()
  await expect(card.getByText('已优先选择 0 / 1')).toBeVisible()
  expect(state.writes).toHaveLength(1)
})

test('incomplete monitor lists cannot be saved', async ({ page }) => {
  const state = await setup(page)
  state.failProject()
  await page.goto('/billing')
  const card = page.locator('#monitor-capacity')
  await expect(card.getByText(/部分项目监控加载失败/)).toBeVisible()
  await expect(card.getByRole('button', { name: '保存优先名单' })).toBeDisabled()
  expect(state.writes).toEqual([])
})

test('email root link opens the authorized organization capacity page', async ({ page }) => {
  await setup(page)
  await page.goto('/?organizationId=o2')
  await expect(page).toHaveURL(/\/billing\?organizationId=o2#monitor-capacity$/)
  await expect(page.locator('#monitor-capacity')).toBeVisible()
})

test('project admins without organization authority cannot read or write capacity', async ({
  page,
}) => {
  const state = await mockWorkspace(page)
  await page.goto('/billing')
  await expect(page).toHaveURL(/access-unavailable/)
  expect(state.requests.some((request) => request.path.includes('/monitor-capacity'))).toBe(false)
})

test('renewal refresh clears the old cycle and preserves manual pause', async ({ page }) => {
  const state = await setup(page, { limited: true })
  await page.goto('/billing')
  const card = page.locator('#monitor-capacity')
  await expect(card.locator('tbody tr')).toHaveCount(4)
  state.setCapacity({
    cycleId: null,
    status: 'WITHIN_LIMIT',
    limit: 20,
    excess: 0,
    overLimit: false,
    startsAt: null,
    graceEndsAt: null,
    selectedMonitorIds: [],
    retainedMonitorIds: [],
    restrictedMonitorIds: [],
    monitorDeadlines: [],
  })
  await card.getByRole('button', { name: '刷新状态' }).click()
  await expect(card.getByText('无降级限制', { exact: true })).toBeVisible()
  await expect(card.locator('table')).toHaveCount(0)
  expect(state.workspace.monitorDrafts.b?.enabled).toBe(false)
  expect(state.writes).toEqual([])
})

test('zero slots disables priority selection while keeping configuration visible', async ({
  page,
}) => {
  const state = await setup(page)
  state.setCapacity({ limit: 0, excess: 4, retainedMonitorIds: [] })
  await page.goto('/billing')
  const card = page.locator('#monitor-capacity')
  await expect(card.locator('tbody tr')).toHaveCount(4)
  for (const checkbox of await card.getByRole('checkbox').all())
    await expect(checkbox).toBeDisabled()
  expect(state.writes).toEqual([])
})

test('open monitor list masks historical UP and disables manual checks at the deadline', async ({
  page,
}) => {
  const state = await setup(page)
  await page.clock.install()
  state.workspace.monitorDrafts.a = {
    quotaGraceEndsAt: new Date(Date.now() + 30_000).toISOString(),
  }
  await page.goto('/monitor')
  const row = page.locator('.monitor-row').filter({ hasText: 'Monitor A' })
  await expect(row).toContainText('正常')
  await page.clock.fastForward(35_000)
  await expect(row).toContainText('已停止观测')
  await expect(row.getByRole('button', { name: '立即检查', exact: true })).toBeDisabled()
  await expect(row.locator('.t-tag')).not.toContainText('正常')
})
