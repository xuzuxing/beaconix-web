import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

vi.mock('@/api', () => ({
  listMembers: vi.fn(),
  listOrganizations: vi.fn(),
  updateOrganization: vi.fn(),
  uploadAttachment: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { listMembers, listOrganizations, updateOrganization } from '@/api'
import type { Organization } from '@/api/types'
import { useOrganizationStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import TeamInfoView from '@/views/team/TeamInfoView.vue'
import { componentOptions } from '../fixtures/components'

const slot = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})

const textarea = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit, attrs }) =>
    () =>
      h('textarea', {
        ...attrs,
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      }),
})

const organization = (overrides: Partial<Organization> = {}): Organization => ({
  id: 'o1',
  name: 'Test Team',
  slug: 'test-team',
  description: null,
  logoUrl: 'https://cdn.example.test/old-logo.png',
  website: null,
  ownerId: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

/**
 * Logo 字段的替身：一个「预览框」，点一下就当作在弹窗里选好了一张图，
 * 通过 v-model 写回（真实的框 + 弹窗由 AvatarPickerField 自己的测试覆盖）。
 */
const avatarField = defineComponent({
  props: ['modelValue', 'directory', 'disabled'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h(
        'button',
        {
          'data-avatar-field': '',
          'data-directory': props.directory,
          disabled: props.disabled,
          onClick: () => emit('update:modelValue', 'https://cdn.example.test/teams/picked.png'),
        },
        props.modelValue ?? '',
      ),
})

function mountView() {
  const options = componentOptions()
  return mount(TeamInfoView, {
    global: {
      ...options,
      stubs: {
        ...options.stubs,
        TCard: slot,
        TTooltip: slot,
        TTextarea: textarea,
        HeaderActions: slot,
        TeamDangerSection: true,
        TeamOwnerTransferDialog: true,
        AvatarPickerField: avatarField,
      },
    },
  })
}

beforeEach(() => {
  vi.mocked(listMembers).mockReset().mockResolvedValue([])
  vi.mocked(listOrganizations).mockReset().mockResolvedValue([])
  vi.mocked(updateOrganization).mockReset()

  setActivePinia(createPinia())
  const orgStore = useOrganizationStore()
  orgStore.organizations = [organization()]
  orgStore.currentOrganizationId = 'o1'

  const permissions = usePermissionsStore()
  vi.spyOn(permissions, 'ensureOrganization').mockResolvedValue(null)
  vi.spyOn(permissions, 'canOrganization').mockReturnValue(true)
})

describe('TeamInfoView logo field', () => {
  it('Logo 只有一个入口：预览框字段，不再内嵌上传组件', async () => {
    const wrapper = mountView()
    await flushPromises()

    const fields = wrapper.findAll('[data-avatar-field]')
    expect(fields).toHaveLength(1)
    expect(fields[0]!.attributes('data-directory')).toBe('teams')
    // 内嵌的 ImageUploader（隐藏 file input）与随机按钮都已移除
    expect(wrapper.find('.team-info__form input[type="file"]').exists()).toBe(false)
    expect(wrapper.find('.team-info__random').exists()).toBe(false)

    wrapper.unmount()
  })

  it('把已有 Logo 回显到预览框', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-avatar-field]').text()).toBe('https://cdn.example.test/old-logo.png')

    wrapper.unmount()
  })

  it('在弹窗里选中新 Logo 后只提交变化了的 logoUrl', async () => {
    vi.mocked(updateOrganization).mockResolvedValue(organization())
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-avatar-field]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-avatar-field]').text()).toBe(
      'https://cdn.example.test/teams/picked.png',
    )

    await wrapper.find('.team-info__actions button').trigger('click')
    await flushPromises()

    expect(updateOrganization).toHaveBeenCalledWith('o1', {
      logoUrl: 'https://cdn.example.test/teams/picked.png',
    })

    wrapper.unmount()
  })

  it('没有 Logo 时预览框为空', async () => {
    const orgStore = useOrganizationStore()
    orgStore.organizations = [organization({ logoUrl: null })]
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-avatar-field]').text()).toBe('')

    wrapper.unmount()
  })
})
