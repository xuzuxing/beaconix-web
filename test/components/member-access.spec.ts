import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MemberInviteDialog from '@/components/team/MemberInviteDialog.vue'
import MemberProjectPermissionsDrawer from '@/components/team/MemberProjectPermissionsDrawer.vue'
import ProjectGrantSelector from '@/components/team/ProjectGrantSelector.vue'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  getMemberProjectPermissions,
  listProjects,
  replaceMemberProjectPermissions,
  sendInvitation,
} from '@/api'
import { ApiError } from '@/utils/request'
import { permissionEpoch } from '@/utils/access-context'
import { componentOptions } from '../fixtures/components'
import { ownerPermissions, project } from '../fixtures/access'

vi.mock('@/api', () => ({
  listProjects: vi.fn(),
  getMemberProjectPermissions: vi.fn(),
  replaceMemberProjectPermissions: vi.fn(),
  sendInvitation: vi.fn(),
}))
vi.mock('tdesign-vue-next', () => ({ MessagePlugin: { success: vi.fn(), error: vi.fn() } }))
const snapshot = {
  ...ownerPermissions,
  organizationRole: 'MEMBER' as const,
  accessMode: 'SELECTED_PROJECTS' as const,
  userId: 'u2',
  membershipId: 'member-old',
  projectPermissionsVersion: 7,
  projects: [
    {
      projectId: 'a',
      projectName: 'Project A',
      assignedRole: 'VIEWER' as const,
      effectiveRole: 'VIEWER' as const,
    },
  ],
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  const store = usePermissionsStore()
  store.organizations.o1 = { state: 'ready', data: ownerPermissions, error: '' }
  vi.spyOn(store, 'ensureOrganization').mockResolvedValue(ownerPermissions)
  vi.mocked(listProjects).mockResolvedValue([project('a'), project('b')])
  vi.mocked(getMemberProjectPermissions).mockResolvedValue(snapshot)
})
describe('explicit invitation scopes', () => {
  async function invite() {
    const wrapper = mount(MemberInviteDialog, {
      props: { visible: false, orgId: 'o1', members: [], invitations: [] },
      global: componentOptions(),
    })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    await wrapper.find('input').setValue('fixture@example.invalid')
    return wrapper
  }
  it('rejects an empty project selection before sending', async () => {
    const wrapper = await invite()
    await wrapper.find('[data-confirm]').trigger('click')
    expect(sendInvitation).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请选择 1 至 100')
    wrapper.unmount()
  })
  it('sends per-project roles, retaining a selection hidden by search', async () => {
    const wrapper = await invite()
    await wrapper.findAll('input[type=checkbox]')[0]!.setValue(true)
    await wrapper.findAll('select')[1]!.setValue('ADMIN')
    await wrapper.findAll('input')[1]!.setValue('Project B')
    await wrapper.find('input[type=checkbox]').setValue(true)
    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()
    expect(sendInvitation).toHaveBeenCalledWith('o1', {
      email: 'fixture@example.invalid',
      role: 'MEMBER',
      projects: [
        { projectId: 'a', role: 'ADMIN' },
        { projectId: 'b', role: 'VIEWER' },
      ],
    })
    wrapper.unmount()
  })
  it('caps viewer grants and discards admin-scope drafts', async () => {
    const wrapper = await invite()
    await wrapper.find('input[type=checkbox]').setValue(true)
    await wrapper.findAll('select')[1]!.setValue('ADMIN')
    await wrapper.find('select').setValue('VIEWER')
    expect(wrapper.findComponent(ProjectGrantSelector).props('modelValue')).toEqual([
      { projectId: 'a', role: 'VIEWER' },
    ])
    await wrapper.find('select').setValue('ADMIN')
    await wrapper.find('[data-confirm]').trigger('click')
    expect(sendInvitation).not.toHaveBeenCalled()
    await wrapper.find('input[type=checkbox]').setValue(true)
    await wrapper.find('[data-confirm]').trigger('click')
    await flushPromises()
    expect(sendInvitation).toHaveBeenCalledWith('o1', {
      email: 'fixture@example.invalid',
      role: 'ADMIN',
    })
    wrapper.unmount()
  })
  it('closes the teleported editor on permission changes', async () => {
    const wrapper = await invite()
    permissionEpoch.value++
    await flushPromises()
    expect(wrapper.emitted('update:visible')).toContainEqual([false])
    wrapper.unmount()
  })
  it.each(['too many', 'duplicate', 'unavailable'])('rejects %s project scopes', async (reason) => {
    const wrapper = await invite()
    const grants =
      reason === 'too many'
        ? Array.from({ length: 101 }, (_, index) => ({ projectId: `p${index}`, role: 'VIEWER' }))
        : reason === 'duplicate'
          ? [
              { projectId: 'a', role: 'VIEWER' },
              { projectId: 'a', role: 'ADMIN' },
            ]
          : [{ projectId: 'outside', role: 'VIEWER' }]
    wrapper.findComponent(ProjectGrantSelector).vm.$emit('update:modelValue', grants)
    await wrapper.find('[data-confirm]').trigger('click')
    expect(sendInvitation).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请选择 1 至 100')
    wrapper.unmount()
  })
})
describe('atomic member grant replacement', () => {
  async function drawer() {
    const wrapper = mount(MemberProjectPermissionsDrawer, {
      props: { visible: false, orgId: 'o1', userId: 'u2' },
      global: componentOptions(),
    })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    return wrapper
  }
  it('submits both membership and version preconditions', async () => {
    const wrapper = await drawer()
    await wrapper.findAll('input[type=checkbox]')[1]!.setValue(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存权限')!
      .trigger('click')
    await flushPromises()
    expect(replaceMemberProjectPermissions).toHaveBeenCalledWith('o1', 'u2', {
      expectedMembershipId: 'member-old',
      expectedVersion: 7,
      projects: [
        { projectId: 'a', role: 'VIEWER' },
        { projectId: 'b', role: 'VIEWER' },
      ],
    })
    wrapper.unmount()
  })
  it('requires a confirmation for explicit revoke-all', async () => {
    const wrapper = await drawer()
    await wrapper.find('input[type=checkbox]').setValue(false)
    expect(replaceMemberProjectPermissions).not.toHaveBeenCalled()
    await wrapper.find('[data-popconfirm]').trigger('click')
    await flushPromises()
    expect(replaceMemberProjectPermissions).toHaveBeenCalledWith(
      'o1',
      'u2',
      expect.objectContaining({ projects: [] }),
    )
    wrapper.unmount()
  })
  it('reloads a 409 without repeating the old PUT', async () => {
    const wrapper = await drawer()
    vi.mocked(replaceMemberProjectPermissions).mockRejectedValue(new ApiError('conflict', 409))
    vi.mocked(getMemberProjectPermissions).mockResolvedValue({
      ...snapshot,
      projectPermissionsVersion: 8,
      projects: [],
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存权限')!
      .trigger('click')
    await flushPromises()
    expect(getMemberProjectPermissions).toHaveBeenCalledTimes(2)
    expect(replaceMemberProjectPermissions).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('权限已被其他操作修改')
    expect(wrapper.text()).toContain('原草稿')
    expect(wrapper.find('[data-popconfirm]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('discards an ABA draft when the membership id changes', async () => {
    const wrapper = await drawer()
    vi.mocked(replaceMemberProjectPermissions).mockRejectedValue(new ApiError('conflict', 409))
    vi.mocked(getMemberProjectPermissions).mockResolvedValue({
      ...snapshot,
      membershipId: 'member-rejoined',
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存权限')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('旧草稿已作废')
    expect(wrapper.text()).not.toContain('原草稿')
    expect(replaceMemberProjectPermissions).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('preserves archived grants until explicitly removed', async () => {
    vi.mocked(listProjects).mockResolvedValue([project('a', 'ARCHIVED'), project('b')])
    const wrapper = await drawer()
    const save = wrapper.findAll('button').find((button) => button.text() === '保存权限')!
    expect(save.attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type=checkbox]').element).toHaveProperty('checked', true)
    await save.trigger('click')
    expect(replaceMemberProjectPermissions).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('blocks blind retries after an uncertain save result', async () => {
    const wrapper = await drawer()
    vi.mocked(replaceMemberProjectPermissions).mockRejectedValue(new Error('network interrupted'))
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存权限')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('结果尚未确认')
    expect(replaceMemberProjectPermissions).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-popconfirm]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('caps a stored ADMIN grant to VIEWER and shows the effective role', async () => {
    vi.mocked(getMemberProjectPermissions).mockResolvedValue({
      ...snapshot,
      organizationRole: 'VIEWER',
      projects: [
        {
          projectId: 'a',
          projectName: 'Project A',
          assignedRole: 'ADMIN',
          effectiveRole: 'VIEWER',
        },
      ],
    })
    const wrapper = await drawer()
    expect(wrapper.text()).toContain('当前有效角色')
    expect(wrapper.findComponent(ProjectGrantSelector).props('modelValue')).toEqual([
      { projectId: 'a', role: 'VIEWER' },
    ])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存权限')!
      .trigger('click')
    await flushPromises()
    expect(replaceMemberProjectPermissions).toHaveBeenCalledWith(
      'o1',
      'u2',
      expect.objectContaining({
        projects: [{ projectId: 'a', role: 'VIEWER' }],
      }),
    )
    wrapper.unmount()
  })
})
