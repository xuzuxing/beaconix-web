import { test, expect } from '@playwright/test'
import { mockWorkspace } from './fixture'

async function healthy(state: Awaited<ReturnType<typeof mockWorkspace>>) {
  expect(state.unexpected).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.consoleErrors).toEqual([])
}

test('team admin creates a project from the header selector', async ({ page }) => {
  const state = await mockWorkspace(page, { owner: true })
  await page.goto('/monitor')

  await page.locator('.app-header__project').click()
  await page.locator('.project-list__action').click()

  const dialog = page.locator('.t-dialog').filter({ hasText: '项目标识' })
  await expect(dialog).toBeVisible()
  const inputs = dialog.locator('input')
  await inputs.nth(0).fill('Beacon Web')
  await expect(inputs.nth(1)).toHaveValue('BEACONWEB')
  await dialog.getByRole('button', { name: '确定' }).click()

  await expect(page.locator('.app-header__project-name')).toHaveText('Beacon Web')
  expect(
    state.requests.find(
      (request) => request.method === 'POST' && request.path === '/organizations/o1/projects',
    )?.body,
  ).toEqual({ name: 'Beacon Web', key: 'BEACONWEB' })

  await page.locator('.app-header__project').click()
  await expect(page.locator('.project-list__item').filter({ hasText: 'Beacon Web' })).toHaveClass(
    /is-active/,
  )
  await healthy(state)
})

test('members without organization admin rights get no create entry', async ({ page }) => {
  await mockWorkspace(page)
  await page.goto('/monitor')

  await page.locator('.app-header__project').click()
  await expect(page.locator('.project-list__item')).toHaveCount(2)
  await expect(page.locator('.project-list__action')).toHaveCount(0)
})
