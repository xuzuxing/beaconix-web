import { reactive, ref } from 'vue'

import {
  deleteAdminTicket,
  getAdminTicketStats,
  listAdminTickets,
  replyAsAdmin,
  updateAdminTicket,
} from '@/api'
import type { AttachmentRef } from '@/api/types/attachment'
import type {
  AdminTicketQuery,
  AdminTicketReplyParams,
  Ticket,
  TicketPriority,
  TicketStats,
  TicketStatus,
  UpdateTicketParams,
} from '@/api/types/ticket'
import { normalizeTicketStats } from '@/utils/ticket-presenter'

/** 管理端工单筛选条件（文本项需点「查询」或回车才生效） */
export interface AdminTicketFilters {
  status: TicketStatus | 'all'
  priority: TicketPriority | 'all'
  /** 空串表示全部分类 */
  categoryId: string
  /** 按处理人 ID 精确筛选 */
  assigneeId: string
  /** 只看未指派 */
  unassigned: boolean
  /** 模糊匹配主题、正文或作者邮箱 */
  q: string
}

/**
 * 全平台工单（后端分页 + 过滤，仅 SUPER_ADMIN）。
 * 更新 / 删除成功后只改被操作的那一条，避免整表重载丢掉筛选与滚动位置；
 * 计数会受影响，因此同一轮里重算一次统计。
 */
export function useAdminTickets() {
  const tickets = ref<Ticket[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const pageSize = ref(25)
  const actingId = ref('')
  const stats = ref<TicketStats>(normalizeTicketStats(null))
  const statsLoading = ref(false)
  const statsError = ref('')
  const filters = reactive<AdminTicketFilters>({
    status: 'all',
    priority: 'all',
    categoryId: '',
    assigneeId: '',
    unassigned: false,
    q: '',
  })
  let request = 0
  let statsRequest = 0

  /** 组装后端查询参数：空筛选不下发 */
  function buildQuery(): AdminTicketQuery {
    const query: AdminTicketQuery = { page: page.value, limit: pageSize.value }
    if (filters.status !== 'all') query.status = filters.status
    if (filters.priority !== 'all') query.priority = filters.priority
    if (filters.categoryId) query.categoryId = filters.categoryId
    if (filters.assigneeId.trim()) query.assigneeId = filters.assigneeId.trim()
    if (filters.unassigned) query.unassigned = true
    if (filters.q.trim()) query.q = filters.q.trim()
    return query
  }

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const result = await listAdminTickets(buildQuery())
      if (token !== request) return
      tickets.value = result?.items ?? []
      total.value = result?.total ?? tickets.value.length
    } catch (cause) {
      if (token !== request) return
      tickets.value = []
      total.value = 0
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 状态 / 优先级计数：开关筛选不影响它，只随工单变化刷新 */
  async function loadStats() {
    const token = ++statsRequest
    statsLoading.value = true
    statsError.value = ''
    try {
      const result = await getAdminTicketStats()
      if (token !== statsRequest) return
      stats.value = normalizeTicketStats(result)
    } catch (cause) {
      if (token !== statsRequest) return
      statsError.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === statsRequest) statsLoading.value = false
    }
  }

  /** 更新状态 / 优先级 / 分类 / 处理人；成功返回更新后的工单 */
  async function update(ticketId: string, patch: UpdateTicketParams): Promise<Ticket | null> {
    actingId.value = ticketId
    try {
      const updated = await updateAdminTicket(ticketId, patch)
      // 整表重载：状态 / 优先级 / 分类变更后该行可能不再属于当前筛选，就地替换会留下过期行
      await load()
      void loadStats()
      return updated
    } catch {
      return null
    } finally {
      actingId.value = ''
    }
  }

  /** 回复工单（isInternalNote 为真时记为内部备注） */
  async function reply(
    ticketId: string,
    body: string,
    isInternalNote = false,
    attachments: AttachmentRef[] = [],
  ): Promise<boolean> {
    const trimmed = body.trim()
    if (!trimmed) return false

    const payload: AdminTicketReplyParams = { body: trimmed, isInternalNote }
    if (attachments.length) payload.attachments = attachments

    actingId.value = ticketId
    try {
      await replyAsAdmin(ticketId, payload)
      await load()
      void loadStats()
      return true
    } catch {
      return false
    } finally {
      actingId.value = ''
    }
  }

  /** 软删除垃圾 / 测试工单 */
  async function remove(ticketId: string): Promise<boolean> {
    actingId.value = ticketId
    try {
      await deleteAdminTicket(ticketId)
      tickets.value = tickets.value.filter((ticket) => ticket.id !== ticketId)
      total.value = Math.max(0, total.value - 1)
      void loadStats()
      return true
    } catch {
      return false
    } finally {
      actingId.value = ''
    }
  }

  /** 筛选条件变化：回到第一页再查询 */
  function applyFilters() {
    page.value = 1
    void load()
  }

  /** 清空全部筛选并重新查询 */
  function reset() {
    filters.status = 'all'
    filters.priority = 'all'
    filters.categoryId = ''
    filters.assigneeId = ''
    filters.unassigned = false
    filters.q = ''
    applyFilters()
  }

  function changePage(next: number, size: number) {
    page.value = next
    pageSize.value = size
    void load()
  }

  return {
    tickets,
    total,
    loading,
    error,
    page,
    pageSize,
    filters,
    actingId,
    stats,
    statsLoading,
    statsError,
    load,
    loadStats,
    update,
    reply,
    remove,
    applyFilters,
    reset,
    changePage,
  }
}
