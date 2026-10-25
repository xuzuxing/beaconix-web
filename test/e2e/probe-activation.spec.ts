import { expect, test, type Page, type Route } from '@playwright/test'
import { mockWorkspace } from './fixture'

const USER_CODE = 'WDJB-MJHT'
async function setup(page: Page, options: Parameters<typeof mockWorkspace>[1] = { owner: true }) {
  const workspace = await mockWorkspace(page, options)
  const state = {
    workspace,
    status: 'pending' as 'pending' | 'approved' | 'denied',
    hostname: 'server-shanghai',
    readStatus: 200,
    approveStatus: 200,
    delayApproval: false,
    release: undefined as (() => Promise<void>) | undefined,
  }
  const reply = (route: Route, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(status < 400 ? { data } : data),
    })
  await page.route('**/api/probes/enroll/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.slice(4)
    const body = request.postData() ? request.postDataJSON() : undefined
    workspace.requests.push({
      method: request.method(),
      path,
      body,
      headers: request.headers(),
    })
    if (path.endsWith('/activate'))
      return reply(
        route,
        state.readStatus < 400
          ? {
              userCode: url.searchParams.get('code'),
              status: state.status,
              requestedAt: '2026-10-14T00:00:00Z',
              client: {
                hostname: state.hostname,
                platform: 'linux',
                runtime: 'node/22.0.0',
              },
            }
          : { message: 'Fixture enrollment unavailable' },
        state.readStatus,
      )
    if (path.endsWith('/approve')) {
      const complete = async () => {
        if (state.approveStatus < 400) state.status = 'approved'
        await reply(
          route,
          state.approveStatus < 400
            ? {
                probeId: 'new-probe',
                organizationId: body.organizationId,
                status: 'approved',
              }
            : { message: 'Fixture approval unavailable' },
          state.approveStatus,
        )
      }
      if (state.delayApproval) state.release = complete
      else await complete()
      return
    }
    workspace.unexpected.push(`${request.method()} ${path}`)
    return reply(route, { message: 'Unexpected enrollment endpoint' }, 501)
  })
  await page.route('**/api/organizations/*/probes', async (route) => {
    const request = route.request()
    workspace.requests.push({
      method: request.method(),
      path: new URL(request.url()).pathname.slice(4),
      body: request.postData() ? request.postDataJSON() : undefined,
      headers: request.headers(),
    })
    return reply(route, [])
  })
  return state
}
const approvals = (state: Awaited<ReturnType<typeof setup>>) =>
  state.workspace.requests.filter((request) => request.path === '/probes/enroll/approve')
async function ready(page: Page) {
  await expect(page.getByRole('textbox', { name: '名称', exact: true })).toHaveValue(
    'server-shanghai',
  )
  await expect(page.getByRole('button', { name: '确认添加', exact: true })).toBeEnabled()
}
function healthy(state: Awaited<ReturnType<typeof setup>>) {
  expect(state.workspace.unexpected).toEqual([])
  expect(state.workspace.pageErrors).toEqual([])
  expect(state.workspace.consoleErrors).toEqual([])
}

test('activation uses only the plain header and saves the selected team and fields after confirmation', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto(`/activate?code=${USER_CODE}`)
  await ready(page)
  await expect(page.locator('.plain-layout__header')).toBeVisible()
  await expect(page.locator('.app-header, .app-sider, .secondary-nav')).toHaveCount(0)
  await expect(page.locator('.probe-activate__device')).toContainText('server-shanghai')
  expect(approvals(state)).toEqual([])
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  await expect(page.locator('.probe-activate')).toContainText('请填写名称和区域')
  expect(approvals(state)).toEqual([])
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('  Shanghai probe  ')
  await page.getByRole('textbox', { name: '区域', exact: true }).fill('  cn-shanghai  ')
  await page.locator('.probe-activate__form .t-select').first().click()
  await page
    .locator('.t-select-option')
    .filter({ hasText: /^Second Team$/ })
    .click()
  await page.getByRole('heading').click()
  await page.getByRole('button', { name: '确认添加', exact: true }).evaluate((button) => {
    ;(button as HTMLButtonElement).click()
    ;(button as HTMLButtonElement).click()
  })
  await expect(page.getByRole('heading', { name: '探针已添加' })).toBeVisible()
  expect(approvals(state)).toHaveLength(1)
  expect(approvals(state)[0]!.body).toEqual({
    userCode: USER_CODE,
    organizationId: 'o2',
    name: 'Shanghai probe',
    region: 'cn-shanghai',
    provider: 'CUSTOM',
  })
  expect(approvals(state)[0]!.headers.authorization).toBe('Bearer fixture-access')
  expect(
    state.workspace.requests.filter(
      (request) => request.method === 'POST' && request.path.endsWith('/probes'),
    ),
  ).toEqual([])
  expect(
    await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage })),
  ).not.toContain(USER_CODE)
  await page.getByRole('button', { name: '查看探针节点' }).click()
  await expect(page).toHaveURL(/\/probes$/)
  await expect(page.locator('.probe-page__head')).toContainText('Second Team')
  healthy(state)
})

for (const twoFactor of [false, true]) {
  test(`login ${twoFactor ? 'with 2FA' : 'without 2FA'} preserves the installation confirmation URL without saving`, async ({
    page,
  }) => {
    const state = await setup(page, { owner: true, anonymous: true })
    const auth = {
      accessToken: 'fixture-access',
      refreshToken: 'fixture-refresh',
      user: {
        id: 'u1',
        name: 'Fixture User',
        email: 'fixture@example.invalid',
        globalRole: 'USER',
        emailVerified: true,
        avatarUrl: null,
        createdAt: '2026-10-14T00:00:00Z',
        updatedAt: '2026-10-14T00:00:00Z',
      },
    }
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: twoFactor
            ? {
                twoFactorRequired: true,
                challengeId: 'fixture-challenge',
                expiresAt: '2099-01-01T00:00:00Z',
              }
            : auth,
        }),
      }),
    )
    await page.route('**/api/auth/2fa/verify-login', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: auth }),
      }),
    )
    await page.goto(`/activate?code=${USER_CODE}`)
    await expect(page).toHaveURL(/\/login\?redirect=/)
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(`/activate?code=${USER_CODE}`)
    expect(
      state.workspace.requests.filter((request) => request.path.includes('/probes/enroll')),
    ).toEqual([])
    await page.locator('#email input, input#email').fill('fixture@example.invalid')
    await page.locator('#password input, input#password').fill('fixture-password')
    await page.locator('.auth-submit').click()
    if (twoFactor) {
      await page.locator('#two-factor-code input, input#two-factor-code').fill('123456')
      await page.locator('.auth-submit').click()
    }
    await expect(page).toHaveURL(new RegExp(`/activate\\?code=${USER_CODE}$`))
    await ready(page)
    expect(approvals(state)).toEqual([])
    healthy(state)
  })
}

test('plain activation URL accepts a terminal code and cancellation creates nothing', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/activate')
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.locator('.probe-activate')).toContainText('有效的 8 位授权码')
  expect(
    state.workspace.requests.filter((request) => request.path.includes('/probes/enroll')),
  ).toEqual([])
  await page.getByRole('textbox', { name: '授权码', exact: true }).fill('wdjb mjht')
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/activate\\?code=${USER_CODE}$`))
  await ready(page)
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page).toHaveURL(/\/team$/)
  expect(approvals(state)).toEqual([])
  healthy(state)
})

for (const status of ['approved', 'denied', 'expired'] as const) {
  test(`${status} authorizations never display a save action`, async ({ page }) => {
    const state = await setup(page)
    if (status === 'expired') state.readStatus = 404
    else state.status = status
    await page.goto(`/activate?code=${USER_CODE}`)
    await expect(page.locator('.probe-activate .t-alert')).toBeVisible()
    await expect(page.getByRole('button', { name: '确认添加', exact: true })).toHaveCount(0)
    expect(approvals(state)).toEqual([])
    healthy(state)
  })
}

test('an expired request discovered before confirmation is not saved', async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/activate?code=${USER_CODE}`)
  await ready(page)
  await page.getByRole('textbox', { name: '区域', exact: true }).fill('cn-shanghai')
  state.readStatus = 404
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  await expect(page.locator('.probe-activate')).toContainText('授权码不存在或已过期')
  expect(approvals(state)).toEqual([])
  healthy(state)
})

test('a failed pre-confirmation read preserves the probe draft when retried', async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/activate?code=${USER_CODE}`)
  await ready(page)
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('My regional probe')
  await page.getByRole('textbox', { name: '区域', exact: true }).fill('cn-shanghai')
  state.readStatus = 503
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  await expect(page.locator('.probe-activate')).toContainText('Fixture enrollment unavailable')
  expect(approvals(state)).toEqual([])
  state.readStatus = 200
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '名称', exact: true })).toHaveValue(
    'My regional probe',
  )
  await expect(page.getByRole('textbox', { name: '区域', exact: true })).toHaveValue('cn-shanghai')
  expect(approvals(state)).toEqual([])
  healthy(state)
})

test('project administration is not sufficient authority to enroll in a team', async ({ page }) => {
  const state = await setup(page, { projectId: 'b' })
  await page.goto(`/activate?code=${USER_CODE}`)
  await expect(page.locator('.probe-activate')).toContainText('没有可管理的团队')
  await expect(page.getByRole('button', { name: '确认添加', exact: true })).toBeDisabled()
  expect(approvals(state)).toEqual([])
  healthy(state)
})

test('fresh permission denial blocks approval even with an already open form', async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/activate?code=${USER_CODE}`)
  await ready(page)
  await page.getByRole('textbox', { name: '区域', exact: true }).fill('cn-shanghai')
  state.workspace.organizationRole = 'MEMBER'
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  await expect(page.locator('.probe-activate')).toContainText('没有可管理的团队')
  expect(approvals(state)).toEqual([])
  healthy(state)
})

test('read and write failures remain recoverable without automatic approval', async ({ page }) => {
  const state = await setup(page)
  state.readStatus = 503
  await page.goto(`/activate?code=${USER_CODE}`)
  await expect(page.locator('.probe-activate')).toContainText('Fixture enrollment unavailable')
  expect(approvals(state)).toEqual([])
  state.readStatus = 200
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await ready(page)
  await page.getByRole('textbox', { name: '区域', exact: true }).fill('cn-shanghai')
  state.approveStatus = 503
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  await expect(page.locator('.probe-activate')).toContainText('Fixture approval unavailable')
  await expect(page.getByRole('textbox', { name: '区域', exact: true })).toHaveValue('cn-shanghai')
  state.approveStatus = 200
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  await expect(page.getByRole('heading', { name: '探针已添加' })).toBeVisible()
  expect(approvals(state)).toHaveLength(2)
  healthy(state)
})

test('a late approval cannot show success after permissions are revoked', async ({ page }) => {
  const state = await setup(page)
  state.delayApproval = true
  await page.goto(`/activate?code=${USER_CODE}`)
  await ready(page)
  await page.getByRole('textbox', { name: '区域', exact: true }).fill('cn-shanghai')
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  await expect.poll(() => typeof state.release).toBe('function')
  state.workspace.organizationRole = 'MEMBER'
  await page.evaluate(() => window.dispatchEvent(new Event('beacon-permissions-revalidate')))
  await expect(page.locator('.probe-activate')).toContainText('没有可管理的团队')
  await state.release!()
  await expect(page.getByRole('heading', { name: '探针已添加' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '确认添加', exact: true })).toBeDisabled()
  healthy(state)
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  for (const dark of [false, true]) {
    test(`activation form ${viewport.width}px ${dark ? 'dark' : 'light'}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      const state = await setup(page, { owner: true, dark, locale: 'en-US' })
      state.hostname = 'production-probe-with-a-long-regional-hostname'.repeat(3)
      await page.goto(`/activate?code=${USER_CODE}`)
      await expect(
        page.getByRole('button', { name: 'Confirm enrollment', exact: true }),
      ).toBeEnabled()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await expect(page.locator('.plain-layout__header')).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath('probe-activation.png'),
        fullPage: true,
        animations: 'disabled',
      })
      expect(approvals(state)).toEqual([])
      healthy(state)
    })
  }
}
