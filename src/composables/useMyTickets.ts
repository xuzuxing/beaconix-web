import { reactive, ref } from 'vue'

import { createTicket, listMyTickets } from '@/api'
import type { CreateTicketParams, MyTicketQuery, Ticket, TicketStatus } from '@/api/types/ticket'

/** 我的工单筛选条件：状态下拉与分类下拉变更即查询 */
export interface MyTicketFilters {
  status: TicketStatus | 'all'
  /** 空串表示全部分类 */
  categoryId: string
}

/**
 * 当前账号的工单列表（后端分页 + 过滤）。
 * 提交成功后回到第一页重新加载，让新工单出现在最前面。
 */
export function useMyTickets() {
  const tickets = ref<Ticket[]>([])
  const total = ref(0)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref('')
  const page = ref(1)
  const pageSize = ref(20)
  const filters = reactive<MyTicketFilters>({ status: 'all', categoryId: '' })
  let request = 0

  /** 组装后端查询参数：空筛选不下发 */
  function buildQuery(): MyTicketQuery {
    const query: MyTicketQuery = { page: page.value, limit: pageSize.value }
    if (filters.status !== 'all') query.status = filters.status
    if (filters.categoryId) query.categoryId = filters.categoryId
    return query
  }

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const result = await listMyTickets(buildQuery())
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

  /**
   * 提交工单。
   * 成功返回新建的工单，失败返回 null（请求层已统一提示），由页面决定是否关闭弹窗。
   */
  async function submit(params: CreateTicketParams): Promise<Ticket | null> {
    submitting.value = true
    try {
      const ticket = await createTicket(params)
      page.value = 1
      await load()
      return ticket
    } catch {
      return null
    } finally {
      submitting.value = false
    }
  }

  /** 筛选条件变化：回到第一页再查询 */
  function applyFilters() {
    page.value = 1
    void load()
  }

  /** 清空筛选并重新查询 */
  function reset() {
    filters.status = 'all'
    filters.categoryId = ''
    applyFilters()
  }

  function changePage(next: number, size: number) {
    page.value = next
    pageSize.value = size
    void load()
  }

  void load()

  return {
    tickets,
    total,
    loading,
    submitting,
    error,
    page,
    pageSize,
    filters,
    load,
    submit,
    applyFilters,
    reset,
    changePage,
  }
}
