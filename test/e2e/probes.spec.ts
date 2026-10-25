import { expect, test, type Page } from '@playwright/test'
import { mockWorkspace } from './fixture'
import { tenantProbe } from '../fixtures/probes'

async function setup(page: Page, options: Parameters<typeof mockWorkspace>[1] = { owner: true }) {
  const workspace = await mockWorkspace(page, options)
  const state = {
    workspace,
    nodes: [
      tenantProbe(),
      {
        ...tenantProbe('probe-2'),
        name: 'Offline Singapore node',
        provider: 'ALIYUN' as const,
        status: 'OFFLINE' as const,
        region: 'ap-singapore',
      },
    ],
    queries: [] as Record<string, string>[],
    fail: false,
    secret: 'tnt_fixture_once_private',
    enrollmentExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  }
  await page.route('**/api/organizations/*/probes**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.slice(4)
    const method = request.method()
    const body = request.postData() ? request.postDataJSON() : undefined
    workspace.requests.push({ method, path, body, headers: request.headers() })
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status < 400 ? { data, meta: { timestamp: '2026-10-13' } } : data),
      })
    if (!['OWNER', 'ADMIN'].includes(workspace.organizationRole))
      return reply({ message: 'Denied' }, 403)
    if (state.fail) return reply({ message: 'Fixture probes offline' }, 503)
    if (path.endsWith('/enroll-token'))
      return reply({
        token: 'bet_fixture_once',
        command:
          'curl -fsSL https://download.example.invalid/install.sh | sudo sh -s -- --token=bet_fixture_once --api-url=https://api.example.invalid/api',
        expiresAt: state.enrollmentExpiresAt,
        apiUrl: 'https://api.example.invalid/api',
      })
    if (path.endsWith('/probes')) {
      if (method === 'POST') {
        const created = {
          ...tenantProbe('new-probe'),
          ...body,
          secret: state.secret,
        }
        state.nodes.unshift(created)
        return reply(created)
      }
      return reply(
        state.nodes.map((node) => ({
          ...node,
          secret: 'should-not-display-read-secret',
        })),
      )
    }
    const id = path.split('/')[4]
    const node = state.nodes.find((n) => n.id === id)
    if (!node) return reply({ message: 'Probe not found' }, 404)
    if (path.endsWith('/rotate-secret'))
      return reply({ ...node, secret: 'tnt_fixture_rotated_private' })
    if (path.endsWith('/validate'))
      return reply({
        validationId: node.id,
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        status: 'PENDING',
      })
    if (path.endsWith('/results') || path.endsWith('/executions')) {
      state.queries.push(Object.fromEntries(url.searchParams))
      const current = Number(url.searchParams.get('page') ?? '1')
      const limit = Number(url.searchParams.get('limit') ?? '20')
      const execution = path.endsWith('/executions')
      const rows = Array.from({ length: 45 }, (_, index) => ({
        id: `${execution ? 'execution' : 'result'}-${index}`,
        probeId: id,
        monitorId: 'monitor-a',
        target: 'https://result.example.invalid/health',
        success: index % 2 === 0,
        latency: index + 20,
        error: index % 2 === 0 ? null : 'ECONNREFUSED',
        checkedAt: '2026-10-13T08:00:00Z',
        executedAt: '2026-10-13T08:00:00Z',
        trigger: url.searchParams.get('trigger') ?? 'CALLBACK',
        status: url.searchParams.get('status') ?? 'SUCCESS',
        requestMeta: { count: 1 },
        responseMeta: { applied: 1 },
      }))
      return reply({
        data: rows.slice((current - 1) * limit, current * limit),
        meta: {
          total: rows.length,
          page: current,
          limit,
          totalPages: Math.ceil(rows.length / limit),
        },
      })
    }
    if (path.endsWith('/monitors') && method === 'POST') {
      node.monitors.push(
        ...body.monitorIds.map((monitorId: string) => ({
          id: monitorId,
          name: `Bound ${monitorId}`,
          type: 'HTTP',
          target: 'https://bound.example.invalid',
          enabled: true,
        })),
      )
      return reply(node)
    }
    if (path.includes('/monitors/') && method === 'DELETE') {
      node.monitors = node.monitors.filter((monitor) => monitor.id !== path.split('/').at(-1))
      return reply(node)
    }
    if (method === 'PATCH') {
      Object.assign(node, body)
      return reply(node)
    }
    if (method === 'DELETE') {
      state.nodes = state.nodes.filter((item) => item.id !== id)
      return reply({ id, deleted: true })
    }
    return reply(node)
  })
  return state
}
async function healthy(state: Awaited<ReturnType<typeof setup>>) {
  expect(state.workspace.unexpected).toEqual([])
  expect(state.workspace.pageErrors).toEqual([])
  expect(state.workspace.consoleErrors).toEqual([])
}
test('organization probe list and overview render real fixture counts; filters survive reload', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/probes')
  await expect(page.locator('.probe-row')).toHaveCount(2)
  await expect(page.locator('body')).not.toContainText('should-not-display-read-secret')
  await page.getByRole('textbox', { name: '搜索名称、区域、回调地址或探针 ID' }).fill('Singapore')
  await expect(page.locator('.probe-row')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.probe-row')).toHaveCount(1)
  await page.goto('/probes/overview')
  await expect(page.locator('.probe-overview__stats')).toContainText('节点总数')
  await expect(page.locator('.probe-overview__recent')).toHaveCount(2)
  await page.locator('.probe-overview__stats .is-offline').click()
  await expect(page.locator('.probe-row')).toHaveCount(1)
  await expect(page.locator('.probe-row')).toContainText('Singapore')
  await healthy(state)
})
for (const path of ['/probes', '/probes/overview']) {
  test(`project ADMIN cannot access organization probe workflow ${path}`, async ({ page }) => {
    const state = await setup(page, { projectId: 'b' })
    await page.goto(path)
    await expect(page).toHaveURL(/access-unavailable/)
    expect(state.workspace.requests.filter((request) => request.path.includes('/probes'))).toEqual(
      [],
    )
    await healthy(state)
  })
}
test('manual registration validates fields and displays a secret once without persisting it', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/probes')
  await page.getByRole('button', { name: '添加探针', exact: true }).click()
  const dialog = page.locator('.t-dialog:visible')
  await dialog.getByText('手动注册', { exact: true }).click()
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(dialog).toContainText('请填写名称和区域')
  await dialog.getByRole('textbox', { name: '名称', exact: true }).fill('Registered node')
  await dialog.getByRole('textbox', { name: '区域', exact: true }).fill('cn-shanghai')
  await dialog.getByRole('textbox', { name: '回调地址', exact: true }).fill('javascript:invalid')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(dialog).toContainText('有效的 HTTP/HTTPS')
  await dialog
    .getByRole('textbox', { name: '回调地址', exact: true })
    .fill('https://probe.example.invalid/callback')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.locator('.probe-credential')).toContainText(state.secret)
  expect(
    state.workspace.requests.find((r) => r.method === 'POST' && r.path.endsWith('/probes'))?.body,
  ).toEqual({
    name: 'Registered node',
    region: 'cn-shanghai',
    provider: 'CUSTOM',
    callbackUrl: 'https://probe.example.invalid/callback',
    enabled: true,
  })
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(state.secret)
  await page.keyboard.press('Escape')
  await expect(page.locator('body')).not.toContainText(state.secret)
  await expect(page.locator('.probe-row')).toHaveCount(3)
  await healthy(state)
})
test('install enrollment returns the backend command without prematurely creating a probe', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/probes')
  await page.getByRole('button', { name: '添加探针', exact: true }).click()
  const dialog = page.locator('.t-dialog:visible')
  await dialog.getByRole('textbox', { name: '名称', exact: true }).fill('Install node')
  await dialog.getByRole('textbox', { name: '区域', exact: true }).fill('shanghai')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.locator('.probe-credential')).toContainText('bet_fixture_once')
  expect(state.workspace.requests.find((r) => r.path.endsWith('/enroll-token'))?.body).toEqual({
    name: 'Install node',
    region: 'shanghai',
    provider: 'CUSTOM',
  })
  expect(
    state.workspace.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/probes')),
  ).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.locator('body')).not.toContainText('bet_fixture_once')
  await healthy(state)
})
test('edit, toggle, validate, rotate and delete use the correct contracts and confirmations', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/probes')
  let row = page.locator('.probe-row').filter({ hasText: 'Probe probe-1' })
  await row.getByRole('button', { name: '编辑探针' }).click()
  let dialog = page.locator('.t-dialog:visible')
  await dialog.getByRole('textbox', { name: '名称', exact: true }).fill('Edited node')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  row = page.locator('.probe-row').filter({ hasText: 'Edited node' })
  await expect(row).toBeVisible()
  await row.locator('.t-switch').click()
  await expect(row).toContainText('已停用')
  await row.locator('.t-switch').click()
  await expect(row).toContainText('在线')
  await row.getByRole('button', { name: '连通校验' }).click()
  await expect(page.locator('.t-dialog:visible')).toContainText('PENDING')
  await expect(page.locator('.t-dialog:visible')).not.toContainText('校验通过')
  await page.keyboard.press('Escape')
  await row.getByRole('button', { name: '轮换密钥' }).click()
  expect(state.workspace.requests.filter((r) => r.path.endsWith('/rotate-secret'))).toEqual([])
  dialog = page.locator('.t-dialog:visible')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.locator('.probe-credential')).toContainText('tnt_fixture_rotated_private')
  await page.keyboard.press('Escape')
  await expect(page.locator('body')).not.toContainText('tnt_fixture_rotated_private')
  await row.getByRole('button', { name: '删除探针' }).click()
  expect(state.workspace.requests.filter((r) => r.method === 'DELETE')).toEqual([])
  await page.locator('.t-dialog:visible').getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.locator('.probe-row')).toHaveCount(1)
  await healthy(state)
})
test('detail supports additive binding, unbinding, results and execution filtering with pagination', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/probes')
  await page.getByRole('button', { name: '探针详情', exact: true }).first().click()
  const drawer = page.locator('.t-drawer--open')
  await expect(drawer).toContainText('尚未绑定监控项')
  await drawer.getByRole('button', { name: '绑定监控', exact: true }).click()
  await drawer.locator('.probe-detail__binding .t-select').click()
  await page.locator('.t-select-option').filter({ hasText: 'Project A · Monitor A' }).click()
  await drawer.getByRole('heading').click()
  await drawer
    .locator('.probe-detail__binding')
    .getByRole('button', { name: '绑定监控', exact: true })
    .click()
  await expect(drawer.locator('.probe-detail__monitor')).toHaveCount(1)
  expect(
    state.workspace.requests.find((r) => r.method === 'POST' && r.path.endsWith('/monitors'))?.body,
  ).toEqual({ monitorIds: ['monitor-a'] })
  await drawer.getByRole('button', { name: '解绑', exact: true }).click()
  await page.locator('.t-dialog:visible').getByRole('button', { name: '确定', exact: true }).click()
  await expect(drawer).toContainText('尚未绑定监控项')
  await drawer.getByText('检查结果', { exact: true }).click()
  await expect(drawer.locator('.probe-history__row')).toHaveCount(20)
  await drawer.locator('.t-pagination__number').filter({ hasText: /^2$/ }).click()
  await expect.poll(() => state.queries.at(-1)?.page).toBe('2')
  await drawer.getByText('执行日志', { exact: true }).click()
  await expect(drawer.locator('.probe-history__row')).toHaveCount(20)
  await drawer.locator('.probe-history__options .t-select').first().click()
  await page
    .locator('.t-select-option')
    .filter({ hasText: /^超时$/ })
    .click()
  await expect.poll(() => state.queries.at(-1)?.status).toBe('TIMEOUT')
  await drawer
    .getByRole('textbox', { name: '按完整检查目标筛选' })
    .fill('https://result.example.invalid/health')
  await drawer.getByRole('button', { name: '查询', exact: true }).click()
  await expect
    .poll(() => state.queries.at(-1)?.target)
    .toBe('https://result.example.invalid/health')
  await healthy(state)
})
test('server errors clear old rows and allow retry', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/probes')
  await expect(page.locator('.probe-row')).toHaveCount(2)
  state.fail = true
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.locator('.probe-page')).toContainText('Fixture probes offline')
  await expect(page.locator('.probe-row')).toHaveCount(0)
  state.fail = false
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.probe-row')).toHaveCount(2)
  await healthy(state)
})
test('organization downgrade evicts an open editor and all sensitive probe data', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/probes')
  await page.getByRole('button', { name: '添加探针', exact: true }).click()
  state.workspace.organizationRole = 'MEMBER'
  await page.evaluate(() => window.dispatchEvent(new Event('beacon-permissions-revalidate')))
  await expect(page).toHaveURL(/access-unavailable/)
  await expect(page.locator('body')).not.toContainText('Probe probe-1')
  await expect(page.locator('.t-dialog:visible')).toHaveCount(0)
  expect(state.workspace.requests.filter((r) => r.method === 'POST')).toEqual([])
  await healthy(state)
})
test('a late rotation response cannot display credentials in another team', async ({ page }) => {
  const state = await setup(page)
  let release!: () => Promise<void>
  await page.route('**/api/organizations/o1/probes/probe-1/rotate-secret', async (route) => {
    release = () =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { ...tenantProbe(), secret: 'obsolete-team-secret' },
        }),
      })
  })
  await page.goto('/probes')
  await page.locator('.probe-row').first().getByRole('button', { name: '轮换密钥' }).click()
  await page.locator('.t-dialog:visible').getByRole('button', { name: '确定', exact: true }).click()
  await expect.poll(() => typeof release).toBe('function')
  await page.keyboard.press('Escape')
  await expect(page.locator('.t-dialog:visible')).toHaveCount(0)
  await page.locator('.app-header__team').click()
  await page.locator('.team-list__main').filter({ hasText: 'Second Team' }).click()
  await expect(page.locator('.probe-page__head')).toContainText('Second Team')
  await release()
  await expect(page.locator('.probe-row')).toHaveCount(2)
  await expect(page.locator('.t-dialog:visible')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('obsolete-team-secret')
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'obsolete-team-secret',
  )
  await healthy(state)
})
test('expired enrollment hides the install command and copy action', async ({ page }) => {
  const state = await setup(page)
  state.enrollmentExpiresAt = new Date(Date.now() - 1000).toISOString()
  await page.goto('/probes')
  await page.getByRole('button', { name: '添加探针', exact: true }).click()
  const dialog = page.locator('.t-dialog:visible')
  await dialog.getByRole('textbox', { name: '名称', exact: true }).fill('Expired enrollment')
  await dialog.getByRole('textbox', { name: '区域', exact: true }).fill('shanghai')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.locator('.probe-credential')).toContainText('凭证已过期')
  await expect(page.locator('.probe-credential')).not.toContainText('bet_fixture_once')
  await expect(page.getByRole('button', { name: '复制', exact: true })).toHaveCount(0)
  await healthy(state)
})
test('top installation guide shows the install command with a copy action and no credentials', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/probes')
  const guide = page.locator('.probe-install')
  await expect(guide.getByRole('heading', { name: '安装指引' })).toBeVisible()
  const command = guide.locator('.probe-install__input code')
  await expect(command).toHaveText('curl -fsSL https://get.beaconix.app/install.sh | sudo sh')
  const copy = guide.getByRole('button', { name: '复制安装命令', exact: true })
  await expect(copy).toBeVisible()
  await expect(guide.locator('li')).toHaveCount(3)
  await expect(guide).toContainText('Linux、systemd、Node.js 18+')
  await expect(guide).toContainText('登录后填写探针信息并确认添加')
  await expect(guide).toContainText('刷新节点列表')
  await expect(guide.locator('form, input, pre')).toHaveCount(0)
  await expect(page.locator('.probe-row')).toHaveCount(2)
  const guideBounds = await guide.boundingBox()
  const rowBounds = await page.locator('.probe-row').first().boundingBox()
  expect(guideBounds!.y + guideBounds!.height).toBeLessThan(rowBounds!.y)
  expect(state.workspace.requests.filter((r) => r.path.endsWith('/enroll-token'))).toEqual([])
  await page.reload()
  await expect(copy).toBeVisible()
  expect(state.workspace.requests.filter((r) => r.path.endsWith('/enroll-token'))).toEqual([])
  await page.locator('.app-header__team').click()
  await page.locator('.team-list__main').filter({ hasText: 'Second Team' }).click()
  await expect(page.locator('.probe-page__head')).toContainText('Second Team')
  await expect(copy).toBeVisible()
  expect(state.workspace.requests.filter((r) => r.method === 'POST')).toEqual([])
  state.workspace.organizationRole = 'MEMBER'
  await page.evaluate(() => window.dispatchEvent(new Event('beacon-permissions-revalidate')))
  await expect(page).toHaveURL(/access-unavailable/)
  await expect(guide).toHaveCount(0)
  await healthy(state)
})
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  for (const dark of [false, true]) {
    test(`probe workflow responsive ${viewport.width}px ${dark ? 'dark' : 'light'}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      const state = await setup(page, { owner: true, dark, locale: 'en-US' })
      state.nodes[0]!.name = 'Production service availability and regional probe node '.repeat(3)
      await page.goto('/probes')
      await expect(page.locator('.probe-row')).toHaveCount(2)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath('probe-list.png'),
        fullPage: true,
        animations: 'disabled',
      })
      const guide = page.locator('.probe-install')
      await expect(guide.getByRole('heading', { name: 'Installation guide' })).toBeVisible()
      await expect(guide.getByRole('button', { name: 'Copy install command' })).toBeVisible()
      await expect(guide).toContainText('sign in and confirm the probe information')
      expect(await guide.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      )
      await page.getByRole('button', { name: 'Probe details', exact: true }).first().click()
      await expect(page.locator('.t-drawer--open')).toBeVisible()
      await expect
        .poll(async () => {
          const bounds = await page
            .locator('.t-drawer--open .t-drawer__content-wrapper')
            .boundingBox()
          return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1
        })
        .toBe(true)
      await page.screenshot({
        path: testInfo.outputPath('probe-details.png'),
        fullPage: true,
        animations: 'disabled',
      })
      await page.keyboard.press('Escape')
      await page.goto('/probes/overview')
      await expect(page.locator('.probe-overview__recent')).toHaveCount(2)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath('probe-overview.png'),
        fullPage: true,
        animations: 'disabled',
      })
      await healthy(state)
    })
  }
}
