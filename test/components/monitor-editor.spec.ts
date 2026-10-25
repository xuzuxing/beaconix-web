import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, type PropType } from 'vue'

vi.mock('@/api', () => ({
  listRuleGroups: vi.fn(),
  listMonitorRuleBindings: vi.fn(),
  listNotificationChannels: vi.fn(),
  bindRuleGroup: vi.fn(),
  unbindRuleGroup: vi.fn(),
  createMonitor: vi.fn(),
  updateMonitor: vi.fn(),
}))
// 权限 store 直接 import 模块文件，保存前的 ensureProject 会走到这里
vi.mock('@/api/modules/permissions', () => ({
  getProjectPermissions: vi.fn(),
  getOrganizationPermissions: vi.fn(),
}))
vi.mock('@/composables/useProjectAccess', () => ({
  useProjectAccess: () => ({ canManage: computed(() => true) }),
}))
vi.mock('tdesign-vue-next', () => ({
  MessagePlugin: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import {
  listMonitorRuleBindings,
  listNotificationChannels,
  listRuleGroups,
  updateMonitor,
} from '@/api'
import { getProjectPermissions } from '@/api/modules/permissions'
import type { Monitor } from '@/api/types'
import type { NotificationChannel } from '@/api/types/notification'
import type { RuleGroup } from '@/api/types/rule'
import MonitorEditorDialog from '@/components/monitor/MonitorEditorDialog.vue'
import { createI18n } from 'vue-i18n'

const tree = {
  type: 'logic' as const,
  id: 'root',
  operator: 'and' as const,
  children: [
    {
      type: 'condition' as const,
      id: 'c1',
      field: 'httpStatus' as const,
      operator: 'eq' as const,
      value: 200,
    },
    {
      type: 'condition' as const,
      id: 'c2',
      field: 'responseTimeMs' as const,
      operator: 'gt' as const,
      value: 3000,
    },
  ],
}

const group = {
  id: 'g1',
  organizationId: 'o1',
  projectId: null,
  name: 'HTTP 基础检查',
  description: null,
  enabled: true,
  tree,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as RuleGroup

/** 组织下的两个通知渠道，其中一个已停用 */
const channelList = [
  {
    id: 'ch1',
    organizationId: 'o1',
    type: 'FEISHU',
    name: '值班飞书群',
    config: {},
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ch2',
    organizationId: 'o1',
    type: 'EMAIL',
    name: '值班邮箱',
    config: {},
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
] as unknown as NotificationChannel[]

const monitor = {
  id: 'm1',
  projectId: 'p1',
  organizationId: 'o1',
  name: '首页',
  type: 'HTTP',
  target: 'https://example.test',
  interval: 60,
  timeout: 5000,
  expectedStatus: 200,
  failureThreshold: 3,
  enabled: true,
  checkSsl: false,
  sslExpiryThreshold: 30,
  availabilityThreshold: 90,
  availabilityWindow: 10,
  notificationChannelIds: ['ch1'],
  config: {},
} as unknown as Monitor

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {} },
})

/** 弹窗替身：渲染默认插槽，并给出一条可点击的「确定」用于触发保存 */
const dialogStub = defineComponent({
  emits: ['confirm'],
  setup:
    (_, { slots, emit }) =>
    () =>
      h('div', { class: 'dialog' }, [
        slots.default?.(),
        h('button', { class: 'dialog-confirm', onClick: () => emit('confirm') }, 'ok'),
      ]),
})

/** 协议配置表单替身：save() 会调用它的 validate / buildConfig / isDirty */
const configFormStub = defineComponent({
  setup: () => ({
    buildConfig: () => ({}),
    validate: () => '',
    isDirty: () => false,
  }),
  render: () => null,
})

/** 多选替身：暴露当前选中值，点击即追加一个渠道（模拟用户改选） */
const selectStub = defineComponent({
  props: {
    modelValue: { type: Array as PropType<string[]>, default: () => [] },
  },
  emits: ['update:modelValue'],
  inheritAttrs: false,
  setup:
    (props, { attrs, emit }) =>
    () =>
      h('div', {
        class: 'select',
        'data-placeholder': attrs.placeholder,
        'data-value': props.modelValue.join(','),
        onClick: () => emit('update:modelValue', [...props.modelValue, 'ch2']),
      }),
})

function mountEditor() {
  return mount(MonitorEditorDialog, {
    props: { visible: false, projectId: 'p1', monitor },
    global: {
      plugins: [i18n],
      stubs: {
        't-dialog': dialogStub,
        't-select': selectStub,
        't-form': { template: '<form><slot /></form>' },
        't-form-item': { template: '<div><slot /></div>' },
        't-alert': true,
        't-input': true,
        't-input-number': true,
        't-switch': true,
        't-button': true,
        't-loading': true,
        't-tag': true,
        MonitorConfigForm: configFormStub,
        RuleGroupEditorDialog: true,
      },
    },
  })
}

/** 弹窗打开（visible: false → true）时才加载规则组绑定与通知渠道 */
async function openEditor() {
  const wrapper = mountEditor()
  await wrapper.setProps({ visible: true })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('monitor editor rules and channels', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listRuleGroups).mockResolvedValue([group])
    vi.mocked(listMonitorRuleBindings).mockResolvedValue([
      {
        id: 'b1',
        monitorId: 'm1',
        ruleGroupId: 'g1',
        priority: 0,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ruleGroup: group,
      },
    ])
    vi.mocked(listNotificationChannels).mockResolvedValue(channelList)
    vi.mocked(updateMonitor).mockResolvedValue(monitor)
    vi.mocked(getProjectPermissions).mockResolvedValue({
      projectId: 'p1',
      organizationId: 'o1',
      organizationRole: 'ADMIN',
      membershipId: 'ms1',
      projectPermissionsVersion: 1,
      accessMode: 'ALL_PROJECTS',
      assignedRole: 'ADMIN',
      effectiveRole: 'ADMIN',
      capabilities: {
        'monitor.read': true,
        'monitor.check': true,
        'monitor.manage': true,
        'monitor.test-alert': true,
        'rule.manage': true,
      },
    })
  })

  // 编辑监控时，已绑定的规则组要按结构回显（逻辑组层级 + 每一条规则），而不是一行摘要
  it('echoes bound rule groups as a structured tree, not a one-line summary', async () => {
    const wrapper = await openEditor()
    const html = wrapper.html()
    expect(html).not.toContain('rule-view__summary')
    expect(html).toContain('editor-rule__tree')
    expect(html).toContain('rule-view__root-hint')
  })

  // 兜底渠道的多选回显 monitor.notificationChannelIds，并列出组织下的渠道
  it('echoes bound notification channels in a multi select', async () => {
    const wrapper = await openEditor()
    const select = wrapper.find('[data-placeholder="monitorPage.channelsPlaceholder"]')
    expect(select.exists()).toBe(true)
    expect(select.attributes('data-value')).toBe('ch1')
    expect(wrapper.text()).toContain('monitorPage.boundChannels')
    expect(vi.mocked(listNotificationChannels)).toHaveBeenCalledWith('o1')
  })

  // 未改选时保存不提交该字段，避免用同一份数组覆盖后端已有绑定
  it('keeps the channel binding untouched when nothing changed', async () => {
    const wrapper = await openEditor()
    await wrapper.find('.dialog-confirm').trigger('click')
    await flushPromises()
    const changes = vi.mocked(updateMonitor).mock.calls[0]![2]
    expect(changes).not.toHaveProperty('notificationChannelIds')
  })

  // 改选后保存按新集合整体提交
  it('submits the selected channel ids as a whole set', async () => {
    const wrapper = await openEditor()
    const select = wrapper.find('[data-placeholder="monitorPage.channelsPlaceholder"]')
    await select.trigger('click')
    await wrapper.find('.dialog-confirm').trigger('click')
    await flushPromises()
    const changes = vi.mocked(updateMonitor).mock.calls[0]![2]
    expect(changes.notificationChannelIds).toEqual(['ch1', 'ch2'])
  })
})
