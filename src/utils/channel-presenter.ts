import type {
  NotificationChannel,
  NotificationChannelType,
} from '../api/types/notification'

/** 支持的渠道类型（顺序即下拉与概览的展示顺序） */
export const CHANNEL_TYPES: NotificationChannelType[] = [
  'FEISHU',
  'WECOM',
  'DINGTALK',
  'WECHAT_SUBSCRIBE',
  'EMAIL',
]

/** webhook 类渠道（配置为 { webhookUrl, secret? }） */
export type WebhookChannelType = 'FEISHU' | 'WECOM' | 'DINGTALK'

export function isWebhookChannelType(type: NotificationChannelType): type is WebhookChannelType {
  return type === 'FEISHU' || type === 'WECOM' || type === 'DINGTALK'
}

/** 类型标签配色 */
export const channelTypeTheme: Record<
  NotificationChannelType,
  'default' | 'primary' | 'success' | 'warning'
> = {
  FEISHU: 'primary',
  WECOM: 'success',
  DINGTALK: 'primary',
  WECHAT_SUBSCRIBE: 'success',
  EMAIL: 'warning',
}

/** 从配置里取字符串字段（后端返回结构与类型声明解耦，这里做一次收窄） */
export function readConfigString(config: Record<string, unknown> | undefined, key: string): string {
  const value = config?.[key]
  return typeof value === 'string' ? value : ''
}

/** 取字符串数组字段 */
export function readConfigStringList(
  config: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = config?.[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** 把 textarea 里的多行/逗号分隔文本解析成字符串数组 */
export function parseListInput(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 配置摘要：webhook 地址 / 收件人 / 模板与 openId 数量，用于列表行展示 */
export function channelConfigSummary(channel: Pick<NotificationChannel, 'type' | 'config'>) {
  const { type, config } = channel
  if (isWebhookChannelType(type)) return readConfigString(config, 'webhookUrl')
  if (type === 'EMAIL') return readConfigStringList(config, 'to').join(', ')
  const templateId = readConfigString(config, 'templateId')
  const openIds = readConfigStringList(config, 'openIds').length
  return templateId ? `${templateId} · ${openIds} openId` : `${openIds} openId`
}

/** webhook 地址的展示形态（隐藏 query 里的签名 token，只保留协议 + 主机） */
export function maskWebhookUrl(url: string) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    return url
  }
}

export type ChannelStatusFilter = 'all' | 'enabled' | 'disabled'
export type ChannelSort = 'newest' | 'name' | 'type'

/** 列表过滤 + 排序（前端分页前的全量数据） */
export function selectChannels(
  rows: NotificationChannel[],
  search: string,
  type: NotificationChannelType | 'all',
  status: ChannelStatusFilter,
  sort: ChannelSort,
) {
  const query = search.trim().toLocaleLowerCase()
  return rows
    .filter(
      (row) =>
        (!query ||
          `${row.name} ${channelConfigSummary(row)}`.toLocaleLowerCase().includes(query)) &&
        (type === 'all' || row.type === type) &&
        (status === 'all' || row.enabled === (status === 'enabled')),
    )
    .sort((a, b) => {
      const order =
        sort === 'name'
          ? a.name.localeCompare(b.name)
          : sort === 'type'
            ? a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
            : Date.parse(b.createdAt) - Date.parse(a.createdAt)
      return order || a.id.localeCompare(b.id)
    })
}

/** 概览统计：总数 / 启用 / 停用 / 按类型分布 */
export function summarizeChannels(rows: NotificationChannel[]) {
  const byType = Object.fromEntries(CHANNEL_TYPES.map((type) => [type, 0])) as Record<
    NotificationChannelType,
    number
  >
  let enabled = 0
  rows.forEach((row) => {
    byType[row.type] = (byType[row.type] ?? 0) + 1
    if (row.enabled) enabled++
  })
  return { total: rows.length, enabled, disabled: rows.length - enabled, byType }
}
