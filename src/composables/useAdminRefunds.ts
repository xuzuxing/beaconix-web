import dayjs from 'dayjs'
import { reactive, ref } from 'vue'

import {
  approveAdminRefund,
  closeAdminRefund,
  getAdminRefundStats,
  listAdminRefunds,
  retryAdminRefund,
} from '@/api'
import type { PaymentChannel } from '@/api/types/billing'
import type {
  AdminRefund,
  AdminRefundQuery,
  AdminRefundStats,
  AdminRefundStatsQuery,
  RefundStatus,
} from '@/api/types/refund'

/** 退款单的运营操作，与后端状态机一一对应 */
export type AdminRefundAction = 'approve' | 'retry' | 'close'

/** 退款单筛选条件（文本项需点「查询」或回车才生效） */
export interface AdminRefundFilters {
  status: RefundStatus | 'all'
  channel: PaymentChannel | 'all'
  refundNo: string
  orderId: string
  organizationId: string
  /** 本地日期区间（YYYY-MM-DD），未选择时为 null */
  range: [string, string] | null
}

function emptyFilters(): AdminRefundFilters {
  return {
    status: 'all',
    channel: 'all',
    refundNo: '',
    orderId: '',
    organizationId: '',
    range: null,
  }
}

/**
 * 跨租户退款单（后端分页 + 过滤，仅 SUPER_ADMIN），以及对账统计。
 *
 * 运营操作成功后只替换被操作的那一行，避免整表重载丢失筛选与滚动位置；
 * 统计随操作一起刷新，因为金额与状态分布会立即变化。
 */
export function useAdminRefunds() {
  const refunds = ref<AdminRefund[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const pageSize = ref(25)
  const actingId = ref('')
  const filters = reactive<AdminRefundFilters>(emptyFilters())

  const stats = ref<AdminRefundStats | null>(null)
  const statsLoading = ref(false)

  let request = 0
  let statsRequest = 0

  /** 组装后端查询参数：空筛选不下发 */
  function buildQuery(): AdminRefundQuery {
    const query: AdminRefundQuery = { page: page.value, limit: pageSize.value }
    if (filters.status !== 'all') query.status = filters.status
    if (filters.channel !== 'all') query.channel = filters.channel
    if (filters.refundNo.trim()) query.refundNo = filters.refundNo.trim()
    if (filters.orderId.trim()) query.orderId = filters.orderId.trim()
    if (filters.organizationId.trim()) query.organizationId = filters.organizationId.trim()
    if (filters.range?.[0]) query.from = dayjs(filters.range[0]).startOf('day').toISOString()
    if (filters.range?.[1]) query.to = dayjs(filters.range[1]).endOf('day').toISOString()
    return query
  }

  /** 统计只按时间与渠道过滤（状态/单号维度已在列表里） */
  function buildStatsQuery(): AdminRefundStatsQuery {
    const query: AdminRefundStatsQuery = {}
    if (filters.channel !== 'all') query.channel = filters.channel
    if (filters.range?.[0]) query.from = dayjs(filters.range[0]).startOf('day').toISOString()
    if (filters.range?.[1]) query.to = dayjs(filters.range[1]).endOf('day').toISOString()
    return query
  }

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const result = await listAdminRefunds(buildQuery())
      if (token !== request) return
      refunds.value = result?.items ?? []
      total.value = result?.total ?? refunds.value.length
    } catch (cause) {
      if (token !== request) return
      refunds.value = []
      total.value = 0
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  async function loadStats() {
    const token = ++statsRequest
    statsLoading.value = true
    try {
      const result = await getAdminRefundStats(buildStatsQuery())
      if (token !== statsRequest) return
      stats.value = result ?? null
    } catch {
      if (token !== statsRequest) return
      stats.value = null
    } finally {
      if (token === statsRequest) statsLoading.value = false
    }
  }

  /** 列表 + 统计一起刷新 */
  async function refreshAll() {
    await Promise.all([load(), loadStats()])
  }

  /**
   * 执行一次运营操作：成功后就地替换被操作的行并刷新统计。
   * 失败时抛出，由页面按请求层的统一提示处理，这里只保证释放 busy 状态。
   */
  async function act(
    refund: AdminRefund,
    action: AdminRefundAction,
    reason?: string,
  ): Promise<AdminRefund> {
    actingId.value = refund.id
    try {
      const updated =
        action === 'approve'
          ? await approveAdminRefund(refund.id)
          : action === 'retry'
            ? await retryAdminRefund(refund.id)
            : await closeAdminRefund(refund.id, reason?.trim() ? { reason: reason.trim() } : {})

      const index = refunds.value.findIndex((item) => item.id === refund.id)
      if (index >= 0 && updated) refunds.value.splice(index, 1, updated)
      else await load()
      void loadStats()
      return updated
    } finally {
      actingId.value = ''
    }
  }

  /** 筛选条件变化：回到第一页再查询（列表与统计一起） */
  function applyFilters() {
    page.value = 1
    void refreshAll()
  }

  /** 清空全部筛选并重新查询 */
  function reset() {
    Object.assign(filters, emptyFilters())
    applyFilters()
  }

  function changePage(next: number, size: number) {
    page.value = next
    pageSize.value = size
    void load()
  }

  /** 按订单预置筛选（从订单管理跳转过来时用） */
  function focusOrder(orderId: string) {
    filters.orderId = orderId
    applyFilters()
  }

  return {
    refunds,
    total,
    loading,
    error,
    page,
    pageSize,
    filters,
    actingId,
    stats,
    statsLoading,
    load,
    loadStats,
    refreshAll,
    applyFilters,
    reset,
    changePage,
    act,
    focusOrder,
  }
}
