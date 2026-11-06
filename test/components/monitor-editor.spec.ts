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
  getMonitor: vi.fn(),
  getQuotaSummary: vi.fn(),
}))
// 探针候选项走独立的 probe 模块（useProbeList 内部调用）
vi.mock('@/api/modules/probe', () => ({
  listProbes: vi.fn(),
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
  getMonitor,
  getQuotaSummary,
  listMonitorRuleBindings,
  listNotificationChannels,
  listRuleGroups,
  updateMonitor,
} from '@/api'
import { listProbes } from '@/api/modules/probe'
import { getProjectPermissions } from '@/api/modules/permissions'
import type { Monitor } from '@/api/types'
import type { QuotaSummary } from '@/api/types/billing'
import type { NotificationChannel } from '@/api/types/notification'
import type { RuleGroup } from '@/api/types/rule'
import MonitorEditorForm from '@/components/monitor/MonitorEditorForm.vue'
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

/** 监控列表项：列表接口不返回 probes，表单需要补一次详情 */
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

/** 监控详情：带一条已绑定的租户探针 */
const monitorDetail = {
  ...monitor,
  probeSuccessRatio: 100,
  tenantProbesOnly: false,
  maxProbes: 3,
  probes: [
    {
      id: 'pr1',
      name: '东京探针',
      provider: 'TENCENT',
      region: 'ap-northeast-1',
      status: 'ONLINE',
      enabled: true,
      lastHeartbeat: '2026-01-01T00:00:00.000Z',
    },
  ],
} as unknown as Monitor

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {} },
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

/** 多选替身：暴露当前选中值，点击即追加一个渠道（模拟用户改选；单选下拉按字符串透传） */
const selectStub = defineComponent({
  props: {
    modelValue: {
      type: [Array, String] as PropType<string[] | string>,
      default: () => [],
    },
  },
  emits: ['update:modelValue'],
  inheritAttrs: false,
  setup:
    (props, { attrs, emit }) =>
    () =>
      h('div', {
        class: 'select',
        'data-placeholder': attrs.placeholder,
        'data-value': Array.isArray(props.modelValue)
          ? props.modelValue.join(',')
          : String(props.modelValue ?? ''),
        onClick: () =>
          emit(
            'update:modelValue',
            Array.isArray(props.modelValue) ? [...props.modelValue, 'ch2'] : 'ch2',
          ),
      }),
})

/** 折叠替身：暴露当前展开的面板值，同时渲染面板内容（具名 header 插槽由面板替身忽略） */
const collapseStub = defineComponent({
  props: {
    modelValue: { type: Array as PropType<string[]>, default: () => [] },
  },
  setup:
    (props, { slots }) =>
    () =>
      h('div', { class: 'collapse', 'data-active': props.modelValue.join(',') }, slots.default?.()),
})

function mountForm(monitorProp: Monitor | null = monitor) {
  return mount(MonitorEditorForm, {
    props: { projectId: 'p1', monitor: monitorProp ?? undefined },
    global: {
      plugins: [i18n],
      stubs: {
        't-select': selectStub,
        't-collapse': collapseStub,
        't-collapse-panel': { template: '<div><slot /></div>' },
        't-form': { template: '<form><slot /></form>' },
        't-form-item': { template: '<div><slot /></div>' },
        't-card': { template: '<div><slot /></div>' },
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

/** 表单在挂载时（props.monitor 的 immediate watch）完成回显与依赖加载 */
async function openForm(monitorProp: Monitor | null = monitor) {
  const wrapper = mountForm(monitorProp)
  await flushPromises()
  await nextTick()
  return wrapper
}

/** 单页模式下保存由页面顶栏按钮触发，走 defineExpose 暴露的 submit() */
async function submit(wrapper: Awaited<ReturnType<typeof openForm>>) {
  await (wrapper.vm as unknown as { submit: () => Promise<void> }).submit()
  await flushPromises()
}

describe('monitor editor form', () => {
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
    vi.mocked(getMonitor).mockResolvedValue(monitorDetail)
    vi.mocked(getQuotaSummary).mockResolvedValue({
      maxProbesPerMonitor: 3,
    } as unknown as QuotaSummary)
    vi.mocked(listProbes).mockResolvedValue([])
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
    const wrapper = await openForm()
    const html = wrapper.html()
    expect(html).not.toContain('rule-view__summary')
    expect(html).toContain('editor-rule__tree')
    expect(html).toContain('rule-view__root-hint')
  })

  // 兜底渠道的多选回显 monitor.notificationChannelIds，并列出组织下的渠道
  it('echoes bound notification channels in a multi select', async () => {
    const wrapper = await openForm()
    const select = wrapper.find('[data-placeholder="monitorPage.channelsPlaceholder"]')
    expect(select.exists()).toBe(true)
    expect(select.attributes('data-value')).toBe('ch1')
    expect(vi.mocked(listNotificationChannels)).toHaveBeenCalledWith('o1')
  })

  // 未改选时保存不提交该字段，避免用同一份数组覆盖后端已有绑定
  it('keeps the channel binding untouched when nothing changed', async () => {
    const wrapper = await openForm()
    await submit(wrapper)
    const changes = vi.mocked(updateMonitor).mock.calls[0]![2]
    expect(changes).not.toHaveProperty('notificationChannelIds')
  })

  // 改选后保存按新集合整体提交
  it('submits the selected channel ids as a whole set', async () => {
    const wrapper = await openForm()
    const select = wrapper.find('[data-placeholder="monitorPage.channelsPlaceholder"]')
    await select.trigger('click')
    await submit(wrapper)
    const changes = vi.mocked(updateMonitor).mock.calls[0]![2]
    expect(changes.notificationChannelIds).toEqual(['ch1', 'ch2'])
  })

  // 列表接口不返回 probes：表单要补一次详情来回显，未改动则不提交，避免误解绑全部探针
  it('echoes bound probes from the monitor detail and keeps them untouched', async () => {
    const wrapper = await openForm()
    const select = wrapper.find('[data-placeholder="monitorPage.probesPlaceholder"]')
    expect(select.exists()).toBe(true)
    expect(select.attributes('data-value')).toBe('pr1')
    expect(vi.mocked(getMonitor)).toHaveBeenCalledWith('p1', 'm1')
    await submit(wrapper)
    const changes = vi.mocked(updateMonitor).mock.calls[0]![2]
    expect(changes).not.toHaveProperty('probeIds')
  })

  // 单页模式没有弹窗的高度顾虑：条件区一律展开，新建与编辑一致
  it('expands every advanced panel in both modes', async () => {
    const editing = await openForm()
    expect(editing.find('.collapse').attributes('data-active')).toBe(
      'ssl,rules,probes,availability',
    )
    const creating = await openForm(null)
    expect(creating.find('.collapse').attributes('data-active')).toBe(
      'ssl,rules,probes,availability',
    )
  })
})
