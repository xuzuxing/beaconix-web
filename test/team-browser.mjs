// 团队管理四个页面的浏览器冒烟测试：在 mock 接口下渲染真实页面，断言关键内容与无运行时错误。
// 需要本地 dev server 与 playwright：PLAYWRIGHT_MODULE 指向 playwright 包，TEAM_BROWSER_URL 指向站点。
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.TEAM_BROWSER_URL || 'http://127.0.0.1:5173'
const output = process.env.TEAM_BROWSER_OUT || join(tmpdir(), 'beacon', 'team-artifacts')
await mkdir(output, { recursive: true })

const date = '2026-09-01T10:00:00.000Z'
const user = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  globalRole: 'USER',
  isActive: true,
  emailVerified: true,
  avatarUrl: null,
  lastSeenAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const org = {
  id: 'o1',
  name: 'Test Team',
  slug: 'test-team',
  description: 'Browser smoke team',
  logoUrl: null,
  website: 'https://example.test',
  ownerId: 'u1',
  createdAt: date,
  updatedAt: date,
}
// 第二个团队：用于验证下拉里每个团队的套餐标签与两个入口
const org2 = {
  id: 'o2',
  name: 'Second Team',
  slug: 'second-team',
  description: null,
  logoUrl: null,
  website: null,
  ownerId: 'u1',
  createdAt: date,
  updatedAt: date,
}
const proPlan = {
  id: 'plan-pro',
  code: 'PRO',
  name: 'Professional',
  sortOrder: 1,
  description: 'Pro plan',
  price: 9900,
  durationDays: 30,
  maxMonitors: 200,
  maxProbes: 5,
  maxMembers: 20,
  maxChannels: 10,
  minInterval: 30,
  allowTenantProbe: true,
  allowStatusPage: true,
  enabled: true,
  createdAt: date,
  updatedAt: date,
}
// 新建团队接口返回的团队（POST /organizations 后加入列表）
const createdOrg = {
  id: 'o3',
  name: 'New Team',
  slug: 'new-team',
  description: null,
  logoUrl: null,
  website: null,
  ownerId: 'u1',
  createdAt: date,
  updatedAt: date,
}
const members = [
  {
    id: 'm1',
    userId: 'u1',
    organizationId: 'o1',
    role: 'OWNER',
    joinedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: date,
    invitedById: null,
    user: {
      id: 'u1',
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      avatarUrl: null,
    },
  },
  {
    id: 'm2',
    userId: 'u2',
    organizationId: 'o1',
    role: 'MEMBER',
    joinedAt: '2026-03-01T00:00:00.000Z',
    updatedAt: date,
    invitedById: null,
    user: {
      id: 'u2',
      name: 'Grace Hopper',
      email: 'grace@example.test',
      avatarUrl: null,
    },
  },
  // 无内嵌用户资料：界面应回退展示 userId 短码
  {
    id: 'm3',
    userId: 'cmgu92m5x0002p8l4h8z6s3k3',
    organizationId: 'o1',
    role: 'VIEWER',
    joinedAt: '2026-05-01T00:00:00.000Z',
    updatedAt: date,
    invitedById: 'u1',
  },
]
const invitations = [
  {
    id: 'inv1',
    email: 'invitee@example.test',
    organizationId: 'o1',
    role: 'ADMIN',
    status: 'PENDING',
    token: 'tok',
    expiresAt: '2026-12-31T00:00:00.000Z',
    sentById: 'u1',
    acceptedAt: null,
    createdAt: date,
    updatedAt: date,
  },
]
const apiKeys = [
  {
    id: 'k1',
    organizationId: 'o1',
    name: 'Production CI',
    keyPrefix: 'bk_org_1a2b3c4d',
    scopes: ['monitors:read', 'monitoring:read'],
    expiresAt: null,
    lastUsedAt: date,
    revokedAt: null,
    createdById: 'u1',
    createdAt: date,
    updatedAt: date,
  },
  {
    id: 'k2',
    organizationId: 'o1',
    name: 'Legacy script',
    keyPrefix: 'bk_org_9z8y7x6w',
    scopes: ['probes:read'],
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: '2026-09-10T00:00:00.000Z',
    createdById: 'u1',
    createdAt: date,
    updatedAt: date,
  },
]
const auditLogs = {
  items: [
    {
      id: 'a1',
      actorId: 'u1',
      organizationId: 'o1',
      projectId: null,
      action: 'UPDATE',
      entity: 'Project',
      entityId: 'cmgu92m5x0001p8l4h8z6s3k2',
      before: { name: 'Old name', updatedAt: date },
      after: { name: 'New name', updatedAt: date },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      createdAt: date,
    },
  ],
  total: 1,
  page: 1,
  limit: 25,
  totalPages: 1,
}

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
})

async function newPage(viewport) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  let orgList = [org, org2]
  let createdTeam = null
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript((account) => {
    localStorage.setItem(
      'beacon-vue3:user',
      JSON.stringify({
        accessToken: 'team-browser-test-only',
        refreshToken: '',
        user: account,
      }),
    )
    localStorage.setItem(
      'beacon-vue3:organization',
      JSON.stringify({ currentOrganizationId: 'o1', currentProjectId: '' }),
    )
    localStorage.setItem(
      'beacon-vue3:app',
      JSON.stringify({ locale: 'zh-CN', theme: 'light', collapsed: false }),
    )
  }, user)
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (!pathname.startsWith('/api/')) return route.continue()

    let data = {}
    if (pathname === '/api/organizations') {
      if (request.method() === 'POST') {
        createdTeam = request.postDataJSON()
        orgList = [...orgList, createdOrg]
        data = createdOrg
      } else {
        data = orgList
      }
    } else if (pathname === '/api/auth/me') data = user
    else if (pathname.endsWith('/projects')) data = []
    else if (pathname.endsWith('/subscription'))
      data = pathname.includes('/o2/')
        ? { effectivePlan: proPlan, stack: [] }
        : { effectivePlan: null, stack: [] }
    else if (pathname.endsWith('/members')) data = members
    else if (pathname.endsWith('/invitations')) data = invitations
    else if (pathname.endsWith('/api-keys')) data = apiKeys
    else if (pathname.endsWith('/audit-logs')) data = auditLogs
    else if (pathname.endsWith('/unread-count')) data = { count: 0 }
    else if (pathname.endsWith('/notifications')) data = { data: [], meta: {} }
    await route.fulfill({ json: { data } })
  })
  return { context, page, errors, createdTeam: () => createdTeam }
}

/** 每个场景独立 context；失败时打印页面文本与截图，便于定位 */
async function scenario(name, fn) {
  const { context, page, errors } = await newPage({ width: 1440, height: 1000 })
  try {
    await fn(page, errors)
  } catch (error) {
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '<no body>')
    console.error(
      JSON.stringify({ name, url: page.url(), errors, text: text.slice(0, 1500) }, null, 2),
    )
    await page.screenshot({
      path: join(output, `${name}-failure.png`),
      fullPage: true,
    })
    throw error
  } finally {
    await context.close()
  }
}

const results = []
try {
  await scenario('info', async (page, errors) => {
    await page.goto(`${origin}/teams`)
    await page.waitForSelector('.team-info__meta')
    assert.equal(await page.locator('.team-info__meta dd').first().innerText(), 'o1')
    assert.equal(await page.locator('.team-info__meta dd').nth(1).innerText(), 'Ada Lovelace')
    assert.equal(await page.locator('.team-info__form input').first().inputValue(), 'Test Team')
    assert.equal(await page.locator('.team-info__form input').nth(1).inputValue(), 'test-team')
    // 危险区：标识不匹配时按钮禁用，匹配后可用
    const dangerButton = page.locator('.danger-zone .t-button')
    assert.equal(await dangerButton.isDisabled(), true)
    await page.locator('.danger-zone input').fill('wrong-slug')
    assert.equal(await dangerButton.isDisabled(), true)
    await page.locator('.danger-zone input').fill('test-team')
    assert.equal(await dangerButton.isDisabled(), false)
    // 有改动后保存按钮才可用
    const saveButton = page.locator('.team-info__actions .t-button')
    assert.equal(await saveButton.isDisabled(), true)
    await page.locator('.team-info__form input').first().fill('Test Team Renamed')
    assert.equal(await saveButton.isDisabled(), false)
    await page.screenshot({ path: join(output, 'info.png'), fullPage: true })
    assert.deepEqual(errors, [])
    results.push('团队信息页：资料展示/表单校验/危险区与保存按钮状态正确')
  })

  await scenario('members', async (page, errors) => {
    await page.goto(`${origin}/teams/members`)
    await page.waitForSelector('.member-row')
    assert.equal(await page.locator('.member-row').count(), 3)
    // 排序：所有者恒在最前，其余按加入时间倒序；无用户资料的成员回退展示 userId 短码
    assert.deepEqual(await page.locator('.member-row__name').allInnerTexts(), [
      'Ada Lovelace\n我',
      'cmgu92…s3k3',
      'Grace Hopper',
    ])
    assert.match(
      await page.locator('.member-row__sub').nth(1).innerText(),
      /cmgu92m5x0002p8l4h8z6s3k3/,
    )
    // 搜索姓名与 userId 都能命中
    const search = page.locator('.members__filters input').first()
    await search.fill('grace')
    assert.equal(await page.locator('.member-row').count(), 1)
    await search.fill('cmgu92m5x0002')
    assert.equal(await page.locator('.member-row').count(), 1)
    await search.fill('')
    assert.equal(await page.locator('.member-row').count(), 3)
    // 待处理邀请
    assert.equal(await page.locator('.invite-row').count(), 1)
    assert.match(await page.locator('.invite-row__email').innerText(), /invitee@example\.test/)
    // 邀请弹窗：邮箱非法时给出校验错误且不发请求
    await page.locator('#layout-header-actions .t-button').last().click()
    const dialog = page.locator('.t-dialog:visible').last()
    await dialog.locator('input').first().fill('not-an-email')
    await dialog.getByRole('button', { name: '发送邀请' }).click()
    await page.waitForSelector('.t-dialog:visible .t-alert')
    assert.match(await dialog.locator('.t-alert').innerText(), /有效的邮箱地址/)
    await page.screenshot({ path: join(output, 'members.png'), fullPage: true })
    assert.deepEqual(errors, [])
    results.push('团队成员页：列表/回退展示/搜索/邀请校验通过')
  })

  await scenario('api-keys', async (page, errors) => {
    await page.goto(`${origin}/teams/api-keys`)
    await page.waitForSelector('.api-key-row')
    assert.equal(await page.locator('.api-key-row').count(), 2)
    assert.deepEqual(await page.locator('.api-key-row .t-tag').allInnerTexts(), ['可用', '已作废'])
    assert.match(await page.locator('.api-key-row__value').first().innerText(), /bk_org_1a2b3c4d/)
    assert.match(await page.locator('.api-key-row__value').first().innerText(), /••••/)
    // 已作废的密钥不再提供「作废」操作，可用的仍提供
    assert.equal(await page.locator('.api-key-row').nth(0).locator('.t-button').count(), 1)
    assert.equal(await page.locator('.api-key-row').nth(1).locator('.t-button').count(), 0)
    // 创建弹窗：名称必填
    await page.locator('#layout-header-actions .t-button').last().click()
    const dialog = page.locator('.t-dialog:visible').last()
    await dialog.locator('.t-dialog__footer .t-button').last().click()
    await page.waitForSelector('.t-dialog:visible .t-alert')
    assert.match(await dialog.locator('.t-alert').innerText(), /请填写密钥名称/)
    await page.screenshot({
      path: join(output, 'api-keys.png'),
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    results.push('API 密钥页：列表状态/掩码/作废权限与创建校验通过')
  })

  await scenario('audit-logs', async (page, errors) => {
    await page.goto(`${origin}/teams/audit-logs`)
    await page.waitForSelector('.audit-row')
    assert.equal(await page.locator('.audit-row').count(), 1)
    assert.equal(await page.locator('.audit-row .t-tag').innerText(), '更新')
    assert.match(await page.locator('.audit-row__entity-name').innerText(), /Project/)
    // 详情抽屉：字段级差异
    await page.locator('.audit-row__detail button').click()
    await page.waitForSelector('.audit-detail')
    const changes = page.locator('.audit-detail__row')
    assert.equal(await changes.count(), 1)
    assert.match(await changes.first().innerText(), /name/)
    assert.match(await changes.first().innerText(), /Old name/)
    assert.match(await changes.first().innerText(), /New name/)
    await page.screenshot({
      path: join(output, 'audit-detail.png'),
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    results.push('审计日志页：列表渲染与详情差异抽屉通过')
  })

  // 头部动作区：被 keep-alive 缓存的页面在停用后，不得把注入的按钮留在容器里
  {
    const { context, page, errors } = await newPage({
      width: 1440,
      height: 1000,
    })
    try {
      const headerButtons = () => page.locator('#layout-header-actions .t-button').count()
      await page.goto(`${origin}/teams`)
      await page.waitForSelector('.team-info__panel')
      assert.equal(await headerButtons(), 1, '基本信息：头部动作按钮数应为 1')
      // 顶栏：团队用 CodeFolderIcon、项目用 KanbanIcon，两个图标都渲染且互不相同
      const iconPaths = (selector) =>
        page
          .locator(`${selector} path, ${selector} svg path`)
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')).join(''))
      const teamIcon = await iconPaths('.app-header__team-icon')
      const projectIcon = await iconPaths('.app-header__project-icon')
      assert.ok(teamIcon.length > 0 && projectIcon.length > 0, '团队与项目图标都应渲染')
      assert.notEqual(teamIcon, projectIcon, '团队与项目应使用不同图标')
      for (const [label, selector, expected] of [
        ['团队成员', '.member-row', 2],
        ['API 密钥', '.api-key-row', 2],
        ['审计日志', '.audit-row', 1],
        ['基本信息', '.team-info__panel', 1],
      ]) {
        await page.locator('.secondary-nav__link', { hasText: label }).click()
        await page.waitForSelector(selector)
        assert.equal(await headerButtons(), expected, `${label}：头部动作按钮数应为 ${expected}`)
        assert.equal(
          await page.locator('.page-rating').count(),
          0,
          `${label}：标题栏不应再出现评价框`,
        )
      }
      await page.screenshot({
        path: join(output, 'header-actions.png'),
        fullPage: true,
      })
      assert.deepEqual(errors, [])
      results.push('头部动作区：切换团队子页不累加注入的按钮')
    } finally {
      await context.close()
    }
  }

  // 团队下拉：每个团队带套餐标签 + 右侧两个入口，底部「团队管理」跳 /team
  {
    const { context, page, errors } = await newPage({
      width: 1440,
      height: 1000,
    })
    try {
      const openTeamList = async () => {
        await page.locator('.app-header__team').click()
        await page.waitForSelector('.team-list__item')
      }

      await page.goto(`${origin}/teams`)
      await page.waitForSelector('.team-info__panel')
      await openTeamList()

      const items = page.locator('.team-list__item')
      assert.equal(await items.count(), 2)
      // 套餐标签：当前团队取 store（免费版），另一个团队按需请求订阅（Professional）
      await page.waitForFunction(
        () =>
          document
            .querySelectorAll('.team-list__plan')[1]
            ?.textContent?.includes('Professional') === true,
      )
      assert.deepEqual(await page.locator('.team-list__plan').allInnerTexts(), [
        '免费版',
        'Professional',
      ])
      // 每个团队右侧两个 icon 入口
      assert.equal(await items.nth(0).locator('.team-list__entry').count(), 2)
      assert.equal(await items.nth(1).locator('.team-list__entry').count(), 2)
      await page.screenshot({
        path: join(output, 'team-list.png'),
        fullPage: true,
      })

      // 成员入口 → 该团队的成员页
      await items.nth(1).locator('.team-list__entry').first().click()
      await page.waitForURL(/\/teams\/members$/)

      // 底部「团队管理」→ /team
      await page.goto(`${origin}/teams`)
      await page.waitForSelector('.team-info__panel')
      await openTeamList()
      await page.locator('.team-list__actions .team-list__action').first().click()
      await page.waitForURL(/\/team$/)

      assert.deepEqual(errors, [])
      results.push('团队下拉：套餐标签、两个入口跳转与底部 /team 入口正确')
    } finally {
      await context.close()
    }
  }

  // 选择团队页：布局对齐环境页，含搜索 / 筛选 / 视图切换 / 总数 / 新建团队
  {
    const { context, page, errors, createdTeam } = await newPage({
      width: 1440,
      height: 1000,
    })
    try {
      await page.goto(`${origin}/team`)
      await page.waitForSelector('.team-select__list')

      // 工具栏：新建 + 排序 + 筛选 + 搜索 + 两个视图按钮
      assert.equal(await page.locator('.team-select__toolbar > .t-button').count(), 1)
      assert.equal(await page.locator('.team-select__operations .t-select').count(), 2)
      assert.equal(await page.locator('.team-select__views .team-select__view').count(), 2)

      // 卡片：两个团队 + 套餐标签 + 总数
      assert.equal(await page.locator('.team-card').count(), 2)
      await page.waitForFunction(
        () =>
          document
            .querySelectorAll('.team-card__plan')[1]
            ?.textContent?.includes('Professional') === true,
      )
      assert.deepEqual(await page.locator('.team-card__plan').allInnerTexts(), [
        '免费版',
        'Professional',
      ])
      assert.match(await page.locator('.team-select__total').innerText(), /共 2 个团队/)

      // 视图切换：列表 / 卡片
      await page.locator('.team-select__views .team-select__view').nth(1).click()
      assert.equal(await page.locator('.team-select__list--list').count(), 1)
      await page.locator('.team-select__views .team-select__view').nth(0).click()
      assert.equal(await page.locator('.team-select__list--card').count(), 1)

      // 搜索名称
      await page.locator('.team-select__search input').fill('Second')
      assert.equal(await page.locator('.team-card').count(), 1)
      await page.locator('.team-select__search input').fill('')
      assert.equal(await page.locator('.team-card').count(), 2)

      // 筛选「我加入的」：两个团队都是自己创建的 → 空态 + 清空筛选
      await page.locator('.team-select__operations .t-select').nth(1).click()
      await page.locator('.t-select-option').filter({ hasText: '我加入的' }).click()
      await page.waitForSelector('.team-select__state')
      assert.equal(await page.locator('.team-card').count(), 0)
      assert.match(await page.locator('.team-select__empty').innerText(), /没有匹配的团队/)
      await page.locator('.team-select__state .t-button').click()
      assert.equal(await page.locator('.team-card').count(), 2)

      // 新建团队：POST 真实接口 → 切到新团队并进入控制台
      await page.locator('.team-select__toolbar .t-button').click()
      const dialog = page.locator('.t-dialog:visible').last()
      await dialog.locator('input').first().fill('New Team')
      await dialog.locator('.t-dialog__footer .t-button').last().click()
      await page.waitForURL(/\/dashboard$/)
      assert.deepEqual(createdTeam(), { name: 'New Team', slug: 'new-team' })

      assert.deepEqual(errors, [])
      results.push('选择团队页：搜索/筛选/视图切换/总数与新建团队（真实接口）均正常')
    } finally {
      await context.close()
    }
  }

  // 移动端视口：四个页面均可渲染且无运行时错误（布局本身有 1440px 最小宽度，故不做溢出断言）
  {
    const { context, page, errors } = await newPage({ width: 375, height: 812 })
    try {
      for (const [path, selector] of [
        ['/teams', '.team-info__panel'],
        ['/teams/members', '.member-row'],
        ['/teams/api-keys', '.api-key-row'],
        ['/teams/audit-logs', '.audit-row'],
      ]) {
        await page.goto(`${origin}${path}`)
        await page.waitForSelector(selector)
      }
      await page.screenshot({
        path: join(output, '375-audit.png'),
        fullPage: true,
      })
      assert.deepEqual(errors, [])
      results.push('移动端 375px：四个页面均渲染成功且无运行时错误')
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ output: resolve(output), results }, null, 2))
