import { Menu, MenuItem, Submenu, Tag, Tooltip } from 'tdesign-vue-next'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import SideNav from '@/layouts/components/SideNav.vue'
import { useUserStore } from '@/stores'
import type { User } from '@/api/types'
import { componentOptions } from '../fixtures/components'

const routeState: { path: string; meta: Record<string, unknown>; query?: Record<string, string> } =
  {
    path: '/monitor/overview',
    meta: {},
  }

vi.mock('vue-router', () => ({ useRoute: () => routeState, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/utils/navigation-access', () => ({ canVisitNavigation: () => true }))

const user = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  avatarUrl: null,
  globalRole: 'USER',
  isActive: true,
  emailVerified: true,
  lastSeenAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as User

function mountNav() {
  const base = componentOptions()
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setUser(user)
  return mount(SideNav, {
    global: {
      plugins: [...base.plugins, pinia],
      components: {
        TMenu: Menu,
        TSubmenu: Submenu,
        TMenuItem: MenuItem,
        TTag: Tag,
        TTooltip: Tooltip,
      },
    },
  })
}

/** 侧边栏里的某个一级菜单项（按文案定位） */
function menuEntry(wrapper: ReturnType<typeof mountNav>, label: string) {
  return wrapper.findAll('li.t-menu__item').find((item) => item.text().trim() === label)
}

/** 点击某个一级菜单项时的导航目标 */
function menuTarget(wrapper: ReturnType<typeof mountNav>, label: string) {
  return wrapper
    .findAllComponents(MenuItem)
    .find((item) => item.text().trim() === label)
    ?.props('to')
}

beforeEach(() => {
  routeState.path = '/monitor/overview'
  routeState.meta = {}
  routeState.query = {}
})

describe('side nav', () => {
  it('shows cloud and frontend monitoring as separate primary entries', () => {
    routeState.path = '/rum/overview'
    const wrapper = mountNav()
    expect(menuEntry(wrapper, '前端监控')?.classes()).toContain('t-is-active')
    expect(menuEntry(wrapper, '云监控')).toBeDefined()
    expect(menuEntry(wrapper, '错误列表')).toBeUndefined()
    expect(menuEntry(wrapper, '通知渠道')).toBeDefined()
    expect(menuTarget(wrapper, '前端监控')).toBe('/rum/overview')
    expect(wrapper.find('.side-nav__products').exists()).toBe(false)
  })

  it('highlights frontend monitoring on app detail and legacy shared links do not hide cloud monitoring', () => {
    routeState.path = '/rum/p/a/errors/e'
    routeState.meta = { activeMenu: '/rum' }
    let wrapper = mountNav()
    expect(menuEntry(wrapper, '前端监控')?.classes()).toContain('t-is-active')
    wrapper.unmount()
    routeState.path = '/channels'
    routeState.meta = {}
    routeState.query = { product: 'rum' }
    wrapper = mountNav()
    expect(menuEntry(wrapper, '云监控')).toBeDefined()
    expect(menuEntry(wrapper, '前端监控')).toBeDefined()
  })
  it('子页面点亮它所属的一级菜单', () => {
    const wrapper = mountNav()
    const entry = menuEntry(wrapper, '云监控')

    expect(entry).toBeDefined()
    expect(entry!.classes()).toContain('t-is-active')
  })

  it('其它一级菜单不受影响', () => {
    const wrapper = mountNav()
    const entry = menuEntry(wrapper, '通知渠道')

    expect(entry).toBeDefined()
    expect(entry!.classes()).not.toContain('t-is-active')
  })

  it('详情页按 meta.activeMenu 点亮它所属的一级菜单', () => {
    routeState.path = '/monitor/1/2'
    routeState.meta = { activeMenu: '/monitor' }
    const wrapper = mountNav()

    expect(menuEntry(wrapper, '云监控')!.classes()).toContain('t-is-active')
  })

  it('菜单里没有对应项的路由不点亮任何一级菜单', () => {
    routeState.path = '/notifications/42'
    routeState.meta = { activeMenu: '/notifications' }
    const wrapper = mountNav()

    const active = wrapper
      .findAll('li.t-menu__item')
      .filter((item) => item.classes().includes('t-is-active'))
    expect(active).toHaveLength(0)
  })

  it('点击一级菜单进入它的第一个子页面', () => {
    const wrapper = mountNav()

    // 路由声明把 monitor/overview 排在 monitor 之前，二级菜单第一项就是「概览」
    expect(menuTarget(wrapper, '云监控')).toBe('/monitor/overview')
    expect(menuTarget(wrapper, '通知渠道')).toBe('/channels/overview')
  })

  it('二级菜单第一项是模块自身时保持原目标', () => {
    const wrapper = mountNav()

    // billing 声明在 billing/orders 之前
    expect(menuTarget(wrapper, '账单')).toBe('/billing')
  })

  it('没有子菜单的一级菜单直接进自己的页面', () => {
    const wrapper = mountNav()

    expect(menuTarget(wrapper, '概览')).toBe('/dashboard')
  })
})
