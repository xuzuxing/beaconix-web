import type { AdminSetting, SettingValue, SettingValueType } from '../types/admin'
import { CONFIG_GROUP_KEY } from '@/utils/settings-presenter'
import { ApiError } from '@/utils/request'

/**
 * 平台配置（`/admin/settings`）的内存 mock。
 *
 * 后端接口还在调整，这一份数据先顶替真实响应：读走内存里的副本，
 * 写就地更新同一个副本（刷新页面即回到初始值）。
 * 接口就绪后把 `admin-setting.ts` 的 `SETTINGS_USE_MOCK` 改成 false 即可整体切回。
 *
 * 每一项的 `group` 与 key 的第一段保持一致，方便和真实后端对照；
 * tab 的清单与顺序单独由 `develop.configGroup` 这一项的值决定。
 */

/** 配置分组：与 `develop.configGroup` 的初始值一致 */
const GROUPS = [
  'system',
  'develop',
  'organization',
  'project',
  'task',
  'sprint',
  'monitor',
  'shared',
]

interface SettingSeed {
  key: string
  name: string
  group: string
  value: SettingValue
  valueType: SettingValueType
  description: string
  /** 密文项：只允许覆盖写入，后端不回显 */
  isSecret?: boolean
  /** 省略即视为后端内置默认（尚未被平台覆盖） */
  isDefault?: boolean
}

const SEEDS: SettingSeed[] = [
  // ---------- 站点配置 ----------
  {
    key: 'system.siteName',
    name: '站点名称',
    group: 'system',
    value: 'Beaconix',
    valueType: 'STRING',
    description: '浏览器标题、系统邮件与状态页上展示的产品名。',
  },
  {
    key: 'system.siteDescription',
    name: '站点描述',
    group: 'system',
    value: '云监控与状态页平台',
    valueType: 'STRING',
    description: '登录页与状态页上的站点简介。',
  },
  {
    key: 'system.logoUrl',
    name: '站点 Logo',
    group: 'system',
    value: '',
    valueType: 'STRING',
    description: '顶栏与登录页使用的 Logo 地址，留空则用内置图标。',
  },
  {
    key: 'system.faviconUrl',
    name: '浏览器图标',
    group: 'system',
    value: '',
    valueType: 'STRING',
    description: '浏览器标签页图标地址，留空则用内置图标。',
  },
  {
    key: 'system.footerCopyright',
    name: '页脚版权',
    group: 'system',
    value: '© 2026 Beaconix',
    valueType: 'STRING',
    description: '页面底部展示的版权文案。',
  },
  {
    key: 'system.icpLicense',
    name: 'ICP 备案号',
    group: 'system',
    value: '',
    valueType: 'STRING',
    description: '中国大陆部署时展示在页脚的备案号。',
  },
  {
    key: 'system.supportEmail',
    name: '客服邮箱',
    group: 'system',
    value: 'contacts@beaconix.app',
    valueType: 'STRING',
    description: '页脚与系统邮件里对外提供的联系邮箱。',
  },
  {
    key: 'system.defaultLocale',
    name: '默认语言',
    group: 'system',
    value: 'zh-CN',
    valueType: 'STRING',
    description: '新访客与注册用户的默认界面语言：zh-CN 或 en-US。',
  },
  {
    key: 'system.maintenanceMode',
    name: '维护模式',
    group: 'system',
    value: false,
    valueType: 'BOOLEAN',
    description: '开启后除平台超级管理员外的访问一律被挡在维护页。',
  },
  {
    key: 'system.smtpHost',
    name: 'SMTP 服务器',
    group: 'system',
    value: 'smtp.example.com',
    valueType: 'STRING',
    description: '系统邮件（验证码、邀请、告警摘要）使用的发信服务器。',
  },
  {
    key: 'system.smtpPassword',
    name: 'SMTP 密码',
    group: 'system',
    value: '',
    valueType: 'STRING',
    description: '发信账号密码，保存后不回显，留空表示不修改。',
    isSecret: true,
  },

  // ---------- 开发与调试 ----------
  {
    key: CONFIG_GROUP_KEY,
    name: '配置分组',
    group: 'develop',
    value: [...GROUPS],
    valueType: 'JSON',
    description: '平台配置页的 tab 清单与顺序，填字符串数组，可任意增删分组。',
  },
  {
    key: 'develop.debugMode',
    name: '调试模式',
    group: 'develop',
    value: false,
    valueType: 'BOOLEAN',
    description: '开启后接口返回更详细的错误信息，仅建议在测试环境使用。',
  },
  {
    key: 'develop.apiDocsUrl',
    name: '接口文档地址',
    group: 'develop',
    value: '/reference',
    valueType: 'STRING',
    description: '顶栏「接口文档」入口指向的地址。',
  },
  {
    key: 'develop.rateLimitPerMinute',
    name: '每分钟请求上限',
    group: 'develop',
    value: 120,
    valueType: 'NUMBER',
    description: '单个账号每分钟允许的 API 调用次数。',
    isDefault: false,
  },
  {
    key: 'develop.seedDemoData',
    name: '填充示例数据',
    group: 'develop',
    value: true,
    valueType: 'BOOLEAN',
    description: '新建租户时自动生成示例监控项与状态页。',
  },

  // ---------- 组织 ----------
  {
    key: 'organization.maxMembers',
    name: '成员上限',
    group: 'organization',
    value: 50,
    valueType: 'NUMBER',
    description: '单个租户允许的最大成员数。',
  },
  {
    key: 'organization.maxProjects',
    name: '项目上限',
    group: 'organization',
    value: 20,
    valueType: 'NUMBER',
    description: '单个租户允许的最大项目数。',
  },
  {
    key: 'organization.allowMemberCreateProject',
    name: '允许成员创建项目',
    group: 'organization',
    value: true,
    valueType: 'BOOLEAN',
    description: '关闭后只有组织管理员及以上可以新建项目。',
  },
  {
    key: 'organization.defaultMemberRole',
    name: '默认成员角色',
    group: 'organization',
    value: 'MEMBER',
    valueType: 'STRING',
    description: '受邀成员未单独指定时使用的组织角色。',
  },
  {
    key: 'organization.defaultTimezone',
    name: '默认时区',
    group: 'organization',
    value: 'Asia/Shanghai',
    valueType: 'STRING',
    description: '告警与报表默认使用的时区。',
  },

  // ---------- 项目 ----------
  {
    key: 'project.maxMonitors',
    name: '监控项上限',
    group: 'project',
    value: 50,
    valueType: 'NUMBER',
    description: '单个项目允许创建的监控项数量。',
  },
  {
    key: 'project.defaultCheckIntervalSeconds',
    name: '默认检测间隔（秒）',
    group: 'project',
    value: 300,
    valueType: 'NUMBER',
    description: '新建监控项时的默认检测间隔。',
  },
  {
    key: 'project.allowArchive',
    name: '允许归档项目',
    group: 'project',
    value: true,
    valueType: 'BOOLEAN',
    description: '关闭后项目只能停用，不能被归档。',
  },
  {
    key: 'project.defaultNotifyChannelIds',
    name: '默认通知渠道',
    group: 'project',
    value: [],
    valueType: 'JSON',
    description: '新建项目时默认绑定的通知渠道 ID 列表。',
  },

  // ---------- 任务 ----------
  {
    key: 'task.maxOpenTasks',
    name: '未完成任务上限',
    group: 'task',
    value: 100,
    valueType: 'NUMBER',
    description: '单个项目允许同时存在的未完成任务数。',
  },
  {
    key: 'task.defaultPriority',
    name: '默认优先级',
    group: 'task',
    value: 'P2',
    valueType: 'STRING',
    description: '新建任务时的默认优先级。',
  },
  {
    key: 'task.autoCloseAfterDays',
    name: '自动关闭天数',
    group: 'task',
    value: 14,
    valueType: 'NUMBER',
    description: '任务完成后多少天自动关闭。',
  },

  // ---------- 迭代 ----------
  {
    key: 'sprint.defaultDurationDays',
    name: '迭代时长（天）',
    group: 'sprint',
    value: 14,
    valueType: 'NUMBER',
    description: '新建迭代时的默认时长。',
  },
  {
    key: 'sprint.maxActiveSprints',
    name: '并行迭代上限',
    group: 'sprint',
    value: 3,
    valueType: 'NUMBER',
    description: '单个项目允许同时进行的迭代数。',
  },
  {
    key: 'sprint.allowScopeChange',
    name: '允许迭代中改范围',
    group: 'sprint',
    value: false,
    valueType: 'BOOLEAN',
    description: '开启后允许向进行中的迭代增删任务。',
  },

  // ---------- 监控 ----------
  {
    key: 'monitor.defaultIntervalSeconds',
    name: '默认检测间隔（秒）',
    group: 'monitor',
    value: 300,
    valueType: 'NUMBER',
    description: '新建监控项时的默认检测间隔。',
  },
  {
    key: 'monitor.defaultTimeoutMs',
    name: '默认超时（毫秒）',
    group: 'monitor',
    value: 10000,
    valueType: 'NUMBER',
    description: '单次检测请求的超时时间。',
  },
  {
    key: 'monitor.failureRetries',
    name: '失败重试次数',
    group: 'monitor',
    value: 3,
    valueType: 'NUMBER',
    description: '判定为故障前的重试次数。',
  },
  {
    key: 'monitor.defaultHttpMethod',
    name: '默认请求方法',
    group: 'monitor',
    value: 'GET',
    valueType: 'STRING',
    description: '新建 HTTP 监控项时的默认请求方法。',
  },
  {
    key: 'monitor.alertCooldownMinutes',
    name: '告警冷却（分钟）',
    group: 'monitor',
    value: 30,
    valueType: 'NUMBER',
    description: '同一监控项两次告警之间的最短间隔。',
    isDefault: false,
  },

  // ---------- 共享 ----------
  {
    key: 'shared.announcementEnabled',
    name: '全站公告开关',
    group: 'shared',
    value: false,
    valueType: 'BOOLEAN',
    description: '开启后在控制台顶部展示公告条。',
  },
  {
    key: 'shared.announcement',
    name: '全站公告',
    group: 'shared',
    value: '',
    valueType: 'STRING',
    description: '公告条展示的文案，关闭开关后不生效。',
  },
  {
    key: 'shared.helpCenterUrl',
    name: '帮助中心地址',
    group: 'shared',
    value: 'https://docs.beacon.example.com',
    valueType: 'STRING',
    description: '顶栏与空白页「帮助」入口指向的地址。',
  },
  {
    key: 'shared.statusPageDomain',
    name: '状态页域名',
    group: 'shared',
    value: '',
    valueType: 'STRING',
    description: '对外发布状态页时使用的自定义域名。',
  },
  {
    key: 'shared.maxStatusPages',
    name: '状态页上限',
    group: 'shared',
    value: 10,
    valueType: 'NUMBER',
    description: '单个租户允许创建的状态页数量。',
  },
]

/** 最后一次写入者与写入时间：仅用于「已被平台覆盖」的演示项 */
const COVERED_BY = 'user_admin_demo'
const SEEDED_AT = '2026-09-01T08:00:00.000Z'
const COVERED_AT = '2026-10-08T09:30:00.000Z'

function toEntity(seed: SettingSeed): AdminSetting {
  const covered = seed.isDefault === false
  return {
    key: seed.key,
    name: seed.name,
    group: seed.group,
    value: seed.value,
    valueType: seed.valueType,
    description: seed.description,
    isSecret: seed.isSecret ?? false,
    isDefault: !covered,
    updatedById: covered ? COVERED_BY : null,
    createdAt: SEEDED_AT,
    updatedAt: covered ? COVERED_AT : SEEDED_AT,
  }
}

let store: AdminSetting[] = SEEDS.map(toEntity)

/** 把内存 mock 恢复成初始数据（演示或测试用） */
export function resetMockAdminSettings() {
  store = SEEDS.map(toEntity)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 模拟一点网络往返，让 loading 状态可见 */
function delay(ms = 180) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function assertValueType(key: string, type: SettingValueType, value: SettingValue) {
  const valid =
    type === 'STRING'
      ? typeof value === 'string'
      : type === 'NUMBER'
        ? typeof value === 'number' && Number.isFinite(value)
        : type === 'BOOLEAN'
          ? typeof value === 'boolean'
          : value !== null && typeof value === 'object'
  if (!valid) throw new ApiError(`配置项 ${key} 的值与类型 ${type} 不匹配`, 422, '/admin/settings')
}

/** GET /admin/settings */
export async function mockListAdminSettings(): Promise<AdminSetting[]> {
  await delay()
  return clone(store)
}

/** GET /admin/settings/{key} */
export async function mockGetAdminSetting(key: string): Promise<AdminSetting> {
  await delay()
  const found = store.find((item) => item.key === key)
  if (!found) throw new ApiError(`配置项 ${key} 不存在`, 404, `/admin/settings/${key}`)
  return clone(found)
}

/** PATCH /admin/settings/{key} */
export async function mockUpdateAdminSetting(
  key: string,
  value: SettingValue,
): Promise<AdminSetting> {
  await delay()
  const index = store.findIndex((item) => item.key === key)
  const current = store[index]
  if (!current) throw new ApiError(`配置项 ${key} 不存在`, 404, `/admin/settings/${key}`)
  assertValueType(key, current.valueType, value)

  const next: AdminSetting = {
    ...current,
    value: clone(value),
    isDefault: false,
    updatedById: COVERED_BY,
    updatedAt: new Date().toISOString(),
  }
  store.splice(index, 1, next)
  return clone(next)
}
