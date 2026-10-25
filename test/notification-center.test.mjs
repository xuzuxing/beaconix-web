import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import {
  canActOnInvitation,
  notificationBodyText,
  notificationIconName,
  notificationInvitationStatus,
  notificationLabelKey,
  notificationMetaRows,
  notificationReadParam,
  notificationReceivedInvitationId,
  notificationTheme,
  pendingInvitationNotification,
  resolveNotificationTarget,
} from '../src/utils/notification-presenter.ts'
import en from '../src/locales/notification.en-US.ts'
import zh from '../src/locales/notification.zh-CN.ts'
import { calls, invitation, reset, responses } from './fixtures/notification-api.mjs'

const fixture = new URL('./fixtures/notification-api.mjs', import.meta.url).href
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === '@/api' ||
      specifier === '@/utils/request' ||
      specifier === '@/api/modules/notification-center'
    )
      return { url: fixture, shortCircuit: true }
    if (specifier.startsWith('@/')) {
      return {
        url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href,
        shortCircuit: true,
      }
    }
    if (
      context.parentURL?.endsWith('/stores/modules/notification.ts') &&
      ['./organization', './user'].includes(specifier)
    )
      return {
        url: new URL(`${specifier}.ts`, context.parentURL).href,
        shortCircuit: true,
      }
    return nextResolve(specifier, context)
  },
})
const api = await import('../src/api/modules/invitation.ts')
const { useNotificationStore } = await import('../src/stores/modules/notification.ts')
const { useOrganizationStore } = await import('../src/stores/modules/organization.ts')
const { useUserStore } = await import('../src/stores/modules/user.ts')
hook.deregister()

const notice = (patch = {}) => ({
  id: 'notification-1',
  userId: 'invitee-1',
  type: 'INVITATION_RECEIVED',
  title: 'Join Beacon',
  body: 'Invitation',
  isRead: false,
  readAt: null,
  resourceType: 'Invitation',
  resourceId: 'invite-1',
  meta: {
    invitationStatus: 'PENDING',
    invitationExpiresAt: '2099-01-01T00:00:00.000Z',
    actionable: true,
    organizationId: 'org-1',
  },
  createdAt: '2026-10-11T00:00:00.000Z',
  ...patch,
})
let store
beforeEach(() => {
  reset()
  setActivePinia(createPinia())
  store = useNotificationStore()
})
afterEach(() => {
  store.$dispose()
})

test('every backend category has localized labels, a theme and an existing Hugeicon', async () => {
  // Contract snapshot: tests must also run without a sibling backend checkout.
  const types = `
    TASK_ASSIGNED TASK_UPDATED TASK_COMMENTED TASK_STATUS_CHANGED TASK_DUE_SOON TASK_OVERDUE
    SPRINT_STARTED SPRINT_COMPLETED PROJECT_ARCHIVED MEMBER_JOINED MEMBER_REMOVED MENTION
    INVITATION_RECEIVED INVITATION_ACCEPTED INVITATION_DECLINED INVITATION_REVOKED INVITATION_EXPIRED
    MEMBER_ROLE_CHANGED MEMBER_LEFT OWNERSHIP_TRANSFERRED ORGANIZATION_DELETED ORGANIZATION_RESTORED
    TASK_UNASSIGNED TASK_DELETED TASK_RESTORED TASK_SPRINT_CHANGED TASK_DEPENDENCY_CHANGED TASK_UNBLOCKED
    COMMENT_REPLIED PROJECT_DELETED PROJECT_RESTORED SPRINT_DELETED PASSWORD_CHANGED PASSWORD_RESET_COMPLETED
    TWO_FACTOR_ENABLED TWO_FACTOR_DISABLED TWO_FACTOR_RECOVERY_CODE_USED TWO_FACTOR_RECOVERY_CODES_REGENERATED
    PAYMENT_SUCCEEDED SUBSCRIPTION_ACTIVATED SUBSCRIPTION_RENEWED SUBSCRIPTION_EXPIRING SUBSCRIPTION_EXPIRED
    MONITOR_ALERT MONITOR_RECOVERED API_KEY_CREATED API_KEY_REVOKED PERSONAL_ACCESS_TOKEN_CREATED
    PERSONAL_ACCESS_TOKEN_REVOKED PROBE_ENROLLED PROBE_SECRET_ROTATED PROBE_CREDENTIAL_REVOKED
  `
    .trim()
    .split(/\s+/)
  const source = readFileSync(
    new URL('../src/api/types/notification-center.ts', import.meta.url),
    'utf8',
  )
  const icons = await import('../src/icons/index.ts')
  for (const type of types) {
    assert.ok(source.includes(`'${type}'`), type)
    const key = notificationLabelKey(type).split('.').at(-1)
    assert.notEqual(key, 'other', type)
    assert.ok(en.type[key], type)
    assert.ok(zh.type[key], type)
    assert.ok(icons[notificationIconName(type)], type)
    assert.ok(
      ['primary', 'success', 'warning', 'danger', 'default'].includes(notificationTheme(type)),
    )
  }
  assert.equal(notificationLabelKey('FUTURE_TYPE'), 'notificationCenter.type.other')
})

test('only an actionable received invitation with a valid future expiry offers actions', () => {
  assert.equal(canActOnInvitation(notice()), true)
  for (const status of ['ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED']) {
    assert.equal(canActOnInvitation(notice(), invitation({ status })), false)
    assert.equal(notificationInvitationStatus(notice(), invitation({ status })), status)
  }
  assert.equal(canActOnInvitation(notice({ type: 'INVITATION_ACCEPTED' })), false)
  assert.equal(canActOnInvitation(notice({ meta: { ...notice().meta, actionable: false } })), false)
  assert.equal(canActOnInvitation(notice({ resourceId: null })), false)
  assert.equal(
    canActOnInvitation(notice({ meta: { ...notice().meta, invitationExpiresAt: 'bad' } })),
    false,
  )
  const now = Date.parse('2026-10-11T00:00:00Z')
  assert.equal(
    notificationInvitationStatus(notice(), invitation({ expiresAt: '2026-10-10' }), now),
    'EXPIRED',
  )
  assert.equal(canActOnInvitation(notice(), invitation({ expiresAt: '2026-10-10' }), now), false)
})

test('resource routes are internal and monitor deep links carry authorized workspace hints', () => {
  const monitor = notice({
    type: 'MONITOR_ALERT',
    resourceType: 'Monitor',
    resourceId: 'monitor-1',
    meta: {
      organizationId: 'org-2',
      projectId: 'project-2',
      url: 'https://unsafe.example/token',
    },
  })
  assert.deepEqual(resolveNotificationTarget(monitor), {
    kind: 'route',
    to: {
      name: 'monitor-detail',
      params: { projectId: 'project-2', monitorId: 'monitor-1' },
      query: {
        highlight: 'monitor-1',
        organizationId: 'org-2',
        projectId: 'project-2',
      },
    },
  })
  assert.deepEqual(resolveNotificationTarget({ ...monitor, meta: null }), {
    kind: 'route',
    to: {
      path: '/monitor',
      query: {
        highlight: 'monitor-1',
        organizationId: undefined,
        projectId: undefined,
      },
    },
  })
  for (const resourceType of ['Task', 'Sprint', 'Project', 'Comment', 'Missing']) {
    assert.equal(
      resolveNotificationTarget(
        notice({
          type: 'TASK_UPDATED',
          resourceType,
          meta: { url: 'https://unsafe.example' },
        }),
      ),
      null,
    )
  }
  assert.equal(resolveNotificationTarget(notice()), null)
  assert.deepEqual(
    resolveNotificationTarget(
      notice({
        type: 'TWO_FACTOR_RECOVERY_CODE_USED',
        resourceType: 'User',
      }),
    ),
    { kind: 'route', to: '/security' },
  )
})

test('invitation transitions use projected status and team navigation, never invitee lookup', () => {
  assert.equal(notificationReceivedInvitationId(notice()), 'invite-1')
  assert.equal(notificationReceivedInvitationId(notice({ resourceId: null })), null)
  for (const status of ['ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED']) {
    const item = notice({
      type: `INVITATION_${status}`,
      meta: {
        invitationStatus: status,
        organizationId: 'org-1',
        actionable: false,
      },
    })
    assert.equal(notificationReceivedInvitationId(item), null)
    assert.equal(notificationInvitationStatus(item), status)
    assert.equal(notificationInvitationStatus({ ...item, meta: null }), status)
    assert.equal(canActOnInvitation(item), false)
    assert.deepEqual(resolveNotificationTarget(item), {
      kind: 'route',
      to: '/teams/members',
    })
  }
})

test('metadata and discovery presentation cannot reveal token or credential objects', () => {
  const meta = notificationMetaRows({
    organizationId: 'org-1',
    token: 'do-not-display',
    recoveryCodes: ['do-not-display'],
    password: 'do-not-display',
    nested: { secret: 'do-not-display' },
    href: 'https://unsafe.example',
  })
  assert.deepEqual(meta, [{ key: 'organizationId', value: 'org-1' }])
  assert.equal(notificationBodyText({ secret: 'do-not-display' }), '')
  assert.equal(notificationBodyText({ text: 'Readable' }), 'Readable')
  const item = pendingInvitationNotification(invitation({ token: 'do-not-display' }))
  assert.ok(!JSON.stringify(item).includes('do-not-display'))
  assert.equal(canActOnInvitation(item), true)
  assert.equal(notificationReadParam('all'), undefined)
  assert.equal(notificationReadParam('unread'), false)
  assert.equal(notificationReadParam('read'), true)
})

test('pending and by-id API calls encode stable ids and discard server tokens', async () => {
  responses.set('GET /invitations/pending', [invitation({ token: 'do-not-retain' })])
  responses.set('GET /invitations/by-id/invite%2Fone', invitation({ token: 'do-not-retain' }))
  assert.ok(!('token' in (await api.listPendingInvitations())[0]))
  assert.ok(!('token' in (await api.getInvitationById('invite/one'))))
  await api.acceptInvitationById('invite/one')
  await api.declineInvitationById('invite/one')
  assert.deepEqual(
    calls.map((item) => `${item.method} ${item.path}`),
    [
      'GET /invitations/pending',
      'GET /invitations/by-id/invite%2Fone',
      'POST /invitations/by-id/invite%2Fone/accept',
      'POST /invitations/by-id/invite%2Fone/decline',
    ],
  )
})

test('pending invitation discovery works with no selected organization or membership', async () => {
  responses.set('GET /invitations/pending', [invitation({ token: 'discarded' })])
  await store.loadPendingInvitations()
  assert.equal(useOrganizationStore().currentOrganizationId, '')
  assert.equal(store.pendingInvitations.length, 1)
  assert.ok(!('token' in store.pendingInvitations[0]))
  assert.equal(calls.filter((item) => item.path.startsWith('/organizations')).length, 0)
})

test('accept refreshes notifications, unread count and team/project lists without using tokens', async () => {
  const item = notice()
  assert.equal(await store.actOnInvitation(item, 'accept'), true)
  assert.equal(store.invitations['invite-1'].status, 'ACCEPTED')
  assert.equal(store.invitationPending['invite-1'], undefined)
  assert.equal(store.unreadCount, 2)
  for (const path of [
    '/notifications',
    '/notifications/unread-count',
    '/invitations/pending',
    '/organizations',
    '/organizations/org-1/projects',
  ]) {
    assert.ok(
      calls.some((call) => call.path === path),
      path,
    )
  }
  assert.ok(calls.some((call) => call.path === '/invitations/by-id/invite-1/accept'))
  assert.equal(await store.actOnInvitation(item, 'decline'), false)
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
})

test('decline refreshes notifications but does not fetch team membership', async () => {
  assert.equal(await store.actOnInvitation(notice(), 'decline'), true)
  assert.equal(store.invitations['invite-1'].status, 'DECLINED')
  assert.ok(!calls.some((call) => call.path === '/organizations'))
})

test('a terminal invitation discovered before submit never calls the mutation API', async () => {
  responses.set('GET /invitations/by-id/invite-1', invitation({ status: 'REVOKED' }))
  assert.equal(await store.actOnInvitation(notice(), 'accept'), false)
  assert.equal(store.invitations['invite-1'].status, 'REVOKED')
  assert.equal(store.invitationErrors['invite-1'], 'stale')
  assert.ok(!calls.some((call) => call.method === 'POST'))
  assert.ok(calls.some((call) => call.path === '/notifications'))
})

test('stale mutation error reloads current state and permanently disables terminal actions', async () => {
  let reads = 0
  responses.set('GET /invitations/by-id/invite-1', () =>
    invitation({ status: ++reads === 1 ? 'PENDING' : 'EXPIRED' }),
  )
  responses.set('POST /invitations/by-id/invite-1/accept', new Error('No longer pending'))
  assert.equal(await store.actOnInvitation(notice(), 'accept'), false)
  assert.equal(store.invitations['invite-1'].status, 'EXPIRED')
  assert.equal(canActOnInvitation(notice(), store.invitations['invite-1']), false)
  assert.equal(store.invitationPending['invite-1'], undefined)
})

test('if status cannot be refreshed after an error, actions stay blocked until a successful retry', async () => {
  let reads = 0
  responses.set('GET /invitations/by-id/invite-1', () => {
    if (++reads > 1) throw new Error('Unavailable')
    return invitation()
  })
  responses.set('POST /invitations/by-id/invite-1/decline', new Error('Unavailable'))
  await store.actOnInvitation(notice(), 'decline')
  assert.equal(store.invitationBlocked['invite-1'], true)
  assert.equal(await store.actOnInvitation(notice(), 'accept'), false)
  responses.set('GET /invitations/by-id/invite-1', invitation())
  await store.loadInvitation('invite-1')
  assert.equal(store.invitationBlocked['invite-1'], false)
})

test('duplicate invitation clicks share a lock across surfaces', async () => {
  let resolve
  responses.set(
    'POST /invitations/by-id/invite-1/accept',
    new Promise((done) => {
      resolve = done
    }),
  )
  const first = store.actOnInvitation(notice(), 'accept')
  assert.equal(await store.actOnInvitation(notice(), 'decline'), false)
  await new Promise((done) => setImmediate(done))
  resolve(invitation({ status: 'ACCEPTED' }))
  assert.equal(await first, true)
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
})

test('SSE retries deduplicate by id, retain read state, and use one authoritative unread refresh', async () => {
  store.unreadCount = 1
  const item = notice({ type: 'MONITOR_ALERT', resourceType: 'Monitor' })
  store.receiveNotification(item)
  store.receiveNotification(item)
  assert.equal(store.recent.length, 1)
  assert.equal(store.unreadCount, 1)
  store.recent[0].isRead = true
  store.receiveNotification({ ...item, isRead: false })
  assert.equal(store.recent[0].isRead, true)
  await new Promise((done) => setTimeout(done, 130))
  assert.equal(store.unreadCount, 2)
  assert.equal(calls.filter((call) => call.path === '/notifications/unread-count').length, 1)
  await store.remove(item.id, false)
  store.receiveNotification(item)
  assert.equal(store.recent.length, 0)
})

test('SSE invitation transitions never call the invitee-only API or submit actions', async () => {
  for (const status of ['ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED']) {
    const item = notice({
      id: `transition-${status}`,
      type: `INVITATION_${status}`,
      meta: {
        invitationStatus: status,
        organizationId: 'org-1',
        actionable: false,
      },
    })
    store.receiveNotification(item)
    store.receiveNotification(item)
    assert.equal(await store.actOnInvitation(item, 'accept'), false)
  }
  await new Promise((done) => setTimeout(done, 130))
  assert.ok(!calls.some((call) => call.path.startsWith('/invitations/by-id/')))
  assert.equal(calls.filter((call) => call.path === '/notifications/unread-count').length, 1)
  assert.deepEqual(store.invitations, {})
})

test('SSE received invitations still refresh current invitee status once after retries', async () => {
  responses.set('GET /invitations/by-id/invite-1', invitation({ status: 'REVOKED' }))
  store.receiveNotification(notice())
  store.receiveNotification(notice())
  await new Promise((done) => setImmediate(done))
  assert.equal(calls.filter((call) => call.path === '/invitations/by-id/invite-1').length, 1)
  assert.equal(store.invitations['invite-1'].status, 'REVOKED')
  assert.equal(await store.actOnInvitation(notice(), 'accept'), false)
  assert.ok(!calls.some((call) => call.method === 'POST'))
})

test('SSE ignores events addressed to another user', () => {
  useUserStore().user = { id: 'invitee-1' }
  store.receiveNotification(notice({ userId: 'different-user' }))
  assert.equal(store.recent.length, 0)
})

test('old unread-count responses cannot overwrite a newer refresh', async () => {
  let finish
  responses.set(
    'GET /notifications/unread-count',
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const older = store.refreshUnreadCount()
  responses.set('GET /notifications/unread-count', { count: 7 })
  await store.refreshUnreadCount()
  finish({ count: 1 })
  await older
  assert.equal(store.unreadCount, 7)
})

test('workspace hints select an authorized org/project and reject inaccessible resources', async () => {
  await store.prepareNotificationTarget(
    notice({ meta: { organizationId: 'org-1', projectId: 'project-1' } }),
  )
  assert.equal(useOrganizationStore().currentProjectId, 'project-1')
  await assert.rejects(
    store.prepareNotificationTarget(notice({ meta: { organizationId: 'other-org' } })),
    /Workspace unavailable/,
  )
  await assert.rejects(
    store.prepareNotificationTarget(
      notice({ meta: { organizationId: 'org-1', projectId: 'other-project' } }),
    ),
    /Project unavailable/,
  )
  assert.equal(useOrganizationStore().currentOrganizationId, 'org-1')
})

test('a delayed pending-discovery response cannot restore an invitation after acceptance', async () => {
  let finish
  responses.set(
    'GET /invitations/pending',
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const oldDiscovery = store.loadPendingInvitations()
  responses.set('GET /invitations/pending', [])
  assert.equal(await store.actOnInvitation(notice(), 'accept'), true)
  finish([invitation()])
  await oldDiscovery
  assert.equal(store.pendingInvitations.length, 0)
  assert.equal(store.invitations['invite-1'].status, 'ACCEPTED')
})

test('a status request started during submit cannot overwrite the successful terminal response', async () => {
  let finishMutation, finishStatus
  responses.set(
    'POST /invitations/by-id/invite-1/accept',
    new Promise((resolve) => {
      finishMutation = resolve
    }),
  )
  const acceptance = store.actOnInvitation(notice(), 'accept')
  await new Promise((resolve) => setImmediate(resolve))
  responses.set(
    'GET /invitations/by-id/invite-1',
    new Promise((resolve) => {
      finishStatus = resolve
    }),
  )
  const staleStatus = store.loadInvitation('invite-1')
  finishMutation(invitation({ status: 'ACCEPTED' }))
  await acceptance
  finishStatus(invitation())
  await staleStatus
  assert.equal(store.invitations['invite-1'].status, 'ACCEPTED')
  assert.equal(canActOnInvitation(notice(), store.invitations['invite-1']), false)
})

test('logout invalidates in-flight invitation state and does not refresh the next user session', async () => {
  const user = useUserStore()
  user.user = { id: 'invitee-1' }
  let finish
  responses.set(
    'POST /invitations/by-id/invite-1/accept',
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const accepting = store.actOnInvitation(notice(), 'accept')
  await new Promise((resolve) => setImmediate(resolve))
  user.reset()
  user.user = { id: 'next-user' }
  finish(invitation({ status: 'ACCEPTED' }))
  assert.equal(await accepting, false)
  assert.deepEqual(store.invitations, {})
  assert.equal(store.pendingInvitations.length, 0)
  assert.ok(!calls.some((call) => call.path === '/organizations'))
})

test('shared invitation surfaces coalesce concurrent status lookups', async () => {
  let finish
  responses.set(
    'GET /invitations/by-id/invite-1',
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const one = store.loadInvitation('invite-1')
  const two = store.loadInvitation('invite-1')
  assert.equal(calls.filter((call) => call.path === '/invitations/by-id/invite-1').length, 1)
  finish(invitation())
  await Promise.all([one, two])
  assert.equal(store.invitations['invite-1'].status, 'PENDING')
})

test('concurrent title/detail read actions cannot double-decrement the badge', async () => {
  store.unreadCount = 5
  await Promise.all([store.markAsRead('off-page'), store.markAsRead('off-page')])
  assert.equal(store.unreadCount, 4)
  await store.markAsRead('off-page')
  assert.equal(store.unreadCount, 4)
})

test('REST-loaded notifications are also deduplicated on subsequent SSE delivery', async () => {
  const item = notice()
  responses.set('GET /notifications', { data: [item], meta: { total: 1 } })
  await store.loadRecent()
  store.receiveNotification(item)
  assert.equal(store.recent.length, 1)
  assert.equal(store.revision, 0)
})

test('delayed REST lists and later stale snapshots cannot resurrect ignored notifications', async () => {
  store.unreadCount = 3
  responses.set('GET /notifications', { data: [notice()], meta: { total: 1 } })
  await store.loadRecent()
  let finish
  responses.set('GET /notifications', new Promise((resolve) => (finish = resolve)))
  const older = store.loadRecent()
  await store.remove('notification-1')
  assert.equal(store.loading, false)
  assert.equal(store.unreadCount, 2)
  finish({ data: [notice()], meta: { total: 1 } })
  await older
  assert.deepEqual(store.recent, [])
  assert.equal(store.total, 0)
  responses.set('GET /notifications', { data: [notice()], meta: { total: 1 } })
  await store.loadRecent()
  assert.deepEqual(store.recent, [])
  assert.equal(store.total, 0)
  store.receiveNotification(notice())
  assert.deepEqual(store.recent, [])
  assert.equal(store.unreadCount, 2)
})

test('delayed and subsequently stale REST snapshots preserve successful reads and unread filters', async () => {
  store.unreadCount = 5
  responses.set('GET /notifications', { data: [notice()], meta: { total: 1 } })
  await store.loadRecent()
  let finish
  responses.set('GET /notifications', new Promise((resolve) => (finish = resolve)))
  const older = store.loadRecent()
  await store.markAsRead('notification-1')
  const readAt = store.recent[0].readAt
  assert.ok(readAt)
  assert.equal(store.loading, false)
  finish({ data: [notice()], meta: { total: 1 } })
  await older
  assert.equal(store.recent[0].isRead, true)
  assert.equal(store.recent[0].readAt, readAt)
  responses.set('GET /notifications', { data: [notice()], meta: { total: 1 } })
  await store.loadRecent()
  assert.equal(store.recent[0].isRead, true)
  assert.equal(store.recent[0].readAt, readAt)
  store.filter = 'unread'
  await store.loadRecent()
  assert.deepEqual(store.recent, [])
  assert.equal(store.total, 0)
  assert.equal(store.unreadCount, 4)
  assert.deepEqual(store.reconcileNotifications([notice()], 'unread'), [])
})

test('mark-all invalidates older lists, reconciles known off-page reads and keeps new events unread', async () => {
  const offPage = notice({ id: 'off-page' })
  store.reconcileNotification(offPage)
  responses.set('GET /notifications', { data: [notice()], meta: { total: 1 } })
  await store.loadRecent()
  let finish
  responses.set('GET /notifications', new Promise((resolve) => (finish = resolve)))
  const older = store.loadRecent()
  responses.set('GET /notifications', { data: [notice()], meta: { total: 1 } })
  await store.markAllAsRead()
  finish({ data: [notice()], meta: { total: 1 } })
  await older
  assert.equal(store.recent[0].isRead, true)
  assert.equal(store.unreadCount, 0)
  assert.equal(store.reconcileNotification(offPage).isRead, true)
  store.filter = 'unread'
  await store.loadRecent()
  assert.deepEqual(store.recent, [])
  const fresh = notice({
    id: 'new-event',
    type: 'MONITOR_ALERT',
    resourceType: 'Monitor',
  })
  store.receiveNotification(fresh)
  assert.equal(store.recent[0].id, 'new-event')
  assert.equal(store.recent[0].isRead, false)
})

test('failed read/delete mutations do not create successful-mutation tombstones', async () => {
  responses.set('PATCH /notifications/notification-1/read', new Error('Unavailable'))
  responses.set('DELETE /notifications/notification-1', new Error('Unavailable'))
  await assert.rejects(store.markAsRead('notification-1'), /Unavailable/)
  await assert.rejects(store.remove('notification-1'), /Unavailable/)
  assert.equal(store.reconcileNotification(notice()).isRead, false)
  assert.equal(store.reconcileNotifications([notice()]).length, 1)
})

test('concurrent ignore actions and a delayed read cannot double-decrement unread', async () => {
  store.unreadCount = 4
  let finishRead
  responses.set(
    'PATCH /notifications/notification-1/read',
    new Promise((resolve) => (finishRead = resolve)),
  )
  const read = store.markAsRead('notification-1')
  await Promise.all([store.remove('notification-1'), store.remove('notification-1')])
  finishRead({ ...notice(), isRead: true })
  await read
  assert.equal(store.unreadCount, 3)
  assert.equal(store.reconcileNotification(notice()), null)
})

test('mutation tombstones and read reconciliation reset with the user session', async () => {
  const user = useUserStore()
  user.user = { id: 'invitee-1' }
  await store.remove('notification-1')
  await store.markAsRead('read-in-old-session')
  user.user = { id: 'next-user' }
  const current = notice({ userId: 'next-user' })
  assert.equal(store.reconcileNotification(current).isRead, false)
  assert.equal(store.reconcileNotification({ ...current, id: 'read-in-old-session' }).isRead, false)
  assert.equal(store.reconcileNotification(notice()), null)
})

test('detail lookup fetches an old projected notification directly instead of scanning 250 entries', async () => {
  const old = notice({
    id: 'older-than-250',
    createdAt: '2020-01-01T00:00:00.000Z',
    meta: { ...notice().meta, invitationStatus: 'REVOKED', actionable: false },
  })
  store.recent = [notice({ id: old.id })]
  responses.set(`GET /notifications/${old.id}`, old)
  const result = await store.loadNotification(old.id)
  assert.deepEqual(result, old)
  assert.equal(canActOnInvitation(result), false)
  assert.deepEqual(calls, [{ method: 'GET', path: `/notifications/${old.id}`, params: undefined }])
})

test('detail responses reconcile reads and deletions completed while the lookup was pending', async () => {
  let finish
  responses.set('GET /notifications/notification-1', new Promise((resolve) => (finish = resolve)))
  const first = store.loadNotification('notification-1')
  await store.markAsRead('notification-1')
  finish(notice())
  assert.equal((await first).isRead, true)
  responses.set('GET /notifications/notification-1', new Promise((resolve) => (finish = resolve)))
  const second = store.loadNotification('notification-1')
  await store.remove('notification-1', false)
  finish(notice())
  assert.equal(await second, null)
  const count = calls.length
  assert.equal(await store.loadNotification('notification-1'), null)
  assert.equal(calls.length, count)
})

test('detail lookup rejects missing/private notifications and discards prior-session responses', async () => {
  responses.set('GET /notifications/missing', new Error('Not found'))
  await assert.rejects(store.loadNotification('missing'), /Not found/)
  const user = useUserStore()
  user.user = { id: 'invitee-1' }
  let finish
  responses.set('GET /notifications/notification-1', new Promise((resolve) => (finish = resolve)))
  const previous = store.loadNotification('notification-1')
  user.user = { id: 'next-user' }
  finish(notice())
  assert.equal(await previous, null)
  assert.deepEqual(store.recent, [])
})
