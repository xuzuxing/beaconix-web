// ============================================================
// 工单域（用户侧 /tickets 与管理后台 /admin/tickets）
// 对齐后端 TicketsController / AdminTicketsController / AdminTicketCategoriesController。
// 工单是账号级资源：提交时只记录作者当时所属的组织快照，不随团队切换而变。
// 附件走通用上传端点（POST /attachments/upload），提交工单 / 回复时只带元数据。
// ============================================================

import type { AttachmentRef } from './attachment'

export type TicketStatus = 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

/** 提交工单时可选的分类（GET /tickets/categories，只返回启用项） */
export interface TicketCategory {
  id: string
  name: string
  description?: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** 工单内嵌的用户摘要（作者 / 处理人 / 时间线条目作者） */
export interface TicketUserSummary {
  id: string
  name: string
  avatarUrl?: string | null
}

/**
 * 组织快照：后端记录作者提交时所属的组织，接口文档没有固定它的具体结构，
 * 展示时统一走 ticketOrganizationLabel 归一化（字符串 / { id, name, slug } / null）。
 */
export type TicketOrganizationRef = string | { id?: string; name?: string; slug?: string } | null

export interface Ticket {
  id: string
  /** 平台范围内递增的工单号，展示为 #1024 */
  number: number
  subject: string
  content: string
  status: TicketStatus
  priority: TicketPriority
  categoryId?: string | null
  category?: TicketCategory | null
  organizationId?: TicketOrganizationRef
  authorId: string
  author?: TicketUserSummary | null
  assigneeId?: string | null
  assignee?: TicketUserSummary | null
  firstRespondedAt?: string | null
  resolvedAt?: string | null
  closedAt?: string | null
  /** 工单附件：提交时上传的文件元数据 */
  attachments?: AttachmentRef[] | null
  createdAt: string
  updatedAt: string
}

/** 时间线条目类型：回复、内部备注、状态流转、系统事件 */
export type TicketTimelineKind = 'REPLY' | 'NOTE' | 'STATUS' | 'SYSTEM'

export interface TicketTimelineEntry {
  id: string
  kind: TicketTimelineKind
  /** 回复 / 备注正文；状态流转与系统事件为空串 */
  body: string
  /** 内部备注：仅管理后台可见，提交者永远拿不到 */
  internal: boolean
  /** 状态流转的目标状态 */
  status: TicketStatus | null
  author: TicketUserSummary | null
  /** 该条回复 / 备注附带的文件（后端返回时才有） */
  attachments: AttachmentRef[]
  createdAt: string
}

/**
 * 工单详情：接口文档只写了「含合并后的 timeline」，没有给出条目结构，
 * 因此拿到响应后统一交给 normalizeTicketTimeline 归一化再渲染。
 */
export interface TicketDetail extends Ticket {
  timeline: TicketTimelineEntry[]
}

/** 列表分页结构：与审计日志 / 订单等分页接口保持一致 */
export interface TicketPage {
  items: Ticket[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** 用户侧列表筛选（GET /tickets） */
export interface MyTicketQuery {
  status?: TicketStatus
  categoryId?: string
  page?: number
  limit?: number
}

/** 管理端列表筛选（GET /admin/tickets） */
export interface AdminTicketQuery extends MyTicketQuery {
  priority?: TicketPriority
  assigneeId?: string
  /** 只看未指派的工单 */
  unassigned?: boolean
  /** 模糊匹配主题、正文或作者邮箱 */
  q?: string
}

export interface CreateTicketParams {
  subject: string
  content: string
  priority?: TicketPriority
  categoryId?: string
  /** 已上传附件的元数据（POST /attachments/upload 的返回） */
  attachments?: AttachmentRef[]
}

export interface CreateTicketReplyParams {
  body: string
  attachments?: AttachmentRef[]
}

export interface AdminTicketReplyParams {
  body: string
  /** 内部备注：提交者永远看不到 */
  isInternalNote?: boolean
  attachments?: AttachmentRef[]
}

/** 管理端更新：显式 null 表示清空分类 / 取消指派 */
export interface UpdateTicketParams {
  priority?: TicketPriority
  status?: TicketStatus
  categoryId?: string | null
  assigneeId?: string | null
}

/** 按状态 / 优先级的工单计数（GET /admin/tickets/stats，展示前经 normalizeTicketStats 归一化） */
export interface TicketStats {
  total: number
  byStatus: Record<TicketStatus, number>
  byPriority: Record<TicketPriority, number>
}

export interface CreateTicketCategoryParams {
  name: string
  description?: string
  sortOrder?: number
  isActive?: boolean
}

export type UpdateTicketCategoryParams = Partial<CreateTicketCategoryParams>
