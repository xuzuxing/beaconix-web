import type { AxiosRequestConfig } from 'axios'

import type {
  CreateTicketParams,
  CreateTicketReplyParams,
  MyTicketQuery,
  Ticket,
  TicketCategory,
  TicketDetail,
  TicketPage,
} from '../types/ticket'
import { get, post } from '@/utils/request'

/**
 * 用户侧工单（/tickets）。
 * 全部接口只作用于当前登录用户自己的工单：列表与详情都按作者过滤，
 * 因此不需要组织 ID，也不会因为切换团队而改变可见范围。
 */

/** 提交工单时可选的分类（仅启用项，按 sortOrder 排序） */
export function listTicketCategories(config?: AxiosRequestConfig) {
  return get<TicketCategory[]>('/tickets/categories', undefined, config)
}

/** 提交工单 */
export function createTicket(data: CreateTicketParams) {
  return post<Ticket>('/tickets', data)
}

/** 我的工单列表（状态 / 分类筛选 + 分页） */
export function listMyTickets(params?: MyTicketQuery, config?: AxiosRequestConfig) {
  return get<TicketPage>('/tickets', params as Record<string, unknown> | undefined, config)
}

/** 工单详情（含合并后的时间线） */
export function getMyTicket(ticketId: string, config?: AxiosRequestConfig) {
  return get<TicketDetail>(`/tickets/${encodeURIComponent(ticketId)}`, undefined, config)
}

/** 回复工单：后端会在回复时把已解决 / 已关闭的工单重新打开 */
export function replyToMyTicket(ticketId: string, data: CreateTicketReplyParams) {
  return post<void>(`/tickets/${encodeURIComponent(ticketId)}/replies`, data)
}

/** 确认解决并关闭工单；已关闭时后端返回 409 */
export function closeMyTicket(ticketId: string) {
  return post<Ticket>(`/tickets/${encodeURIComponent(ticketId)}/close`)
}
