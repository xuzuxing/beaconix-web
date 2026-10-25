import dayjs from 'dayjs'
import { reactive, ref } from 'vue'

import { listAdminAuditLogs } from '@/api'
import type { AdminAuditLogQuery } from '@/api/types/admin'
import type { AuditAction, AuditLog } from '@/api/types/team'

/** 跨租户审计日志的筛选条件（文本项需点「查询」或回车才生效） */
export interface AdminAuditLogFilters {
  action: AuditAction | 'all'
  entity: string
  actorId: string
  entityId: string
  organizationId: string
  /** 本地日期区间（YYYY-MM-DD），未选择时为 null */
  range: [string, string] | null
}

/**
 * 跨租户审计日志（后端分页 + 过滤，仅 SUPER_ADMIN）。
 * 与团队审计日志同构，额外支持按组织过滤；用请求序号丢弃过期响应。
 */
export function useAdminAuditLogs() {
  const logs = ref<AuditLog[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const pageSize = ref(25)
  const filters = reactive<AdminAuditLogFilters>({
    action: 'all',
    entity: '',
    actorId: '',
    entityId: '',
    organizationId: '',
    range: null,
  })
  let request = 0

  /** 组装后端查询参数：空筛选不下发 */
  function buildQuery(): AdminAuditLogQuery {
    const query: AdminAuditLogQuery = {
      page: page.value,
      limit: pageSize.value,
    }
    if (filters.action !== 'all') query.action = filters.action
    if (filters.entity.trim()) query.entity = filters.entity.trim()
    if (filters.actorId.trim()) query.actorId = filters.actorId.trim()
    if (filters.entityId.trim()) query.entityId = filters.entityId.trim()
    if (filters.organizationId.trim()) query.organizationId = filters.organizationId.trim()
    if (filters.range?.[0]) query.from = dayjs(filters.range[0]).startOf('day').toISOString()
    if (filters.range?.[1]) query.to = dayjs(filters.range[1]).endOf('day').toISOString()
    return query
  }

  async function load() {
    const token = ++request
    loading.value = true
    error.value = ''

    try {
      const result = await listAdminAuditLogs(buildQuery())
      if (token !== request) return
      logs.value = result?.items ?? []
      total.value = result?.total ?? logs.value.length
    } catch (cause) {
      if (token !== request) return
      logs.value = []
      total.value = 0
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 筛选条件变化：回到第一页再查询 */
  function applyFilters() {
    page.value = 1
    void load()
  }

  /** 清空全部筛选并重新查询 */
  function reset() {
    filters.action = 'all'
    filters.entity = ''
    filters.actorId = ''
    filters.entityId = ''
    filters.organizationId = ''
    filters.range = null
    applyFilters()
  }

  function changePage(next: number, size: number) {
    page.value = next
    pageSize.value = size
    void load()
  }

  return {
    logs,
    total,
    loading,
    error,
    page,
    pageSize,
    filters,
    load,
    applyFilters,
    reset,
    changePage,
  }
}
