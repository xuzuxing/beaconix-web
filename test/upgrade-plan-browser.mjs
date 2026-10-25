import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UPGRADE_BROWSER_URL || 'http://127.0.0.1:5173'
const output = resolve('test/artifacts/upgrade')
await mkdir(output, { recursive: true })
const date = '2026-10-11T00:00:00+08:00'
const makePlan = (id, name, sortOrder, extra = {}) => ({
  id,
  code: id.toUpperCase(),
  name,
  sortOrder,
  description: 'For production services and growing teams.',
  price: 2900,
  durationDays: 30,
  maxMonitors: 50,
  maxProbes: 5,
  maxMembers: 10,
  maxChannels: 5,
  minInterval: 60,
  allowTenantProbe: true,
  allowStatusPage: false,
  enabled: true,
  createdAt: date,
  updatedAt: date,
  ...extra,
})
const free = makePlan('free', 'Free', 0, { price: 0 })
const standard = makePlan('standard', 'Standard', 1)
const professional = makePlan('pro', 'Professional', 2, {
  price: 9900,
  durationDays: 90,
  maxMonitors: 200,
  allowStatusPage: true,
})
const enterprise = makePlan('enterprise', 'Team', 3, {
  code: 'TEAM',
  price: 29900,
  maxMonitors: 1000,
})
const hidden = makePlan('disabled', 'Disabled plan', 4, { enabled: false })
const plans = [enterprise, free, professional, hidden]
const quota = {
  plan: free,
  resources: Object.fromEntries(
    ['monitors', 'probes', 'members', 'channels', 'apiKeys'].map((key) => [
      key,
      { used: 1, limit: 10, percent: 10 },
    ]),
  ),
  features: { allowTenantProbe: false, allowStatusPage: false },
  minInterval: 60,
}
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
})
const results = []

function contrastRatio(color, background) {
  const rgba = (value) => value.match(/[\d.]+/g).map(Number)
  const bg = rgba(background)
  const fg = rgba(color)
  const alpha = fg[3] ?? 1
  const blended = fg.slice(0, 3).map((channel, index) => channel * alpha + bg[index] * (1 - alpha))
  const luminance = (rgb) =>
    rgb.slice(0, 3).reduce((sum, channel, index) => {
      const value = channel / 255
      const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      return sum + linear * [0.2126, 0.7152, 0.0722][index]
    }, 0)
  const values = [luminance(blended), luminance(bg)].sort((left, right) => right - left)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

try {
  for (const scenario of [
    { width: 1440, height: 1000, locale: 'zh-CN', theme: 'light' },
    { width: 375, height: 812, locale: 'zh-CN', theme: 'light' },
    { width: 812, height: 375, locale: 'zh-CN', theme: 'light' },
    { width: 375, height: 812, locale: 'en-US', theme: 'dark' },
  ]) {
    const { width, height, locale, theme } = scenario
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    let catalog = plans
    let currentPlan = free
    let releaseOrder
    let releasePlans
    let holdPlans = false
    const orders = []
    await page.addInitScript(
      ({ locale, theme }) => {
        localStorage.setItem(
          'beacon-vue3:user',
          JSON.stringify({
            accessToken: 'upgrade-browser-test-only',
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
          JSON.stringify({
            currentOrganizationId: 'o1',
            currentProjectId: 'p1',
          }),
        )
        localStorage.setItem('beacon-vue3:app', JSON.stringify({ locale, theme, collapsed: false }))
      },
      { locale, theme },
    )
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const { pathname } = new URL(request.url())
      if (!pathname.startsWith('/api/')) return route.continue()
      let data = []
      if (pathname === '/api/organizations') {
        data = [{ id: 'o1', name: 'Test Team', slug: 'test-team', createdAt: date }]
      } else if (pathname.endsWith('/projects')) {
        data = [{ id: 'p1', name: 'Production', key: 'PROD' }]
      } else if (pathname.endsWith('/subscription')) {
        data = { effectivePlan: currentPlan, stack: [] }
      } else if (pathname === '/api/plans') {
        if (holdPlans)
          await new Promise((resolve) => {
            releasePlans = resolve
          })
        data = catalog
      } else if (pathname.endsWith('/quota')) {
        data = quota
      } else if (pathname.endsWith('/orders') && request.method() === 'POST') {
        const body = request.postDataJSON()
        orders.push(body)
        await new Promise((resolve) => {
          releaseOrder = resolve
        })
        data = {
          id: 'order1',
          orderNo: 'TEST-001',
          organizationId: 'o1',
          planId: body.planId,
          userId: 'u1',
          amount: 9900,
          currency: 'CNY',
          durationDays: body.durationDays,
          status: 'PENDING',
          paidAt: null,
          cancelledAt: null,
          expiresAt: date,
          createdAt: date,
          updatedAt: date,
        }
      }
      await route.fulfill({ json: { data } })
    })

    const suffix = `${width}x${height}-${locale}-${theme}`
    const open = async () => {
      try {
        await page.locator('.package__actions .t-button').first().click()
      } catch (error) {
        await page.screenshot({
          path: `${output}/${suffix}-failure.png`,
          fullPage: true,
        })
        console.error(
          JSON.stringify({
            url: page.url(),
            errors,
            body: await page.locator('body').innerText(),
          }),
        )
        throw error
      }
      await page.locator('.upgrade-dialog').waitFor({ state: 'visible' })
    }
    const option = (name) => page.getByRole('radio', { name, exact: true })
    const card = (name) =>
      dialog
        .locator('.upgrade__card')
        .filter({ has: page.getByRole('heading', { name, exact: true }) })
    const heading = (name) => card(name).locator('.upgrade__card-head')
    const dialog = page.locator('.upgrade-dialog')
    const pay = dialog.locator('.upgrade__buttons .t-button').last()
    const cancel = dialog.locator('.upgrade__buttons .t-button').first()
    const input = dialog.locator('.upgrade__custom input')

    await page.goto(`${origin}/billing`)
    await open()
    assert.deepEqual(await dialog.locator('.upgrade__card-name').allTextContents(), [
      'Free',
      'Professional',
      'Team',
    ])
    assert.equal(await dialog.locator('.upgrade__plans').getByRole('radio').count(), 2)
    assert.equal(await card('Free').locator('button').count(), 0)
    assert.equal(await option('Professional').getAttribute('aria-checked'), 'true')
    assert.equal(
      await card('Free').locator('.t-tag').innerText(),
      locale === 'zh-CN' ? '当前套餐' : 'Current plan',
    )
    const background = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor)
    const freeBackground = await background(page.locator('.app-header__team-tag'))
    const proBackground = await background(heading('Professional'))
    const teamBackground = await background(heading('Team'))
    assert.equal(new Set([freeBackground, proBackground, teamBackground]).size, 3)
    assert.ok(
      [freeBackground, proBackground, teamBackground].every(
        (color) => color !== 'rgba(0, 0, 0, 0)',
      ),
    )
    assert.equal(await background(page.locator('.package__name')), freeBackground)
    assert.equal(await background(heading('Free')), freeBackground)
    for (const label of [
      page.locator('.app-header__team-tag'),
      ...['Free', 'Professional', 'Team'].map(heading),
    ]) {
      const palette = await label.evaluate((el) => ({
        text: getComputedStyle(el.querySelector('.upgrade__card-name') || el).color,
        background: getComputedStyle(el).backgroundColor,
      }))
      assert.ok(contrastRatio(palette.text, palette.background) >= 4.5, JSON.stringify(palette))
    }
    const cardBackground = await background(card('Free'))
    assert.ok(cardBackground !== freeBackground)
    for (const name of ['Free', 'Professional', 'Team']) {
      assert.equal(await card(name).locator('.upgrade__ability').count(), 7)
      assert.equal(await background(card(name)), cardBackground)
      assert.match(
        await heading(name).evaluate((el) => getComputedStyle(el).backgroundImage),
        /linear-gradient/,
      )
    }
    await option('Team').click()
    assert.equal(await card('Team').locator('.upgrade__selected').count(), 1)
    await page.screenshot({ path: `${output}/${suffix}-team.png` })
    await option('Team').press('ArrowRight')
    assert.equal(await option('Professional').getAttribute('aria-checked'), 'true')
    await option('Professional').press('End')
    assert.equal(await option('Team').getAttribute('aria-checked'), 'true')
    await option('Team').press('Home')
    assert.equal(await option('Professional').getAttribute('aria-checked'), 'true')
    assert.equal(await input.inputValue(), '90')
    assert.equal(await dialog.locator('.upgrade__total').innerText(), '\u00a599.00')
    await dialog
      .locator('.upgrade__duration-options')
      .getByText(locale === 'zh-CN' ? '180 天' : '180 days', { exact: true })
      .click()
    assert.equal(await input.inputValue(), '180')
    await input.fill('45')
    await input.press('Tab')
    assert.equal(await input.inputValue(), '45')
    // The billing contract charges plan.price, regardless of durationDays.
    assert.equal(await dialog.locator('.upgrade__total').innerText(), '\u00a599.00')
    await dialog.locator('.t-dialog__body').evaluate((el) => {
      el.scrollTop = 0
    })
    await page.screenshot({ path: `${output}/${suffix}.png` })
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height + 1)
    const overflow = await dialog.evaluate((el) => ({
      dialog: el.scrollWidth > el.clientWidth + 1,
      body:
        el.querySelector('.t-dialog__body').scrollWidth >
        el.querySelector('.t-dialog__body').clientWidth + 1,
    }))
    assert.deepEqual(overflow, { dialog: false, body: false })
    const buttonBounds = await pay.boundingBox()
    assert.ok(buttonBounds.y >= 0 && buttonBounds.y + buttonBounds.height <= height + 1)
    if (width <= 600) assert.ok(buttonBounds.height >= 44)
    if (height < 900) {
      await dialog.locator('.t-dialog__body').evaluate((el) => {
        el.scrollTop = el.scrollHeight
      })
      await page.screenshot({ path: `${output}/${suffix}-bottom.png` })
    }

    await input.fill('')
    assert.equal(await pay.isDisabled(), true)
    await input.fill('45')
    await input.press('Tab')
    assert.equal(await pay.isDisabled(), false)
    await pay.click()
    await page.waitForFunction(
      () => document.querySelector('.upgrade__buttons .t-button')?.disabled,
    )
    assert.equal(await cancel.isDisabled(), true)
    assert.equal(await option('Professional').isDisabled(), true)
    assert.equal(await option('Team').isDisabled(), true)
    assert.equal(await input.isDisabled(), true)
    await page.keyboard.press('Escape')
    assert.equal(await dialog.isVisible(), true)
    assert.deepEqual(orders, [{ planId: 'pro', durationDays: 45 }])
    releaseOrder()
    await dialog.waitFor({ state: 'hidden' })

    catalog = [...plans, standard]
    currentPlan = standard
    await page.reload()
    await open()
    assert.equal(await dialog.locator('.upgrade__plans').getByRole('radio').count(), 3)
    assert.deepEqual(await dialog.locator('.upgrade__card-name').allTextContents(), [
      'Free',
      'Standard',
      'Professional',
      'Team',
    ])
    assert.equal(
      await dialog.locator('.t-tag').innerText(),
      locale === 'zh-CN' ? '当前套餐' : 'Current plan',
    )
    assert.equal(await background(page.locator('.app-header__team-tag')), proBackground)
    assert.equal(await background(page.locator('.package__name')), proBackground)
    await cancel.click()

    if (width === 1440) {
      for (const plan of [free, professional, enterprise]) {
        currentPlan = plan
        await page.reload()
        await page.locator('.package__name').getByText(plan.name, { exact: true }).waitFor()
        const tierBackground = await background(page.locator('.app-header__team-tag'))
        assert.equal(await background(page.locator('.package__name')), tierBackground)
        await page.locator('.app-header__team').hover()
        const popupTag = page.locator('.team-card .beacon-plan-badge')
        await popupTag.waitFor({ state: 'visible' })
        assert.equal(await background(popupTag), tierBackground)
        await page.waitForTimeout(250)
        await page.screenshot({
          path: `${output}/${suffix}-badge-${plan.code.toLowerCase()}.png`,
        })
        await page.mouse.move(0, 0)
      }
      currentPlan = standard
      await page.reload()
      await open()
      catalog = []
      // Refresh the catalog while the dialog remains open.
      await page.locator('.usage__bar .t-button').evaluate((el) => el.click())
      await dialog.locator('.upgrade__empty').waitFor({ state: 'visible' })
      assert.equal(await pay.isDisabled(), true)
      assert.ok((await dialog.locator('.upgrade__empty').innerText()).includes('暂无可购买的套餐'))
      await page.screenshot({ path: `${output}/${suffix}-empty.png` })
      catalog = plans
      holdPlans = true
      await page.locator('.usage__bar .t-button').evaluate((el) => el.click())
      await page.getByText('正在加载套餐…', { exact: true }).waitFor()
      assert.equal(await pay.isDisabled(), true)
      await page.screenshot({ path: `${output}/${suffix}-loading.png` })
      holdPlans = false
      releasePlans()
      await option('Professional').waitFor({ state: 'visible' })
      assert.equal(await pay.isDisabled(), false)
      catalog = [free]
      await page.locator('.usage__bar .t-button').evaluate((el) => el.click())
      await dialog.locator('.upgrade__empty').waitFor({ state: 'visible' })
      assert.equal(await dialog.locator('.upgrade__card-name').innerText(), 'Free')
      assert.equal(await dialog.locator('.upgrade__plans').getByRole('radio').count(), 0)
      assert.equal(await pay.isDisabled(), true)
      assert.equal(orders.length, 1)
    }
    assert.deepEqual(errors, [])
    results.push({ ...scenario, bounds, orders: orders.length, errors })
    await context.close()
  }
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
