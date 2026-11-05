import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  RUM_APP_DEFAULT_SECTION,
  RUM_APP_NAV,
  RUM_APP_SECTIONS,
  normalizeRumAppSection,
} from '@/config/rum-app-nav'
import { layoutChildren } from '@/router/routes'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', children: layoutChildren }],
  })
}

/**
 * 旧链接重定向是路由记录上的 redirect 函数：直接调用它比发起真实导航更轻，
 * 避免单元测试环境加载整棵布局/视图依赖。
 */
function redirectFromLegacyPath(params: Record<string, string>, query: Record<string, string> = {}) {
  const record = layoutChildren.find((route) => route.name === 'rum-app-detail')
  const redirect = record?.redirect as unknown as
    | ((to: { params: Record<string, string>; query: Record<string, string> }) => {
        name?: string
        params: Record<string, string>
        query: Record<string, string>
      })
    | undefined
  if (typeof redirect !== 'function') throw new Error('rum-app-detail must redirect')
  return redirect({ params, query })
}

describe('RUM application workspace navigation', () => {
  it('gives every application page its own address', () => {
    const router = createTestRouter()
    for (const section of RUM_APP_SECTIONS) {
      const resolved = router.resolve(`/rum/p1/a1/${section}`)
      expect(resolved.name).toBe('rum-app-section')
      expect(resolved.params).toMatchObject({ projectId: 'p1', appId: 'a1', section })
      expect(resolved.meta.rumAppScoped).toBe(true)
    }
  })

  it('keeps links that still carry the old ?tab= parameter working', () => {
    const target = redirectFromLegacyPath({ projectId: 'p1', appId: 'a1' }, { tab: 'performance' })
    expect(target.name).toBe('rum-app-section')
    expect(target.params).toEqual({ projectId: 'p1', appId: 'a1', section: 'performance' })
    expect(target.query.tab).toBeUndefined()
  })

  it('maps the removed error overview tab onto the errors page', () => {
    const target = redirectFromLegacyPath({ projectId: 'p1', appId: 'a1' }, { tab: 'error-overview' })
    expect(target.params.section).toBe('errors')
    expect(normalizeRumAppSection('error-overview')).toBe('errors')
  })

  it('falls back to the default page when no tab is given', () => {
    expect(redirectFromLegacyPath({ projectId: 'p1', appId: 'a1' }).params.section).toBe(
      RUM_APP_DEFAULT_SECTION,
    )
    expect(normalizeRumAppSection(undefined)).toBe(RUM_APP_DEFAULT_SECTION)
    expect(normalizeRumAppSection('unknown-section')).toBe(RUM_APP_DEFAULT_SECTION)
  })

  it('keeps the rest of the query so filters survive the round trip', () => {
    const target = redirectFromLegacyPath(
      { projectId: 'p1', appId: 'a1' },
      { tab: 'errors', errorSearch: 'checkout', errorPage: '2' },
    )
    expect(target.query).toEqual({ errorSearch: 'checkout', errorPage: '2' })
  })

  it('keeps project-level pages outside the application workspace', () => {
    const router = createTestRouter()
    // 概览/错误/事件是跨应用查询：保留路由但入口收在应用卡片列表页顶部，不进左侧菜单
    for (const path of ['/rum/overview', '/rum/errors', '/rum/events']) {
      const resolved = router.resolve(path)
      expect(resolved.meta.rumAppScoped).toBeUndefined()
      expect(resolved.meta.menuExcluded).toBe(true)
    }
    // 一级入口自身就是应用卡片列表，不属于应用工作台
    const entry = router.resolve('/rum')
    expect(entry.name).toBe('rum-apps')
    expect(entry.meta.rumAppScoped).toBeUndefined()
    expect(entry.meta.menuExcluded).toBeUndefined()
  })

  it('declares every application section in the navigation order', () => {
    expect(RUM_APP_NAV.map((item) => item.section)).toEqual([...RUM_APP_SECTIONS])
  })
})
