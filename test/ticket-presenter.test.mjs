import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  canCloseTicket,
  isTicketClosed,
  normalizeTicketStats,
  normalizeTicketTimeline,
  ticketAssigneeLabel,
  ticketAuthorLabel,
  ticketCategoryLabel,
  ticketNumberLabel,
  ticketOrganizationLabel,
  ticketPriorityLabelKey,
  ticketPriorityRows,
  ticketPriorityTheme,
  ticketStatsRows,
  ticketStatusLabelKey,
  ticketStatusTheme,
  ticketTimelineKindTheme,
  ticketUserLabel,
} from '../src/utils/ticket-presenter.ts'

const ticket = (overrides = {}) => ({
  id: 'ticket-1',
  number: 1024,
  subject: 'Export fails',
  content: 'Posting the export endpoint returns 500',
  status: 'OPEN',
  priority: 'MEDIUM',
  authorId: 'user-1',
  createdAt: '2026-03-05T12:00:00.000Z',
  updatedAt: '2026-03-05T12:00:00.000Z',
  ...overrides,
})

// ------------------------------------------------------------
// 标签与主题
// ------------------------------------------------------------

test('ticketStatusLabelKey / ticketPriorityLabelKey point at ticketPage label groups', () => {
  assert.equal(ticketStatusLabelKey('OPEN'), 'ticketPage.statusLabel.OPEN')
  assert.equal(ticketStatusLabelKey('CLOSED'), 'ticketPage.statusLabel.CLOSED')
  assert.equal(ticketPriorityLabelKey('CRITICAL'), 'ticketPage.priorityLabel.CRITICAL')
})

test('status themes distinguish open, in-progress, resolved and closed', () => {
  assert.equal(ticketStatusTheme('OPEN'), 'primary')
  assert.equal(ticketStatusTheme('PROCESSING'), 'warning')
  assert.equal(ticketStatusTheme('RESOLVED'), 'success')
  assert.equal(ticketStatusTheme('CLOSED'), 'default')
})

test('priority themes escalate from default to danger', () => {
  assert.equal(ticketPriorityTheme('LOW'), 'default')
  assert.equal(ticketPriorityTheme('MEDIUM'), 'primary')
  assert.equal(ticketPriorityTheme('HIGH'), 'warning')
  assert.equal(ticketPriorityTheme('CRITICAL'), 'danger')
})

test('timeline kinds: internal notes are warnings, status changes are primary', () => {
  assert.equal(ticketTimelineKindTheme('NOTE'), 'warning')
  assert.equal(ticketTimelineKindTheme('STATUS'), 'primary')
  assert.equal(ticketTimelineKindTheme('REPLY'), 'default')
  assert.equal(ticketTimelineKindTheme('SYSTEM'), 'default')
})

// ------------------------------------------------------------
// 标签拼装
// ------------------------------------------------------------

test('ticketNumberLabel renders a hash prefix and falls back for missing numbers', () => {
  assert.equal(ticketNumberLabel(1024), '#1024')
  assert.equal(ticketNumberLabel(0), '#0')
  assert.equal(ticketNumberLabel(null), '—')
  assert.equal(ticketNumberLabel(undefined), '—')
})

test('organization snapshot may arrive as a string, an object or null', () => {
  assert.equal(ticketOrganizationLabel('Acme'), 'Acme')
  assert.equal(ticketOrganizationLabel({ id: 'org-1', name: 'Acme' }), 'Acme')
  assert.equal(ticketOrganizationLabel({ id: 'org-1', slug: 'acme' }), 'acme')
  assert.equal(ticketOrganizationLabel({ id: 'org-1' }), 'org-1')
  assert.equal(ticketOrganizationLabel(null), '')
  assert.equal(ticketOrganizationLabel(undefined), '')
})

test('author and assignee labels prefer embedded profiles and fall back to ids', () => {
  assert.equal(ticketAuthorLabel(ticket({ author: { id: 'u1', name: 'Ada' } })), 'Ada')
  assert.equal(ticketAuthorLabel(ticket()), 'user-1')
  assert.equal(
    ticketAssigneeLabel(ticket({ assignee: { id: 'u2', name: 'Grace' }, assigneeId: 'u2' })),
    'Grace',
  )
  assert.equal(ticketAssigneeLabel(ticket()), '')
  assert.equal(ticketUserLabel(null), '')
})

test('category label falls back from embedded category to its id', () => {
  assert.equal(ticketCategoryLabel(ticket({ category: { id: 'c1', name: 'Billing' } })), 'Billing')
  assert.equal(ticketCategoryLabel(ticket({ categoryId: 'c1' })), 'c1')
  assert.equal(ticketCategoryLabel(ticket()), '')
})

test('only non-closed tickets can be closed by the submitter', () => {
  assert.equal(isTicketClosed(ticket({ status: 'CLOSED' })), true)
  assert.equal(canCloseTicket(ticket({ status: 'CLOSED' })), false)
  assert.equal(canCloseTicket(ticket({ status: 'RESOLVED' })), true)
  assert.equal(canCloseTicket(ticket()), true)
})

// ------------------------------------------------------------
// 时间线归一化
// ------------------------------------------------------------

test('timeline normalizes replies, internal notes and status changes', () => {
  const entries = normalizeTicketTimeline({
    timeline: [
      {
        id: 'e1',
        type: 'REPLY',
        body: 'Still broken after deploy',
        author: { id: 'u1', name: 'Ada' },
        createdAt: '2026-03-05T12:00:00.000Z',
      },
      {
        id: 'e2',
        type: 'NOTE',
        content: 'Reproduced on staging',
        isInternalNote: true,
        authorId: 'op-1',
        createdAt: '2026-03-05T13:00:00.000Z',
      },
      {
        id: 'e3',
        kind: 'STATUS_CHANGE',
        toStatus: 'PROCESSING',
        author: 'operator',
        createdAt: '2026-03-05T14:00:00.000Z',
      },
    ],
  })

  assert.equal(entries.length, 3)
  assert.deepEqual(entries[0], {
    id: 'e1',
    kind: 'REPLY',
    body: 'Still broken after deploy',
    internal: false,
    status: null,
    author: { id: 'u1', name: 'Ada' },
    createdAt: '2026-03-05T12:00:00.000Z',
  })
  assert.equal(entries[1].kind, 'NOTE')
  assert.equal(entries[1].internal, true)
  assert.equal(entries[1].author.name, 'op-1')
  assert.equal(entries[2].kind, 'STATUS')
  assert.equal(entries[2].status, 'PROCESSING')
  assert.equal(entries[2].author.name, 'operator')
})

test('timeline infers kinds when the backend omits type', () => {
  const [withBody, transition, system] = normalizeTicketTimeline([
    { id: 'a', body: 'hello', createdAt: '2026-03-05T12:00:00.000Z' },
    { id: 'b', status: 'RESOLVED', createdAt: '2026-03-05T13:00:00.000Z' },
    { id: 'c', createdAt: '2026-03-05T14:00:00.000Z' },
  ])

  assert.equal(withBody.kind, 'REPLY')
  assert.equal(transition.kind, 'STATUS')
  assert.equal(transition.status, 'RESOLVED')
  assert.equal(system.kind, 'SYSTEM')
})

test('timeline accepts alternate containers and string entries', () => {
  assert.equal(normalizeTicketTimeline({ events: [{ id: 'x', body: 'hi' }] }).length, 1)
  assert.equal(normalizeTicketTimeline({ replies: [{ id: 'x', body: 'hi' }] }).length, 1)
  assert.equal(normalizeTicketTimeline({ history: [{ id: 'x', body: 'hi' }] }).length, 1)
  assert.equal(normalizeTicketTimeline([{ id: 'x', body: 'hi' }]).length, 1)

  const [entry] = normalizeTicketTimeline(['system message'])
  assert.equal(entry.kind, 'REPLY')
  assert.equal(entry.body, 'system message')
})

test('timeline sorts by time and keeps backend order when timestamps are missing', () => {
  const entries = normalizeTicketTimeline([
    { id: 'late', body: 'second', createdAt: '2026-03-05T14:00:00.000Z' },
    { id: 'early', body: 'first', createdAt: '2026-03-05T12:00:00.000Z' },
  ])
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['early', 'late'],
  )

  const unsorted = normalizeTicketTimeline([{ id: 'one' }, { id: 'two' }, { id: 'three' }])
  assert.deepEqual(
    unsorted.map((entry) => entry.id),
    ['one', 'two', 'three'],
  )
})

test('timeline tolerates unexpected payloads', () => {
  assert.deepEqual(normalizeTicketTimeline(null), [])
  assert.deepEqual(normalizeTicketTimeline({}), [])
  assert.deepEqual(normalizeTicketTimeline('nope'), [])
  assert.deepEqual(normalizeTicketTimeline({ timeline: 'nope' }), [])
  assert.deepEqual(normalizeTicketTimeline([null, 42]), [])
})

test('timeline accepts alternate body and time field names', () => {
  const [entry] = normalizeTicketTimeline([
    {
      id: 'e1',
      message: 'from message field',
      createdAt: '2026-03-05T12:00:00.000Z',
    },
  ])
  assert.equal(entry.body, 'from message field')

  const [legacy] = normalizeTicketTimeline([
    {
      id: 'e2',
      text: 'from text field',
      created_at: '2026-03-06T12:00:00.000Z',
    },
  ])
  assert.equal(legacy.body, 'from text field')
  assert.equal(legacy.createdAt, '2026-03-06T12:00:00.000Z')
})

// ------------------------------------------------------------
// 统计归一化
// ------------------------------------------------------------

test('stats accept grouped byStatus / byPriority payloads', () => {
  const stats = normalizeTicketStats({
    total: 7,
    byStatus: { OPEN: 2, PROCESSING: 3, RESOLVED: 1, CLOSED: 1 },
    byPriority: { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 1 },
  })

  assert.equal(stats.total, 7)
  assert.deepEqual(stats.byStatus, {
    OPEN: 2,
    PROCESSING: 3,
    RESOLVED: 1,
    CLOSED: 1,
  })
  assert.deepEqual(stats.byPriority, {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 1,
  })
})

test('stats accept flat payloads and derive the total', () => {
  const stats = normalizeTicketStats({ OPEN: 2, PROCESSING: 1, HIGH: 1 })
  assert.equal(stats.byStatus.OPEN, 2)
  assert.equal(stats.byStatus.PROCESSING, 1)
  assert.equal(stats.byPriority.HIGH, 1)
  assert.equal(stats.total, 3)
})

test('stats accept statusCounts / priorityCounts aliases', () => {
  const stats = normalizeTicketStats({
    statusCounts: { OPEN: 4 },
    priorityCounts: { CRITICAL: 2 },
  })
  assert.equal(stats.byStatus.OPEN, 4)
  assert.equal(stats.byPriority.CRITICAL, 2)
  assert.equal(stats.total, 4)
})

test('stats fall back to zeroes for missing or invalid payloads', () => {
  const stats = normalizeTicketStats(null)
  assert.equal(stats.total, 0)
  assert.deepEqual(stats.byStatus, {
    OPEN: 0,
    PROCESSING: 0,
    RESOLVED: 0,
    CLOSED: 0,
  })
  assert.deepEqual(stats.byPriority, {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  })

  const rows = ticketStatsRows(normalizeTicketStats({ byStatus: { OPEN: '5' } }))
  assert.equal(rows.length, 4)
  assert.equal(rows[0].count, 0)
})

test('priority rows hide zero counts so empty states stay quiet', () => {
  const stats = normalizeTicketStats({ byPriority: { HIGH: 2, CRITICAL: 0 } })
  assert.deepEqual(ticketPriorityRows(stats), [{ priority: 'HIGH', count: 2 }])
})
