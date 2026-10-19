// ============================================================
// 通知渠道
// ============================================================

/** 渠道投递方，对应 NotificationChannelEntity.type */
export type NotificationChannelType = 'FEISHU' | 'WECOM' | 'DINGTALK' | 'WECHAT_SUBSCRIBE' | 'EMAIL'

/** FEISHU / WECOM / DINGTALK 共用 webhook 配置 */
export interface WebhookChannelConfig {
  webhookUrl: string
  /** 可选的签名校验密钥 */
  secret?: string
}

/** 微信公众号（订阅消息）配置 */
export interface WechatSubscribeChannelConfig {
  appId: string
  appSecret: string
  templateId: string
  /** 接收人的 openId 列表 */
  openIds: string[]
  /** 点击消息后跳转的页面路径 */
  page?: string
}

/** 邮件配置：收件人列表 */
export interface EmailChannelConfig {
  to: string[]
}

/** 渠道配置（后端按 type 校验字段，前端只负责原样提交） */
export type NotificationChannelConfig =
  WebhookChannelConfig | WechatSubscribeChannelConfig | EmailChannelConfig | Record<string, unknown>

/** 通知渠道 */
export interface NotificationChannel {
  id: string
  organizationId: string
  type: NotificationChannelType
  name: string
  /** 投递方专属配置，结构随 type 变化 */
  config: Record<string, unknown>
  /** 是否接收监控告警 */
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateNotificationChannelParams {
  type: NotificationChannelType
  name: string
  config: Record<string, unknown>
  enabled?: boolean
}

export type UpdateNotificationChannelParams = Partial<CreateNotificationChannelParams>

/** 测试发送结果 */
export interface ChannelTestResult {
  delivered: boolean
  error: string | null
}

/** 投递结果 */
export type NotificationLogStatus = 'SUCCESS' | 'FAILED'

/**
 * 渠道投递日志。
 * 后端未在 OpenAPI 中声明该实体字段，这里只承诺 UI 依赖的最小集合，
 * 其余字段通过索引签名保留，供「查看原始内容」使用。
 */
export interface NotificationLog {
  id: string
  status: NotificationLogStatus
  createdAt: string
  monitorId?: string | null
  monitorName?: string | null
  channelId?: string | null
  error?: string | null
  [key: string]: unknown
}

export interface ChannelLogQuery {
  status?: NotificationLogStatus
  monitorId?: string
  page?: number
  limit?: number
}
