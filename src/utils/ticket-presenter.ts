import type {
  Ticket,
  TicketDetail,
  TicketOrganizationRef,
  TicketPriority,
  TicketStats,
  TicketStatus,
  TicketTimelineEntry,
  TicketTimelineKind,
  TicketUserSummary,
} from '@/api/types/ticket'

/**
 * 工单页面的展现层纯函数：状态 / 优先级的主题与文案键、时间线归一化、统计归一化。
 * 只做数据整形，不发请求，便于单元测试（test/ticket-presenter.test.mjs）。
 */

export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'PROCESSING', 'RESOLVED', 'CLOSED']

export const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

/** 状态 → i18n key（ticketPage.statusLabel.OPEN …，与文案文件同名） */
export function ticketStatusLabelKey(status: TicketStatus): string {
  return `ticketPage.statusLabel.${status}`
}

/** 优先级 → i18n key（ticketPage.priorityLabel.LOW …） */
export function ticketPriorityLabelKey(priority: TicketPriority): string {
  return `ticketPage.priorityLabel.${priority}`
}

export function ticketStatusTheme(
  status: TicketStatus,
): 'primary' | 'warning' | 'success' | 'default' {
  switch (status) {
    case 'OPEN':
      return 'primary'
    case 'PROCESSING':
      return 'warning'
    case 'RESOLVED':
      return 'success'
    default:
      return 'default'
  }
}

export function ticketPriorityTheme(
  priority: TicketPriority,
): 'default' | 'primary' | 'warning' | 'danger' {
  switch (priority) {
    case 'LOW':
      return 'default'
    case 'MEDIUM':
      return 'primary'
    case 'HIGH':
      return 'warning'
    default:
      return 'danger'
  }
}

/** 时间线条目类型的标签主题：内部备注要显眼，系统事件最轻 */
export function ticketTimelineKindTheme(
  kind: TicketTimelineKind,
): 'default' | 'primary' | 'warning' {
  if (kind === 'NOTE') return 'warning'
  return kind === 'STATUS' ? 'primary' : 'default'
}

/** 工单号展示文案 */
export function ticketNumberLabel(number: number | null | undefined): string {
  return typeof number === 'number' && Number.isFinite(number) ? `#${number}` : '—'
}

/** 组织快照的展示文案：兼容字符串 / 对象 / null 三种形态 */
export function ticketOrganizationLabel(ref: TicketOrganizationRef | undefined): string {
  if (!ref) return ''
  if (typeof ref === 'string') return ref
  return ref.name ?? ref.slug ?? ref.id ?? ''
}

/** 用户摘要的展示文案，缺失时回退到用户 ID */
export function ticketUserLabel(
  user: TicketUserSummary | null | undefined,
  fallbackId?: string | null,
): string {
  return user?.name ?? fallbackId ?? ''
}

export function ticketAuthorLabel(ticket: Pick<Ticket, 'author' | 'authorId'>): string {
  return ticketUserLabel(ticket.author, ticket.authorId)
}

/** 处理人文案；未指派时返回空串，由页面决定展示什么占位 */
export function ticketAssigneeLabel(ticket: Pick<Ticket, 'assignee' | 'assigneeId'>): string {
  return ticketUserLabel(ticket.assignee, ticket.assigneeId)
}

/** 是否已关闭：关闭后用户可以回复重新打开，但不能再次关闭 */
export function isTicketClosed(ticket: Pick<Ticket, 'status'>): boolean {
  return ticket.status === 'CLOSED'
}

/** 用户侧「确认解决并关闭」的可用性 */
export function canCloseTicket(ticket: Pick<Ticket, 'status'>): boolean {
  return ticket.status !== 'CLOSED'
}

/** 分类展示文案：优先取内嵌分类，其次取分类 ID，两者都没有时为占位符 */
export function ticketCategoryLabel(ticket: Pick<Ticket, 'category' | 'categoryId'>): string {
  return ticket.category?.name ?? ticket.categoryId ?? ''
}

// ------------------------------------------------------------
// 时间线归一化
// ------------------------------------------------------------

const TIMELINE_BODY_FIELDS = ['body', 'content', 'message', 'text'] as const
const TIMELINE_TIME_FIELDS = ['createdAt', 'at', 'created_at', 'timestamp', 'time'] as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(source: Record<string, unknown>, fields: readonly string[]): string {
  for (const field of fields) {
    const value = source[field]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

function isTruthy(value: unknown): boolean {
  return value === true
}

function asStatus(value: unknown): TicketStatus | null {
  return typeof value === 'string' && (TICKET_STATUSES as string[]).includes(value)
    ? (value as TicketStatus)
    : null
}

/** 条目作者：支持内嵌对象、字符串姓名、或仅有作者 ID */
function readAuthor(source: Record<string, unknown>): TicketUserSummary | null {
  for (const field of ['author', 'user', 'createdBy', 'actor']) {
    const raw = source[field]
    if (typeof raw === 'string' && raw.trim()) return { id: raw, name: raw }
    const record = asRecord(raw)
    if (!record) continue
    const name = readString(record, ['name', 'displayName', 'email'])
    const id = readString(record, ['id', 'userId'])
    if (name || id) return { id: id || name, name: name || id }
  }

  const authorId = readString(source, ['authorId', 'userId', 'createdById'])
  if (authorId) return { id: authorId, name: authorId }
  return null
}

/** 条目类型：优先读 type / kind，其次按是否内部备注、是否状态流转推断 */
function readKind(source: Record<string, unknown>, hasBody: boolean): TicketTimelineKind {
  const raw = readString(source, ['kind', 'type', 'event', 'eventType']).toUpperCase()
  if (raw === 'NOTE' || raw === 'INTERNAL_NOTE' || raw === 'INTERNALNOTE') return 'NOTE'
  if (raw === 'STATUS' || raw === 'STATUS_CHANGE' || raw === 'TRANSITION') return 'STATUS'
  if (raw === 'REPLY' || raw === 'COMMENT' || raw === 'MESSAGE') return 'REPLY'
  if (raw === 'SYSTEM' || raw === 'EVENT') return 'SYSTEM'

  if (isTruthy(source.isInternalNote) || isTruthy(source.internal)) return 'NOTE'
  if (hasBody) return 'REPLY'
  return asStatus(source.toStatus ?? source.status) ? 'STATUS' : 'SYSTEM'
}

function normalizeTimelineEntry(raw: unknown, index: number): TicketTimelineEntry | null {
  const source = asRecord(raw)
  if (!source) {
    // 后端也可能直接给字符串（系统事件），当成一条无作者的回复
    return typeof raw === 'string' && raw.trim()
      ? {
          id: `entry-${index}`,
          kind: 'REPLY',
          body: raw,
          internal: false,
          status: null,
          author: null,
          createdAt: '',
        }
      : null
  }

  const body = readString(source, TIMELINE_BODY_FIELDS)
  return {
    id: readString(source, ['id', 'entryId']) || `entry-${index}`,
    kind: readKind(source, Boolean(body)),
    body,
    internal: isTruthy(source.isInternalNote) || isTruthy(source.internal),
    status: asStatus(source.toStatus ?? source.status),
    author: readAuthor(source),
    createdAt: readString(source, TIMELINE_TIME_FIELDS),
  }
}

/** 时间线排序：按时间升序，时间缺失或非法时保持后端顺序 */
function sortTimeline(entries: TicketTimelineEntry[]): TicketTimelineEntry[] {
  return entries
    .map((entry, index) => ({ entry, index, time: Date.parse(entry.createdAt) }))
    .sort((a, b) => {
      const left = Number.isFinite(a.time) ? a.time : Number.MAX_SAFE_INTEGER
      const right = Number.isFinite(b.time) ? b.time : Number.MAX_SAFE_INTEGER
      return left === right ? a.index - b.index : left - right
    })
    .map((item) => item.entry)
}

/**
 * 归一化详情响应里的时间线。
 *
 * 接口文档只写了「detail with timeline」，没给出条目结构，因此这里同时兼容：
 * - 数组本身，或对象里的 timeline / events / replies / history 字段
 * - 正文的 body / content / message / text
 * - 作者的 author / user / createdBy / actor（对象或字符串）或裸 authorId
 * - 时间字段 createdAt / at / created_at / timestamp / time
 */
export function normalizeTicketTimeline(raw: unknown): TicketTimelineEntry[] {
  const source = Array.isArray(raw) ? raw : null
  const record = asRecord(raw)
  const list =
    source ??
    (record ? (record.timeline ?? record.events ?? record.replies ?? record.history) : null)

  if (!Array.isArray(list)) return []

  const entries = list
    .map((item, index) => normalizeTimelineEntry(item, index))
    .filter((entry): entry is TicketTimelineEntry => entry !== null)

  return sortTimeline(entries)
}

/** 从详情对象里取出归一化后的时间线（入参可以是整个 detail，也可以是时间线数组） */
export function ticketTimelineOf(detail: TicketDetail | unknown): TicketTimelineEntry[] {
  return normalizeTicketTimeline(detail)
}

// ------------------------------------------------------------
// 统计归一化
// ------------------------------------------------------------

function emptyStatusCounts(): Record<TicketStatus, number> {
  return { OPEN: 0, PROCESSING: 0, RESOLVED: 0, CLOSED: 0 }
}

function emptyPriorityCounts(): Record<TicketPriority, number> {
  return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
}

function readCount(source: Record<string, unknown>, key: string): number {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * 统计接口的返回结构未在文档中给出 schema，兼容两种常见分组写法：
 * `{ byStatus: {...}, byPriority: {...} }` 与扁平的 `{ OPEN: 1, HIGH: 2, total }`。
 */
export function normalizeTicketStats(raw: unknown): TicketStats {
  const record = asRecord(raw) ?? {}
  const statusSource = asRecord(record.byStatus ?? record.statusCounts ?? record.status) ?? record
  const prioritySource =
    asRecord(record.byPriority ?? record.priorityCounts ?? record.priority) ?? record

  const byStatus = emptyStatusCounts()
  TICKET_STATUSES.forEach((status) => {
    byStatus[status] = readCount(statusSource, status)
  })

  const byPriority = emptyPriorityCounts()
  TICKET_PRIORITIES.forEach((priority) => {
    byPriority[priority] = readCount(prioritySource, priority)
  })

  const explicitTotal = readCount(record, 'total')
  const total =
    explicitTotal ||
    TICKET_STATUSES.reduce((sum, status) => sum + byStatus[status], 0) ||
    TICKET_PRIORITIES.reduce((sum, priority) => sum + byPriority[priority], 0)

  return { total, byStatus, byPriority }
}

/** 统计里的单条计数（页面上循环渲染时用） */
export function ticketStatsRows(stats: TicketStats): { status: TicketStatus; count: number }[] {
  return TICKET_STATUSES.map((status) => ({ status, count: stats.byStatus[status] }))
}

/** 优先级分布（只看非零项，避免空态里出现四行 0） */
export function ticketPriorityRows(
  stats: TicketStats,
): { priority: TicketPriority; count: number }[] {
  return TICKET_PRIORITIES.map((priority) => ({
    priority,
    count: stats.byPriority[priority],
  })).filter((row) => row.count > 0)
}
