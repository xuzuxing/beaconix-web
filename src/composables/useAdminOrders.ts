import dayjs from 'dayjs'
import { reactive, ref } from 'vue'

import { cancelAdminOrder, listAdminOrders, markAdminOrderPaid, refundAdminOrder } from '@/api'
import type { AdminOrder, AdminOrderQuery } from '@/api/types/admin'
import type { OrderStatus } from '@/api/types/billing'

/** 订单运营操作，与后端状态机一一对应 */
export type AdminOrderAction = 'cancel' | 'markPaid' | 'refund'

/** 跨租户订单的筛选条件（文本项需点「查询」或回车才生效） */
export interface AdminOrderFilters {
  status: OrderStatus | 'all'
  orderNo: string
  organizationId: string
  userId: string
  planId: string
  /** 本地日期区间（YYYY-MM-DD），未选择时为 null */
  range: [string, string] | null
}

const ACTION_REQUEST: Record<AdminOrderAction, (id: string) => Promise<AdminOrder>> = {
  cancel: cancelAdminOrder,
  markPaid: markAdminOrderPaid,
  refund: refundAdminOrder,
}

/**
 * 全平台订单（后端分页 + 过滤，仅 SUPER_ADMIN）。
 * 运营操作成功后只替换被操作的那一行，避免整表重载导致筛选与滚动位置丢失。
 */
export function useAdminOrders() {
  const orders = ref<AdminOrder[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const pageSize = ref(25)
  const actingId = ref('')
  const filters = reactive<AdminOrderFilters>({
    status: 'all',
    orderNo: '',
    organizationId: '',
    userId: '',
    planId: '',
    range: null,
  })
  let request = 0

  /** 组装后端查询参数：空筛选不下发 */
  function buildQuery(): AdminOrderQuery {
    const query: AdminOrderQuery = { page: page.value, limit: pageSize.value }
    if (filters.status !== 'all') query.status = filters.status
    if (filters.orderNo.trim()) query.orderNo = filters.orderNo.trim()
    if (filters.organizationId.trim()) query.organizationId = filters.organizationId.trim()
    if (filters.userId.trim()) query.userId = filters.userId.trim()
    if (filters.planId.trim()) query.planId = filters.planId.trim()
    if (filters.range?.[0]) query.from = dayjs(filters.range[0]).startOf('day').toISOString()
    if (filters.range?.[1]) query.to = dayjs(filters.range[1]).endOf('day').toISOString()
    return query
  }

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const result = await listAdminOrders(buildQuery())
      if (token !== request) return
      orders.value = result?.items ?? []
      total.value = result?.total ?? orders.value.length
    } catch (cause) {
      if (token !== request) return
      orders.value = []
      total.value = 0
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /**
   * 执行一次运营操作。
   * 失败时抛出，由页面按请求层的统一提示处理，这里只保证释放 busy 状态。
   */
  async function act(order: AdminOrder, action: AdminOrderAction): Promise<AdminOrder> {
    actingId.value = order.id
    try {
      const updated = await ACTION_REQUEST[action](order.id)
      const index = orders.value.findIndex((item) => item.id === order.id)
      if (index >= 0) orders.value.splice(index, 1, updated)
      return updated
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
    filters.orderNo = ''
    filters.organizationId = ''
    filters.userId = ''
    filters.planId = ''
    filters.range = null
    applyFilters()
  }

  function changePage(next: number, size: number) {
    page.value = next
    pageSize.value = size
    void load()
  }

  return {
    orders,
    total,
    loading,
    error,
    page,
    pageSize,
    filters,
    actingId,
    load,
    applyFilters,
    reset,
    changePage,
    act,
  }
}
