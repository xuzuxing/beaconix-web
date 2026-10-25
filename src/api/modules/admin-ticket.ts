import type { AxiosRequestConfig } from 'axios'

import type {
  AdminTicketQuery,
  AdminTicketReplyParams,
  CreateTicketCategoryParams,
  Ticket,
  TicketCategory,
  TicketDetail,
  TicketPage,
  TicketStats,
  UpdateTicketCategoryParams,
  UpdateTicketParams,
} from '../types/ticket'
import { del, get, patch, post } from '@/utils/request'

/**
 * 管理后台 · 工单与工单分类（仅 SUPER_ADMIN）。
 * 与用户侧接口的区别：可跨账号查询全平台工单、可改状态 / 优先级 / 分类 / 处理人，
 * 详情里还会带上用户看不到的内部备注。
 */

/** 全平台工单列表（状态 / 优先级 / 分类 / 处理人 / 关键词筛选 + 分页） */
export function listAdminTickets(params?: AdminTicketQuery, config?: AxiosRequestConfig) {
  return get<TicketPage>('/admin/tickets', params as Record<string, unknown> | undefined, config)
}

/** 工单计数：按状态与优先级分组（响应结构经 normalizeTicketStats 归一化） */
export function getAdminTicketStats(config?: AxiosRequestConfig) {
  return get<TicketStats>('/admin/tickets/stats', undefined, config)
}

/** 工单详情（含内部备注） */
export function getAdminTicket(ticketId: string, config?: AxiosRequestConfig) {
  return get<TicketDetail>(`/admin/tickets/${encodeURIComponent(ticketId)}`, undefined, config)
}

/** 更新状态 / 优先级 / 分类 / 处理人；显式 null 清空分类或取消指派 */
export function updateAdminTicket(ticketId: string, data: UpdateTicketParams) {
  return patch<Ticket>(`/admin/tickets/${encodeURIComponent(ticketId)}`, data)
}

/** 软删除垃圾 / 测试工单 */
export function deleteAdminTicket(ticketId: string) {
  return del<void>(`/admin/tickets/${encodeURIComponent(ticketId)}`)
}

/** 回复工单：isInternalNote 为真时记为内部备注，提交者不可见 */
export function replyAsAdmin(ticketId: string, data: AdminTicketReplyParams) {
  return post<void>(`/admin/tickets/${encodeURIComponent(ticketId)}/replies`, data)
}

/** 新建工单分类 */
export function createTicketCategory(data: CreateTicketCategoryParams) {
  return post<TicketCategory>('/admin/ticket-categories', data)
}

/** 更新或停用工单分类（停用后只保留在历史工单上） */
export function updateTicketCategory(categoryId: string, data: UpdateTicketCategoryParams) {
  return patch<TicketCategory>(`/admin/ticket-categories/${encodeURIComponent(categoryId)}`, data)
}

/** 删除未被引用的工单分类；仍被工单引用时后端返回 409 */
export function deleteTicketCategory(categoryId: string) {
  return del<void>(`/admin/ticket-categories/${encodeURIComponent(categoryId)}`)
}
