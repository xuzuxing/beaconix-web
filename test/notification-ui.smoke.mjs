import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.NOTIFICATION_UI_URL ?? 'http://127.0.0.1:5174'
const output = resolve(process.env.NOTIFICATION_SCREENSHOT_DIR ?? 'test-results/notifications')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
})

try {
  for (const [name, width, height, theme] of [
    ['desktop', 1440, 1000, 'light'],
    ['mobile', 375, 812, 'light'],
    ['mobile-dark', 375, 812, 'dark'],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const failures = []
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text())
    })
    const user = {
      id: 'invitee',
      name: 'Notification QA',
      email: 'invitee@example.test',
      globalRole: 'USER',
    }
    await context.addInitScript(
      ({ user, theme }) => {
        localStorage.setItem(
          'beacon-vue3:user',
          JSON.stringify({
            accessToken: 'local-ui-test-token',
            refreshToken: '',
            user,
          }),
        )
        localStorage.setItem(
          'beacon-vue3:app',
          JSON.stringify({ locale: 'zh-CN', theme, collapsed: true }),
        )
      },
      { user, theme },
    )

    const org = {
      id: 'org',
      name: 'Beacon Notification QA',
      slug: 'qa',
      ownerId: 'owner',
    }
    const invites = ['accept', 'decline', 'expired'].map((kind) => ({
      id: `invite-${kind}`,
      email: user.email,
      organizationId: 'org',
      role: 'MEMBER',
      status: kind === 'expired' ? 'EXPIRED' : 'PENDING',
      expiresAt: kind === 'expired' ? '2020-01-01T00:00:00.000Z' : '2099-01-01T00:00:00.000Z',
      createdAt: '2026-10-11T00:00:00.000Z',
      updatedAt: '2026-10-11T00:00:00.000Z',
      organization: org,
      sentBy: { id: 'owner', name: 'Team Owner', email: 'owner@example.test' },
    }))
    const notices = invites.map((invite) => ({
      id: `notice-${invite.id}`,
      userId: user.id,
      type: 'INVITATION_RECEIVED',
      title: `Join Beacon (${invite.id})`,
      body: 'A team invitation needs your attention.',
      isRead: false,
      readAt: null,
      resourceType: 'Invitation',
      resourceId: invite.id,
      createdAt: invite.createdAt,
      meta: {
        organizationId: org.id,
        invitationStatus: invite.status,
        invitationExpiresAt: invite.expiresAt,
        actionable: invite.status === 'PENDING',
      },
    }))
    notices.push({
      ...notices[0],
      id: 'security-notice',
      type: 'PASSWORD_CHANGED',
      title: 'Your password was changed',
      body: 'Contact support if this was not you.',
      resourceType: 'User',
      resourceId: user.id,
      meta: {},
    })
    let joined = false
    let organizationLoads = 0
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname.replace(/^.*\/api/, '')
        let data = []
        if (path === '/notifications/stream') {
          return route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: `id: ${notices[0].id}\ndata: ${JSON.stringify(notices[0])}\n\nid: ${notices[0].id}\ndata: ${JSON.stringify(notices[0])}\n\n`,
          })
        }
        if (path === '/notifications/unread-count')
          data = { count: notices.filter((item) => !item.isRead).length }
        else if (path === '/notifications') {
          data = {
            data: notices.map((item) => {
              const invite = invites.find((entry) => entry.id === item.resourceId)
              return invite
                ? {
                    ...item,
                    meta: {
                      ...item.meta,
                      invitationStatus: invite.status,
                      actionable: invite.status === 'PENDING',
                    },
                  }
                : item
            }),
            meta: { total: notices.length, page: 1, limit: 20, totalPages: 1 },
          }
        } else if (path === '/invitations/pending')
          data = invites.filter((invite) => invite.status === 'PENDING')
        else if (path.startsWith('/invitations/by-id/')) {
          const [, id, action] =
            path.match(/^\/invitations\/by-id\/([^/]+)(?:\/(accept|decline))?$/) ?? []
          const invite = invites.find((entry) => entry.id === id)
          assert.ok(invite, `Unknown invitation ${path}`)
          if (request.method() === 'POST') {
            assert.equal(invite.status, 'PENDING')
            invite.status = action === 'accept' ? 'ACCEPTED' : 'DECLINED'
            if (action === 'accept') joined = true
          }
          data = invite
        } else if (path === '/organizations') {
          organizationLoads++
          data = joined ? [org] : []
        } else if (path.endsWith('/projects'))
          data = [{ id: 'project', name: 'QA', organizationId: org.id }]
        else if (path.endsWith('/subscription')) data = { effectivePlan: null, stack: [] }
        else if (path.endsWith('/read')) {
          const id = path.split('/')[2]
          data = notices.find((item) => item.id === id)
          if (data) data.isRead = true
        } else if (path.startsWith('/notifications/'))
          data = notices.find((item) => item.id === path.split('/')[2])
        else if (path.startsWith('/users/')) data = user
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data,
            meta: { timestamp: new Date().toISOString() },
          }),
        })
      },
    )

    await page.goto(`${base}/notifications`)
    const pending = page.getByRole('region', { name: '待处理邀请' })
    try {
      await pending.getByRole('button', { name: '接受', exact: true }).first().waitFor()
    } catch (error) {
      await page.screenshot({
        path: resolve(output, `${name}-failure.png`),
        fullPage: true,
      })
      console.error({
        url: page.url(),
        errors: failures,
        content: (await page.locator('body').innerText()).slice(0, 2500),
      })
      throw error
    }
    const expired = page
      .locator('.notice-page article')
      .filter({ hasText: 'Join Beacon (invite-expired)' })
      .first()
    await expired.getByText('已过期', { exact: true }).waitFor()
    assert.equal(await expired.getByRole('button', { name: '接受', exact: true }).count(), 0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (overflow) {
      await page.screenshot({
        path: resolve(output, `${name}-overflow.png`),
        fullPage: true,
      })
      console.error(
        await page.evaluate(() =>
          [...document.querySelectorAll('body *')]
            .flatMap((element) => {
              const rect = element.getBoundingClientRect()
              return rect.width > 0 && rect.right > innerWidth + 1
                ? [
                    {
                      tag: element.tagName,
                      class: element.className,
                      width: rect.width,
                      right: rect.right,
                    },
                  ]
                : []
            })
            .slice(0, 20),
        ),
      )
    }
    assert.equal(overflow, false, `${name}: horizontal overflow`)
    await page.screenshot({
      path: resolve(output, `${name}-pending.png`),
      fullPage: true,
    })
    await pending
      .locator('article')
      .first()
      .getByRole('button', { name: '接受', exact: true })
      .click()
    await page.waitForFunction(() => document.body.textContent.includes('已接受邀请'))
    assert.ok(joined)
    assert.ok(organizationLoads >= 2, 'Acceptance must refresh team membership')
    await pending
      .locator('article')
      .first()
      .getByRole('button', { name: '拒绝', exact: true })
      .click()
    await pending.getByText('暂无待处理邀请', { exact: true }).waitFor()
    await page.screenshot({
      path: resolve(output, `${name}-terminal.png`),
      fullPage: true,
    })
    const accepted = page
      .locator('.notice-page article')
      .filter({ hasText: 'Join Beacon (invite-accept)' })
      .first()
    await accepted.getByText('已接受', { exact: true }).waitFor()
    assert.equal(await accepted.getByRole('button', { name: '接受', exact: true }).count(), 0)
    assert.deepEqual(failures, [], `${name}: uncaught browser errors`)
    console.log(
      `${name}: invitation discovery, accept/decline, terminal states, layout and team refresh passed`,
    )
    await context.close()
  }
} finally {
  await browser.close()
}
