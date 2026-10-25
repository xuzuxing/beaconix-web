import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

vi.mock('@/api', () => ({ updateProfile: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { updateProfile } from '@/api'
import type { User } from '@/api/types'
import { useUserStore } from '@/stores'
import ProfileView from '@/views/account/ProfileView.vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { componentOptions } from '../fixtures/components'

const user = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'ada@example.test',
  name: 'Ada Lovelace',
  avatarUrl: null,
  globalRole: 'USER',
  isActive: true,
  emailVerified: true,
  lastSeenAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

/** 头像弹窗的替身：打开后提供一个「选中并确定」的按钮 */
const avatarDialog = defineComponent({
  props: ['visible', 'modelValue'],
  emits: ['saved', 'update:visible'],
  setup:
    (props, { emit }) =>
    () =>
      props.visible
        ? h(
            'button',
            {
              'data-avatar-saved': '',
              onClick: () => emit('saved', 'https://cdn.example.test/avatars/new.png'),
            },
            'pick avatar',
          )
        : null,
})

const slot = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})

function mountView() {
  const options = componentOptions()
  return mount(ProfileView, {
    global: {
      ...options,
      stubs: {
        ...options.stubs,
        TAvatar: slot,
        AvatarPickerDialog: avatarDialog,
      },
    },
  })
}

beforeEach(() => {
  vi.mocked(updateProfile).mockReset()
  vi.mocked(MessagePlugin.success).mockReset()
  setActivePinia(createPinia())
  useUserStore().setUser(user())
})

describe('ProfileView avatar', () => {
  it('头像区可以打开选择弹窗，并把选中的地址保存到后端', async () => {
    vi.mocked(updateProfile).mockResolvedValue(
      user({ avatarUrl: 'https://cdn.example.test/avatars/new.png' }),
    )
    const wrapper = mountView()

    expect(wrapper.find('[data-avatar-saved]').exists()).toBe(false)

    await wrapper.find('.profile__avatar-side button').trigger('click')
    await wrapper.find('[data-avatar-saved]').trigger('click')
    await flushPromises()

    expect(updateProfile).toHaveBeenCalledWith({
      avatarUrl: 'https://cdn.example.test/avatars/new.png',
    })
    expect(useUserStore().user?.avatarUrl).toBe('https://cdn.example.test/avatars/new.png')
    expect(MessagePlugin.success).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('保存失败时保留原头像且不提示成功', async () => {
    vi.mocked(updateProfile).mockRejectedValue(new Error('boom'))
    const wrapper = mountView()

    await wrapper.find('.profile__avatar-side button').trigger('click')
    await wrapper.find('[data-avatar-saved]').trigger('click')
    await flushPromises()

    expect(useUserStore().user?.avatarUrl).toBeNull()
    expect(MessagePlugin.success).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
