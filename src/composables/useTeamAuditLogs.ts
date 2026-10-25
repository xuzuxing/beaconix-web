import dayjs from 'dayjs'
import { reactive, ref, watch, type Ref } from 'vue'

import { listAuditLogs } from '@/api'
import type { AuditAction, AuditLog, AuditLogQuery } from '@/api/types/team'

/** 审计日志筛选条件（文本项需点「查询」或回车才生效） */
export interface AuditLogFilters {
  action: AuditAction | 'all'
  entity: string
  actorId: string
  entityId: string
  /** 本地日期区间（YYYY-MM-DD），未选择时为 null */
  range: [string, string] | null
}

/**
 * 当前团队的审计日志（后端分页 + 过滤）。
 * 接口仅 ADMIN+ 可读，canView 为假时不发请求；用请求序号丢弃过期响应。
 */
export function useTeamAuditLogs(orgId: Ref<string>, canView: Ref<boolean>) {
  const logs = ref<AuditLog[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const pageSize = ref(25)
  const filters = reactive<AuditLogFilters>({
    action: 'all',
    entity: '',
    actorId: '',
    entityId: '',
    range: null,
  })
  let request = 0
  let loadedOrg = ''

  /** 组装后端查询参数：空筛选不下发 */
  function buildQuery(): AuditLogQuery {
    const query: AuditLogQuery = { page: page.value, limit: pageSize.value }
    if (filters.action !== 'all') query.action = filters.action
    if (filters.entity.trim()) query.entity = filters.entity.trim()
    if (filters.actorId.trim()) query.actorId = filters.actorId.trim()
    if (filters.entityId.trim()) query.entityId = filters.entityId.trim()
    if (filters.range?.[0]) query.from = dayjs(filters.range[0]).startOf('day').toISOString()
    if (filters.range?.[1]) query.to = dayjs(filters.range[1]).endOf('day').toISOString()
    return query
  }

  async function load() {
    const id = orgId.value
    const token = ++request
    if (id !== loadedOrg) {
      logs.value = []
      total.value = 0
    }
    loadedOrg = id
    error.value = ''

    if (!id || !canView.value) {
      loading.value = false
      logs.value = []
      total.value = 0
      return
    }

    loading.value = true
    try {
      const result = await listAuditLogs(id, buildQuery())
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
    filters.range = null
    applyFilters()
  }

  function changePage(next: number, size: number) {
    page.value = next
    pageSize.value = size
    void load()
  }

  watch(
    [orgId, canView],
    () => {
      page.value = 1
      void load()
    },
    { immediate: true },
  )

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
