import { test, expect } from '@playwright/test'
import { mockWorkspace } from './fixture'

async function healthy(state: Awaited<ReturnType<typeof mockWorkspace>>) {
  expect(state.unexpected).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.consoleErrors).toEqual([])
}
test('project viewer A and admin B are distinct; directory/subscription are never requested', async ({
  page,
}) => {
  const state = await mockWorkspace(page)
  await page.goto('/monitor')
  await expect(page.getByText('Monitor A', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建监控项', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '立即检查', exact: true })).toHaveCount(0)
  await page.locator('.app-header__project').click()
  await expect(page.locator('.project-list__item')).toHaveCount(2)
  await expect(page.locator('.project-list')).not.toContainText('Project C')
  await expect(page.locator('.project-list')).not.toContainText('Project D')
  await page.locator('.project-list__item').filter({ hasText: 'Project B' }).click()
  await expect(page.getByText('Monitor B', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建监控项', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '立即检查', exact: true })).toBeVisible()
  expect(
    state.requests.filter((request) =>
      /\/(?:members|subscription|notification-channels|api-keys|audit-logs)$/.test(request.path),
    ),
  ).toEqual([])
  await healthy(state)
})
test('current B authority cannot authorize an A detail deep link; omitted private fields render safely', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { projectId: 'b' })
  await page.goto('/monitor/a/monitor-a')
  await expect(page.locator('.monitor-detail__target')).toContainText('[redacted]')
  await expect(page.getByRole('button', { name: '编辑监控项', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '立即检查', exact: true })).toHaveCount(0)
  expect(state.requests.filter((request) => request.path.endsWith('/rule-groups'))).toHaveLength(0)
  await healthy(state)
})
test('inaccessible C deep links never mount or fetch the private resource', async ({ page }) => {
  const state = await mockWorkspace(page)
  await page.goto('/monitor/c/monitor-c')
  await expect(page).toHaveURL(/access-unavailable/)
  expect(state.requests.filter((request) => request.path.includes('/monitors'))).toEqual([])
  await healthy(state)
})
for (const path of [
  '/channels',
  '/teams/members',
  '/teams/api-keys',
  '/teams/audit-logs',
  '/billing',
  '/status-pages',
]) {
  test(`project admin does not gain organization resource ${path}`, async ({ page }) => {
    const state = await mockWorkspace(page, { projectId: 'b' })
    await page.goto(path)
    await expect(page).toHaveURL(/access-unavailable/)
    expect(
      state.requests.filter((request) =>
        /\/(?:members|subscription|notification-channels|api-keys|audit-logs)$/.test(request.path),
      ),
    ).toEqual([])
    await healthy(state)
  })
}
test('no grants still allows personal notifications and never shows a create-project CTA', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { empty: true })
  await page.goto('/monitor')
  await expect(page.getByText('暂无获授权的项目', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建项目', exact: true })).toHaveCount(0)
  await page.goto('/notifications')
  await expect(page.locator('.notice-page')).toBeVisible()
  expect(state.requests.filter((request) => request.path.endsWith('/subscription'))).toEqual([])
  await healthy(state)
})
test('same-project downgrade evicts sensitive body, cached editor and write buttons', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { projectId: 'b' })
  await page.goto('/monitor')
  await expect(page.getByText('Monitor B', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '新建监控项', exact: true }).click()
  await expect(page.locator('.t-dialog:visible')).toBeVisible()
  state.roles.b = 'VIEWER'
  await page.evaluate(() => window.dispatchEvent(new Event('beacon-permissions-revalidate')))
  await expect(page.getByRole('button', { name: '新建监控项', exact: true })).toHaveCount(0)
  await expect(page.locator('.t-dialog:visible')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('private-target.example.invalid')
  await expect(page.getByText('Monitor B', { exact: true })).toBeVisible()
  await healthy(state)
})
test('revocation filters workspace projects and selects an authorized fallback without repeated retries', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { projectId: 'b' })
  await page.goto('/monitor')
  await expect(page.getByText('Monitor B', { exact: true })).toBeVisible()
  state.projectIds = ['a']
  await page.evaluate(() => window.dispatchEvent(new Event('beacon-permissions-revalidate')))
  await expect(page.getByText('Monitor A', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/monitor$/)
  await expect(page.locator('body')).not.toContainText('private-target')
  expect(
    state.requests.filter((request) => request.path === '/projects/b/my-permissions').length,
  ).toBeLessThan(8)
  await healthy(state)
})
test('profile network failure reaches recovery without an identity redirect loop', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { profileFailure: true })
  await page.goto('/monitor')
  await expect(page).toHaveURL(/access-unavailable/)
  expect(state.requests.filter((request) => request.path === '/auth/me')).toHaveLength(1)
  await healthy(state)
})
test('a stale persisted platform admin cannot mount platform resources', async ({ page }) => {
  const state = await mockWorkspace(page, { persistedSuperAdmin: true })
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/access-unavailable/)
  expect(state.requests.filter((request) => request.path.startsWith('/admin'))).toEqual([])
  await healthy(state)
})
test('other tabs invalidate permissions and clear protected content on logout', async ({
  page,
  context,
}) => {
  const first = await mockWorkspace(page, { projectId: 'b' })
  await page.goto('/monitor')
  await expect(page.getByText('Monitor B', { exact: true })).toBeVisible()
  const other = await context.newPage()
  const second = await mockWorkspace(other, { projectId: 'b' })
  await other.goto('/monitor')
  await expect(other.getByRole('button', { name: '新建监控项', exact: true })).toBeVisible()
  first.roles.b = 'VIEWER'
  second.roles.b = 'VIEWER'
  await page.evaluate(() => window.dispatchEvent(new Event('beacon-permissions-changed')))
  await expect(other.getByRole('button', { name: '新建监控项', exact: true })).toHaveCount(0)
  await expect(other.getByText('Monitor B', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const channel = new BroadcastChannel('beacon-access')
    channel.postMessage('logout')
    channel.close()
  })
  await expect(page.locator('body')).not.toContainText('Monitor B')
  await expect(other.locator('body')).not.toContainText('Monitor B')
  await expect
    .poll(() =>
      other.evaluate(
        () => JSON.parse(localStorage.getItem('beacon-vue3:user') ?? '{}').accessToken,
      ),
    )
    .toBe('')
  await healthy(first)
  await healthy(second)
  await other.close()
})
test('an organization downgrade reconciles the switcher and clears known subscription', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { admin: true, projectId: 'b' })
  await page.goto('/monitor')
  await expect(page.locator('.app-header__team-tag')).toBeVisible()
  state.organizationRole = 'MEMBER'
  state.projectIds = ['b']
  await page.evaluate(() => window.dispatchEvent(new Event('beacon-permissions-revalidate')))
  await expect(page.locator('.app-header__team-tag')).toHaveCount(0)
  await expect(page.getByText('Monitor B', { exact: true })).toBeVisible()
  await page.locator('.app-header__project').click()
  await expect(page.locator('.project-list__item')).toHaveCount(1)
  await expect(page.locator('.project-list')).not.toContainText('Project A')
  await healthy(state)
})
test('archiving a project retains authorized read and removes all write actions', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { projectId: 'b' })
  await page.goto('/monitor')
  await expect(page.getByRole('button', { name: '新建监控项', exact: true })).toBeVisible()
  state.archived = ['b']
  await page.evaluate(() => window.dispatchEvent(new Event('beacon-permissions-revalidate')))
  await expect(page.getByRole('button', { name: '新建监控项', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '立即检查', exact: true })).toHaveCount(0)
  await expect(page.getByText('Monitor B', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/monitor$/)
  await healthy(state)
})
test('project MEMBER can check but cannot manage or send test alerts', async ({ page }) => {
  const state = await mockWorkspace(page, { projectId: 'b' })
  state.roles.b = 'MEMBER'
  await page.goto('/monitor')
  await expect(page.getByRole('button', { name: '立即检查', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建监控项', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '测试告警', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '立即检查', exact: true }).click()
  await expect
    .poll(() =>
      state.requests.some(
        (request) => request.path.endsWith('/check') && request.method === 'POST',
      ),
    )
    .toBe(true)
  await healthy(state)
})
test('project ADMIN monitor editor preserves shared template summaries and can unbind', async ({
  page,
}) => {
  const state = await mockWorkspace(page, {
    projectId: 'b',
    sharedBinding: true,
  })
  await page.goto('/monitor')
  await page.getByRole('button', { name: '编辑监控项', exact: true }).click()
  const dialog = page.locator('.t-dialog:visible')
  await expect(dialog).toContainText('Shared template summary')
  await expect(dialog.getByRole('button', { name: '解绑', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '解绑', exact: true }).click()
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.requests.find((request) => request.method === 'DELETE')?.path).toBe(
    '/projects/b/monitors/monitor-b/rule-bindings/template-1',
  )
  expect(
    state.requests.filter((request) => request.path.includes('/rule-groups/template-1')),
  ).toEqual([])
  await healthy(state)
})
test('project ADMIN creates and edits a monitor without resending unchanged credentials', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { projectId: 'b' })
  await page.goto('/monitor')
  await page.getByRole('button', { name: '新建监控项', exact: true }).click()
  let dialog = page.locator('.t-dialog:visible')
  await dialog.locator('input').nth(0).fill('Created fixture monitor')
  await dialog.locator('input').nth(2).fill('https://fixture-target.example.invalid')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const create = state.requests.find(
    (request) => request.method === 'POST' && request.path === '/projects/b/monitors',
  )
  expect(create?.body).toMatchObject({
    name: 'Created fixture monitor',
    target: 'https://fixture-target.example.invalid',
    type: 'HTTP',
    config: {},
    enabled: true,
  })
  await expect(page.getByText('Created fixture monitor', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '编辑监控项', exact: true }).click()
  dialog = page.locator('.t-dialog:visible')
  await dialog.locator('input').first().fill('Renamed fixture monitor')
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.requests.find((request) => request.method === 'PATCH')?.body).toEqual({
    name: 'Renamed fixture monitor',
  })
  await expect(page.getByText('Renamed fixture monitor', { exact: true })).toBeVisible()
  await healthy(state)
})
test('test alert requires explicit confirmation and fresh ADMIN authority', async ({ page }) => {
  const state = await mockWorkspace(page, { projectId: 'b' })
  await page.goto('/monitor')
  await page.getByRole('button', { name: '测试告警', exact: true }).click()
  const confirmation = page.locator('.t-popconfirm:visible')
  await expect(confirmation).toBeVisible()
  expect(state.requests.filter((request) => request.path.endsWith('/test-alert'))).toEqual([])
  await confirmation.getByRole('button', { name: '确定', exact: true }).click()
  await expect
    .poll(() => state.requests.filter((request) => request.path.endsWith('/test-alert')).length)
    .toBe(1)
  expect(state.requests.find((request) => request.path.endsWith('/test-alert'))?.method).toBe(
    'POST',
  )
  await healthy(state)
})
test('child monitor 404 clears detail title while retaining the authorized project', async ({
  page,
}) => {
  const state = await mockWorkspace(page)
  await page.goto('/monitor/a/monitor-a')
  await expect(page.locator('.layout__page-title')).toHaveText('Monitor A')
  state.detailUnavailable = true
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.locator('body')).not.toContainText('Monitor A')
  await expect(page).toHaveURL(/\/monitor\/a\/monitor-a$/)
  await expect(page.locator('.app-header__project')).toContainText('Project A')
  await healthy(state)
})
test('organization owner invitation sends exact explicit project payload', async ({ page }) => {
  const state = await mockWorkspace(page, { owner: true })
  await page.goto('/teams/members')
  await page.getByRole('button', { name: '邀请成员', exact: true }).click()
  const dialog = page.locator('.t-dialog:visible')
  await dialog.locator('input').first().fill('recipient@example.invalid')
  await dialog.getByRole('button', { name: '发送邀请', exact: true }).click()
  await expect(dialog).toContainText('请选择 1 至 100')
  expect(state.requests.some((request) => request.method === 'POST')).toBe(false)
  const a = dialog.locator('.grant-selector__row').filter({ hasText: 'Project A' })
  await a.locator('.t-checkbox').click()
  await dialog.getByRole('button', { name: '发送邀请', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(
    state.requests.find(
      (request) => request.method === 'POST' && request.path.endsWith('/invitations'),
    )?.body,
  ).toEqual({
    email: 'recipient@example.invalid',
    role: 'MEMBER',
    projects: [{ projectId: 'a', role: 'VIEWER' }],
  })
  await healthy(state)
})
test('authorization drawer saves a full replacement with both preconditions', async ({ page }) => {
  const state = await mockWorkspace(page, { owner: true })
  await page.goto('/teams/members')
  await page.getByRole('button', { name: '项目权限', exact: true }).click()
  const drawer = page.locator('.t-drawer--open')
  await expect(drawer.locator('.grant-selector__row')).toHaveCount(4)
  await drawer
    .locator('.grant-selector__row')
    .filter({ hasText: 'Project B' })
    .locator('.t-checkbox')
    .click()
  await drawer.getByRole('button', { name: '保存权限', exact: true }).click()
  await expect(drawer).not.toBeVisible()
  expect(state.requests.find((request) => request.method === 'PUT')?.body).toEqual({
    expectedMembershipId: 'member-old',
    expectedVersion: 7,
    projects: [
      { projectId: 'a', role: 'VIEWER' },
      { projectId: 'b', role: 'VIEWER' },
    ],
  })
  await healthy(state)
})
for (const rejoin of [false, true]) {
  test(`409 reload requires explicit restart; ABA=${rejoin}`, async ({ page }) => {
    const state = await mockWorkspace(page, { owner: true })
    state.conflict = true
    state.rejoin = rejoin
    await page.goto('/teams/members')
    await page.getByRole('button', { name: '项目权限', exact: true }).click()
    const drawer = page.locator('.t-drawer--open')
    await drawer.getByRole('button', { name: '保存权限', exact: true }).click()
    await expect(drawer).toContainText(rejoin ? '旧草稿已作废' : '权限已被其他操作修改')
    await expect(drawer.getByRole('button', { name: '保存权限', exact: true })).toHaveCount(0)
    expect(state.requests.filter((request) => request.method === 'PUT')).toHaveLength(1)
    await drawer.getByRole('button', { name: '使用最新状态重新编辑', exact: true }).click()
    await drawer.getByRole('button', { name: '保存权限', exact: true }).click()
    await expect(drawer).not.toBeVisible()
    expect(state.requests.filter((request) => request.method === 'PUT')[1]?.body).toMatchObject({
      expectedMembershipId: rejoin ? 'member-rejoined' : 'member-old',
      expectedVersion: 8,
    })
    await healthy(state)
  })
}
test('public invitation shows no projects or roles and never stores its token', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { anonymous: true })
  await page.goto('/invitations/fixture-token')
  await expect(page.locator('h1')).toHaveText('Fixture Team')
  await expect(page.locator('body')).not.toContainText('Project A')
  const request = state.requests.find((request) => request.path === '/invitations/fixture-token')
  expect(request?.headers.authorization).toBeUndefined()
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('fixture-token')
  await healthy(state)
})
test('authenticated invitation return displays scope before accepting and refreshes existing workspace', async ({
  page,
}) => {
  const state = await mockWorkspace(page, { invitations: true })
  await page.goto('/invitations/fixture-token')
  await expect(page).toHaveURL(/\/notifications$/)
  await expect(page.locator('.invitation-scope').first()).toContainText('Project A')
  await expect(page.locator('.invitation-scope').first()).toContainText('Project B')
  const before = state.requests.filter(
    (request) => request.path === '/organizations/o1/projects',
  ).length
  await page.getByRole('button', { name: '接受', exact: true }).first().click()
  await expect
    .poll(
      () =>
        state.requests.filter((request) => request.path === '/organizations/o1/projects').length,
    )
    .toBeGreaterThan(before)
  expect(state.requests.filter((request) => request.path.endsWith('/accept'))).toHaveLength(1)
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('fixture-token')
  await healthy(state)
})
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  for (const dark of [false, true]) {
    test(`grant drawer responsive ${viewport.width}px ${dark ? 'dark' : 'light'}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      const state = await mockWorkspace(page, { owner: true, dark })
      await page.goto('/teams/members')
      await page.getByRole('button', { name: '项目权限', exact: true }).click()
      await expect(page.locator('.t-drawer--open .grant-selector__row')).toHaveCount(4)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await expect
        .poll(async () => {
          const bounds = await page
            .locator('.t-drawer--open .t-drawer__content-wrapper')
            .boundingBox()
          return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1
        })
        .toBe(true)
      if (viewport.width === 390) {
        expect(
          (await page.locator('.t-drawer--open .grant-command').boundingBox())?.height,
        ).toBeGreaterThanOrEqual(44)
        expect(
          (await page.locator('.t-drawer--open .grant-close').boundingBox())?.height,
        ).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({
        path: testInfo.outputPath('grant-drawer.png'),
        fullPage: true,
        animations: 'disabled',
      })
      await healthy(state)
    })
  }
}
test('English long names and 100 grants stay readable on mobile and preserve filtered selections', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await mockWorkspace(page, { owner: true, locale: 'en-US' })
  state.projectIds = Array.from({ length: 100 }, (_, index) => `p${index}`)
  state.projectNames = Object.fromEntries(
    state.projectIds.map((id) => [
      id,
      `${id} Production monitoring and regional service availability`.repeat(2),
    ]),
  )
  state.grants = state.projectIds.map((projectId) => ({
    projectId,
    role: 'VIEWER',
  }))
  await page.goto('/teams/members')
  await page.getByRole('button', { name: 'Project permissions', exact: true }).click()
  const drawer = page.locator('.t-drawer--open')
  await expect(drawer.locator('.grant-selector__row')).toHaveCount(100)
  await expect(drawer).toContainText('100 projects selected')
  await drawer
    .getByRole('textbox', { name: 'Search project name or key', exact: true })
    .fill('p99 ')
  await expect(drawer.locator('.grant-selector__row')).toHaveCount(1)
  expect(
    await drawer
      .locator('.grant-selector__row')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await expect
    .poll(async () => {
      const bounds = await drawer.locator('.t-drawer__content-wrapper').boundingBox()
      return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391
    })
    .toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('long-name-grants.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await drawer.getByRole('button', { name: 'Save permissions', exact: true }).click()
  await expect(drawer).not.toBeVisible()
  expect(state.requests.find((request) => request.method === 'PUT')?.body).toEqual({
    expectedMembershipId: 'member-old',
    expectedVersion: 7,
    projects: state.grants,
  })
  await page.getByRole('button', { name: 'Project permissions', exact: true }).click()
  await expect(page.locator('.t-drawer--open')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.t-drawer--open')).toHaveCount(0)
  await healthy(state)
})
