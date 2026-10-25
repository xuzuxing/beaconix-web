// 管理后台五个页面的浏览器冒烟测试：在 mock 接口下渲染真实页面，断言关键内容与无运行时错误。
// 需要本地 dev server 与 playwright：PLAYWRIGHT_MODULE 指向 playwright 包，ADMIN_BROWSER_URL 指向站点。
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.ADMIN_BROWSER_URL || 'http://127.0.0.1:5173'
const output = process.env.ADMIN_BROWSER_OUT || join(tmpdir(), 'beacon', 'admin-artifacts')
await mkdir(output, { recursive: true })

const date = '2026-10-06T12:00:00.000Z'
const superAdmin = {
  id: 'u1',
  name: 'Platform Admin',
  email: 'admin@example.test',
  globalRole: 'SUPER_ADMIN',
  isActive: true,
  emailVerified: true,
  avatarUrl: null,
  lastSeenAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const metricsOverview = {
  tenants: { total: 40, active: 36, deleted: 4 },
  users: 200,
  projects: 90,
  monitors: { total: 320, enabled: 280 },
  probes: { total: 55, tenant: 45, system: 10 },
  checkVolume: 180000,
  notificationVolume: 3200,
  statusPages: 12,
  systemProbeUsage: 60,
}

// dueMonitors > 0 → 健康度为 danger，页面应显示「存在异常」
const schedulerHealth = {
  scanQueue: { waiting: 0, active: 1, delayed: 12, failed: 0, completed: 180 },
  checkQueue: { waiting: 2, active: 0, delayed: 0, failed: 0, completed: 900 },
  scheduledQueue: {
    waiting: 0,
    active: 0,
    delayed: 3,
    failed: 0,
    completed: 40,
  },
  schedulers: [
    {
      id: 'monitor-checker',
      everyMs: 10000,
      pattern: null,
      nextRunAt: '2026-10-06T13:00:10.000Z',
    },
  ],
  backlog: { enabledMonitors: 320, dueMonitors: 2 },
  probes: { online: 45, offline: 3 },
}

const tenantMetrics = [
  {
    organizationId: 'o1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    active: true,
    monitorCount: 12,
    enabledMonitorCount: 10,
    tenantProbeCount: 3,
    systemProbeUsage: 5,
    checkVolume: 9000,
    notificationVolume: 120,
    statusPageCount: 2,
  },
  {
    organizationId: 'o2',
    name: 'Globex',
    slug: 'globex',
    active: false,
    monitorCount: 4,
    enabledMonitorCount: 0,
    tenantProbeCount: 0,
    systemProbeUsage: 0,
    checkVolume: 12,
    notificationVolume: 0,
    statusPageCount: 0,
  },
]

const tenants = [
  {
    id: 'o1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    ownerId: 'u1',
    active: true,
    memberCount: 12,
    projectCount: 3,
    monitorCount: 8,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: date,
    deletedAt: null,
  },
  {
    id: 'o2',
    name: 'Globex',
    slug: 'globex',
    ownerId: 'u2',
    active: false,
    memberCount: 2,
    projectCount: 1,
    monitorCount: 4,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: date,
    deletedAt: date,
  },
]

const probes = [
  {
    id: 'p1',
    scope: 'SYSTEM',
    name: 'Tokyo probe',
    provider: 'TENCENT',
    region: 'ap-northeast-1',
    callbackUrl: 'https://probe.example.test/beacon/callback',
    enabled: true,
    // 心跳新鲜（页面用当前时间判断，测试里给一个未来时间避免随运行时钟漂移）
    lastHeartbeat: '2099-01-01T00:00:00.000Z',
    heartbeatIntervalSeconds: 60,
    status: 'ONLINE',
    maxTenants: 100,
    priority: 5,
    createdAt: date,
    updatedAt: date,
    monitors: [
      {
        id: 'm1',
        name: 'Health',
        type: 'HTTP',
        target: 'https://a.test',
        enabled: true,
      },
    ],
    resultCount: 12,
  },
  {
    id: 'p2',
    scope: 'SYSTEM',
    name: 'Frankfurt probe',
    provider: 'CUSTOM',
    region: 'eu-central-1',
    callbackUrl: 'https://probe2.example.test/beacon/callback',
    enabled: false,
    lastHeartbeat: '2026-10-06T11:00:00.000Z',
    heartbeatIntervalSeconds: 60,
    status: 'OFFLINE',
    maxTenants: 50,
    priority: 0,
    createdAt: date,
    updatedAt: date,
    monitors: [],
    resultCount: 0,
  },
]

const auditLogs = {
  items: [
    {
      id: 'a1',
      actorId: 'u9',
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

const baseOrder = {
  orderNo: 'BW1A2B3C',
  currency: 'CNY',
  planId: 'plan-pro',
  plan: { id: 'plan-pro', code: 'PRO', name: 'Professional', price: 9900 },
  durationDays: 30,
  expiresAt: '2026-10-06T12:30:00.000Z',
  createdAt: date,
  updatedAt: date,
  paidAt: null,
  cancelledAt: null,
}

const orderFixtures = () => [
  {
    ...baseOrder,
    id: 'ord1',
    organizationId: 'o1',
    userId: 'u1',
    amount: 9900,
    status: 'PENDING',
    organization: { id: 'o1', name: 'Acme Corporation', slug: 'acme-corp' },
    user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.test' },
  },
  {
    ...baseOrder,
    id: 'ord2',
    orderNo: 'BW4D5E6F',
    organizationId: 'o2',
    userId: 'u2',
    amount: 2900,
    status: 'PAID',
    paidAt: date,
    organization: { id: 'o2', name: 'Globex', slug: 'globex' },
    user: { id: 'u2', name: 'Grace Hopper', email: 'grace@example.test' },
  },
]

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
})

async function newPage(viewport, account = superAdmin) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  const adminRequests = []
  let orders = orderFixtures()
  let probeList = probes.map((probe) => ({ ...probe }))

  page.on('pageerror', (error) => errors.push(error.message))

  await page.addInitScript((signedIn) => {
    localStorage.setItem(
      'beacon-vue3:user',
      JSON.stringify({
        accessToken: 'admin-browser-test-only',
        refreshToken: '',
        user: signedIn,
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
  }, account)

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (!pathname.startsWith('/api/')) return route.continue()
    if (pathname.startsWith('/api/admin/')) adminRequests.push(pathname)

    let data = {}
    if (pathname === '/api/auth/me') data = account
    else if (pathname === '/api/organizations') data = []
    else if (pathname.endsWith('/projects')) data = []
    else if (pathname.endsWith('/unread-count')) data = { count: 0 }
    else if (pathname.endsWith('/notifications')) data = { data: [], meta: {} }
    else if (pathname === '/api/admin/metrics/overview') data = metricsOverview
    else if (pathname === '/api/admin/metrics/scheduler') data = schedulerHealth
    else if (pathname === '/api/admin/metrics/tenants') data = tenantMetrics
    else if (pathname === '/api/admin/tenants') data = tenants
    else if (/^\/api\/admin\/tenants\/[^/]+\/toggle$/.test(pathname)) {
      const id = pathname.split('/')[4]
      const index = tenants.findIndex((tenant) => tenant.id === id)
      tenants[index] = { ...tenants[index], active: !tenants[index].active }
      data = tenants[index]
    } else if (pathname === '/api/admin/system-probes') {
      data = probeList
    } else if (pathname === '/api/admin/system-probes/rebalance') {
      data = { p1: ['o1', 'o2'], p2: ['o3'] }
    } else if (/^\/api\/admin\/system-probes\/[^/]+\/validate$/.test(pathname)) {
      data = {
        validationId: 'val-1',
        expiresAt: '2026-10-06T12:05:00.000Z',
        status: 'PENDING',
      }
    } else if (/^\/api\/admin\/system-probes\/[^/]+\/toggle$/.test(pathname)) {
      const id = pathname.split('/')[4]
      const index = probeList.findIndex((probe) => probe.id === id)
      probeList[index] = {
        ...probeList[index],
        enabled: !probeList[index].enabled,
      }
      data = probeList[index]
    } else if (pathname === '/api/admin/audit-logs') data = auditLogs
    else if (pathname === '/api/admin/orders')
      data = {
        items: orders,
        total: orders.length,
        page: 1,
        limit: 25,
        totalPages: 1,
      }
    else if (/^\/api\/admin\/orders\/[^/]+\/(cancel|mark-paid|refund)$/.test(pathname)) {
      const [, , , , id, action] = pathname.split('/')
      const next = { ...orders.find((order) => order.id === id) }
      if (action === 'cancel') {
        next.status = 'CANCELLED'
        next.cancelledAt = date
      } else if (action === 'mark-paid') {
        next.status = 'PAID'
        next.paidAt = date
      } else {
        next.status = 'REFUNDED'
      }
      orders = orders.map((order) => (order.id === id ? next : order))
      data = next
    }

    await route.fulfill({ json: { data } })
  })

  return { context, page, errors, orders: () => orders, adminRequests }
}

/** 等表格行数变为期望值（筛选 / 恢复都在前端重算，避免断言早于重渲染） */
async function waitRows(page, expected) {
  await page.waitForFunction(
    (count) => document.querySelectorAll('.admin-tenants__row').length === count,
    expected,
  )
}

/** 选择租户状态筛选：t-select 的选项在 body 下的浮层里 */
async function selectState(page, label) {
  await page.locator('.admin-tenants__filters .t-select').click()
  await page.locator('.t-select__dropdown li', { hasText: label }).last().click()
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
  await scenario('metrics', async (page, errors) => {
    await page.goto(`${origin}/admin`)
    await page.waitForSelector('.kpi__value')
    // 概览卡片：数值与大数字压缩
    assert.deepEqual(await page.locator('.kpi__value').allInnerTexts(), [
      '40',
      '200',
      '90',
      '320',
      '55',
      '180K',
      '3.2K',
      '12',
      '60',
    ])
    assert.match(await page.locator('.kpi__hint').first().innerText(), /36 活跃 \/ 4 已删除/)
    // 调度健康度：有到期未检测监控项 → 异常
    assert.equal(await page.locator('.admin-metrics__panel .t-tag').first().innerText(), '存在异常')
    assert.equal(await page.locator('.scheduler__queue').count(), 3)
    assert.match(await page.locator('.scheduler__row').innerText(), /monitor-checker/)
    assert.match(await page.locator('.scheduler__row').innerText(), /每 10s/)
    // 逐租户用量：2 行，关键词过滤生效
    assert.equal(await page.locator('.admin-metrics__row').count(), 2)
    await page.locator('.admin-metrics__search input').fill('globex')
    assert.equal(await page.locator('.admin-metrics__row').count(), 1)
    assert.equal(await page.locator('.admin-metrics__tenant-name').innerText(), 'Globex')
    await page.locator('.admin-metrics__search input').fill('')
    assert.equal(await page.locator('.admin-metrics__row').count(), 2)
    await page.screenshot({ path: join(output, 'metrics.png'), fullPage: true })
    assert.deepEqual(errors, [])
    results.push('平台指标页：KPI/调度健康度/逐租户用量与筛选通过')
  })

  await scenario('tenants', async (page, errors) => {
    await page.goto(`${origin}/admin/tenants`)
    await page.waitForSelector('.admin-tenants__row')
    assert.equal(await page.locator('.admin-tenants__row').count(), 2)
    // 状态标签：启用在前、已停用在后
    assert.deepEqual(await page.locator('.admin-tenants__row .t-tag').allInnerTexts(), [
      '已启用',
      '已停用',
    ])

    // 状态筛选：只看已停用（等表格重渲染后再断言）
    await selectState(page, '已停用')
    await waitRows(page, 1)
    assert.equal(await page.locator('.admin-tenants__name').innerText(), 'Globex')

    // 恢复：确认文案 → 该行不再属于「已停用」
    await page.locator('.admin-tenants__row').first().getByText('恢复').click()
    const dialog = page.locator('.t-dialog:visible').last()
    assert.match(await dialog.locator('.admin-tenants__confirm').innerText(), /恢复「Globex」/)
    await dialog.locator('.t-dialog__footer .t-button').last().click()
    await dialog.waitFor({ state: 'hidden' })
    await waitRows(page, 0)
    assert.match(await page.locator('.admin-tenants__empty').innerText(), /没有符合条件/)

    // 清空筛选：两行都回来，且恢复后的 Globex 变成「已启用」
    await selectState(page, '全部状态')
    await waitRows(page, 2)
    assert.deepEqual(await page.locator('.admin-tenants__row .t-tag').allInnerTexts(), [
      '已启用',
      '已启用',
    ])

    // 详情抽屉：显式点 Acme 那一行（清空筛选后首行是创建时间更晚的 Globex）
    await page
      .locator('.admin-tenants__row', { hasText: 'Acme Corporation' })
      .getByText('查看详情')
      .click()
    await page.waitForSelector('.tenant-detail')
    assert.match(await page.locator('.tenant-detail__name').innerText(), /Acme Corporation/)
    assert.match(await page.locator('.tenant-detail__info').innerText(), /acme-corp/)
    await page.screenshot({ path: join(output, 'tenants.png'), fullPage: true })
    assert.deepEqual(errors, [])
    results.push('租户管理页：状态筛选/恢复确认/详情抽屉通过')
  })

  await scenario('system-probes', async (page, errors) => {
    await page.goto(`${origin}/admin/system-probes`)
    await page.waitForSelector('.admin-probes__row')
    assert.equal(await page.locator('.admin-probes__row').count(), 2)
    // 供应商与存活文案：中文实际文案而非 i18n key（每行第 2 / 第 4 个单元格）
    assert.deepEqual(
      await page.locator('.admin-probes__row > span:nth-child(2) .t-tag').allInnerTexts(),
      ['腾讯云', '自建'],
    )
    assert.deepEqual(
      await page.locator('.admin-probes__row > span:nth-child(4) .t-tag').allInnerTexts(),
      ['在线', '离线'],
    )
    // 关键词筛选：区域
    await page.locator('.admin-probes__filters input').first().fill('frankfurt')
    assert.equal(await page.locator('.admin-probes__row').count(), 1)
    await page.locator('.admin-probes__filters input').first().fill('')
    // 新建弹窗：回调地址非法时报错且不发请求
    await page.locator('#layout-header-actions .t-button').last().click()
    const editor = page.locator('.t-dialog:visible').last()
    await editor.locator('input').nth(0).fill('')
    await editor.locator('.t-dialog__footer .t-button').last().click()
    await page.waitForSelector('.t-dialog:visible .t-alert')
    assert.match(await editor.locator('.t-alert').innerText(), /请填写必填项/)
    await editor.locator('.t-dialog__footer .t-button').first().click()
    // 联通校验弹窗
    await page.locator('.admin-probes__row').first().getByText('联通校验').click()
    await page.waitForSelector('.probe-validate')
    assert.match(await page.locator('.probe-validate').innerText(), /val-1/)
    await page.locator('.t-dialog:visible .t-dialog__close').last().click()
    // 重平衡弹窗
    await page.locator('#layout-header-actions .t-button').first().click()
    await page.waitForSelector('.probe-rebalance')
    assert.match(await page.locator('.probe-rebalance').innerText(), /Tokyo probe/)
    await page.screenshot({
      path: join(output, 'system-probes.png'),
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    results.push('系统探针页：存活标签/筛选/表单校验/校验与重平衡弹窗通过')
  })

  await scenario('audit-logs', async (page, errors) => {
    await page.goto(`${origin}/admin/audit-logs`)
    await page.waitForSelector('.admin-audit-logs__row')
    assert.equal(await page.locator('.admin-audit-logs__row').count(), 1)
    assert.equal(await page.locator('.admin-audit-logs__row .t-tag').innerText(), '更新')
    assert.match(await page.locator('.admin-audit-logs__entity-name').innerText(), /Project/)
    // 详情抽屉复用团队模块：字段级差异
    await page.locator('.admin-audit-logs__detail button').click()
    await page.waitForSelector('.audit-detail')
    const changes = page.locator('.audit-detail__row')
    assert.equal(await changes.count(), 1)
    assert.match(await changes.first().innerText(), /Old name/)
    assert.match(await changes.first().innerText(), /New name/)
    await page.screenshot({
      path: join(output, 'audit-logs.png'),
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    results.push('跨租户审计日志页：列表与详情差异抽屉通过')
  })

  await scenario('orders', async (page, errors) => {
    await page.goto(`${origin}/admin/orders`)
    await page.waitForSelector('.admin-orders__row')
    assert.equal(await page.locator('.admin-orders__row').count(), 2)
    assert.deepEqual(await page.locator('.admin-orders__row .t-tag').allInnerTexts(), [
      '待支付',
      '已支付',
    ])
    assert.match(
      await page.locator('.admin-orders__org-name').first().innerText(),
      /Acme Corporation/,
    )
    assert.match(await page.locator('.admin-orders__user-name').first().innerText(), /Ada Lovelace/)
    assert.equal(await page.locator('.admin-orders__amount').first().innerText(), '¥99.00')
    // 待支付订单提供「标记已支付 / 取消」，已支付订单只提供「标记已退款」
    const firstActions = page
      .locator('.admin-orders__row')
      .first()
      .locator('.admin-orders__actions')
    assert.match(await firstActions.innerText(), /标记已支付/)
    assert.match(await firstActions.innerText(), /取消订单/)
    const secondActions = page
      .locator('.admin-orders__row')
      .nth(1)
      .locator('.admin-orders__actions')
    assert.match(await secondActions.innerText(), /标记已退款/)
    assert.doesNotMatch(await secondActions.innerText(), /取消订单/)
    // 标记已支付：确认文案 + 状态就地翻转
    await firstActions.getByText('标记已支付').click()
    const dialog = page.locator('.t-dialog:visible').last()
    assert.match(await dialog.locator('.admin-orders__confirm').innerText(), /人工补单/)
    await dialog.locator('.t-dialog__footer .t-button').last().click()
    await page.waitForFunction(() =>
      document.querySelectorAll('.admin-orders__row .t-tag')[0]?.textContent?.includes('已支付'),
    )
    // 详情抽屉：已支付订单出现退款入口与退款说明
    await page.locator('.admin-orders__row').first().getByText('查看详情').click()
    await page.waitForSelector('.order-detail')
    assert.match(await page.locator('.order-detail').innerText(), /BW1A2B3C/)
    assert.match(await page.locator('.order-detail').innerText(), /¥99\.00/)
    assert.match(await page.locator('.order-detail__actions').innerText(), /标记已退款/)
    await page.screenshot({ path: join(output, 'orders.png'), fullPage: true })
    assert.deepEqual(errors, [])
    results.push('订单管理页：列表/操作权限/补单确认/详情抽屉通过')
  })

  // 非超管：只提示权限，不发起任何管理后台请求
  {
    const { context, page, errors, adminRequests } = await newPage(
      { width: 1440, height: 1000 },
      { ...superAdmin, globalRole: 'USER' },
    )
    try {
      await page.goto(`${origin}/admin/orders`)
      await page.waitForSelector('.admin-orders .t-alert')
      assert.match(await page.locator('.admin-orders .t-alert').innerText(), /超级管理员/)
      assert.equal(adminRequests.length, 0, '非超管不应请求管理后台接口')
      assert.deepEqual(errors, [])
      results.push('非超管访问 /admin/orders：只提示权限、不发起管理接口请求')
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ results }, null, 2))
