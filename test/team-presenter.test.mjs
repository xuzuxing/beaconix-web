import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  API_KEY_SCOPES,
  AUDIT_ACTIONS,
  apiKeyDisplay,
  apiKeyScopeLabelKey,
  apiKeyState,
  apiKeyStateTheme,
  auditActionTheme,
  canRevokeApiKey,
  diffSnapshots,
  formatSnapshot,
  invitationTheme,
  isInvitationExpired,
  isPendingInvitation,
  memberIdentity,
  memberPermissions,
  selectInvitations,
  selectMembers,
  shortId,
} from '../src/utils/team-presenter.ts'

const member = (overrides = {}) => ({
  id: 'm1',
  userId: 'user-1',
  organizationId: 'org-1',
  role: 'MEMBER',
  joinedAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  invitedById: null,
  ...overrides,
})

test('成员身份优先使用内嵌用户资料', () => {
  const identity = memberIdentity(
    member({
      user: {
        id: 'user-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        avatarUrl: null,
      },
    }),
  )
  assert.deepEqual(identity, {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    initial: 'A',
    fallback: false,
  })
})

test('缺少内嵌用户资料时回退为 userId 短码', () => {
  const identity = memberIdentity(member({ userId: 'cmgu92m5x0002p8l4h8z6s3k3', user: null }))
  assert.equal(identity.name, 'cmgu92…s3k3')
  assert.equal(identity.email, '')
  assert.equal(identity.initial, 'C')
  assert.equal(identity.fallback, true)
  assert.equal(memberIdentity(member({ userId: 'short', user: undefined })).name, 'short')
})

test('shortId 保留首尾、短 id 原样', () => {
  assert.equal(shortId(''), '-')
  assert.equal(shortId('abcdefghijkl'), 'abcdefghijkl')
  assert.equal(shortId('abcdefghijklmn'), 'abcdef…klmn')
})

test('成员筛选：关键词匹配姓名 / 邮箱 / userId，角色可过滤', () => {
  const members = [
    member({
      id: 'a',
      userId: 'u-1',
      role: 'OWNER',
      joinedAt: '2026-01-01T00:00:00.000Z',
    }),
    member({
      id: 'b',
      userId: 'u-2',
      role: 'ADMIN',
      joinedAt: '2026-03-02T00:00:00.000Z',
      user: {
        id: 'u-2',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        avatarUrl: null,
      },
    }),
    member({
      id: 'c',
      userId: 'u-3',
      role: 'MEMBER',
      joinedAt: '2026-03-03T00:00:00.000Z',
      user: {
        id: 'u-3',
        name: 'Alan Turing',
        email: 'alan@example.com',
        avatarUrl: null,
      },
    }),
  ]

  assert.deepEqual(
    selectMembers(members, '', 'all').map((item) => item.id),
    ['a', 'c', 'b'],
  )
  assert.deepEqual(
    selectMembers(members, 'grace@', 'all').map((item) => item.id),
    ['b'],
  )
  assert.deepEqual(
    selectMembers(members, 'u-1', 'all').map((item) => item.id),
    ['a'],
  )
  assert.deepEqual(
    selectMembers(members, '', 'MEMBER').map((item) => item.id),
    ['c'],
  )
  assert.deepEqual(selectMembers(members, 'nobody', 'all'), [])
})

test('成员操作：自己与 OWNER 不可改角色 / 移除，无管理权限时全部关闭', () => {
  const owner = member({ role: 'OWNER', userId: 'u-1' })
  const other = member({ id: 'm2', role: 'MEMBER', userId: 'u-2' })
  const self = member({ id: 'm3', role: 'ADMIN', userId: 'u-9' })

  assert.deepEqual(memberPermissions(owner, { currentUserId: 'u-9', canManage: true }), {
    isSelf: false,
    isOwner: true,
    canChangeRole: false,
    canRemove: false,
  })
  assert.equal(memberPermissions(other, { currentUserId: 'u-9', canManage: true }).canRemove, true)
  assert.equal(memberPermissions(self, { currentUserId: 'u-9', canManage: true }).isSelf, true)
  assert.equal(
    memberPermissions(other, { currentUserId: 'u-9', canManage: true }).canChangeRole,
    true,
  )
  assert.equal(
    memberPermissions(other, { currentUserId: 'u-9', canManage: false }).canRemove,
    false,
  )
})

const invitation = (overrides = {}) => ({
  id: 'inv-1',
  email: 'invitee@example.com',
  organizationId: 'org-1',
  role: 'MEMBER',
  status: 'PENDING',
  token: 'tok',
  expiresAt: '2099-01-01T00:00:00.000Z',
  sentById: 'u-1',
  acceptedAt: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...overrides,
})

test('邀请状态文案主题与待处理判定', () => {
  assert.equal(invitationTheme('PENDING'), 'warning')
  assert.equal(invitationTheme('ACCEPTED'), 'success')
  assert.equal(invitationTheme('REVOKED'), 'default')
  assert.equal(isPendingInvitation(invitation()), true)
  assert.equal(isPendingInvitation(invitation({ status: 'EXPIRED' })), false)
})

test('邀请排序：待处理置前，其余按创建时间倒序', () => {
  const list = [
    invitation({
      id: 'a',
      status: 'REVOKED',
      createdAt: '2026-03-05T00:00:00.000Z',
    }),
    invitation({
      id: 'b',
      status: 'PENDING',
      createdAt: '2026-03-01T00:00:00.000Z',
    }),
    invitation({
      id: 'c',
      status: 'ACCEPTED',
      createdAt: '2026-03-04T00:00:00.000Z',
    }),
    invitation({
      id: 'd',
      status: 'PENDING',
      createdAt: '2026-03-03T00:00:00.000Z',
    }),
  ]
  assert.deepEqual(
    selectInvitations(list).map((item) => item.id),
    ['d', 'b', 'a', 'c'],
  )
})

test('邀请过期按 expiresAt 判断', () => {
  const now = Date.parse('2026-03-05T00:00:00.000Z')
  assert.equal(
    isInvitationExpired(invitation({ expiresAt: '2026-03-04T00:00:00.000Z' }), now),
    true,
  )
  assert.equal(
    isInvitationExpired(invitation({ expiresAt: '2026-03-06T00:00:00.000Z' }), now),
    false,
  )
  assert.equal(isInvitationExpired(invitation({ expiresAt: '' }), now), false)
})

const apiKey = (overrides = {}) => ({
  id: 'key-1',
  organizationId: 'org-1',
  name: 'Production CI',
  keyPrefix: 'bk_org_1a2b3c4d',
  scopes: ['monitors:read'],
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
  createdById: 'u-1',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...overrides,
})

test('密钥状态：可用 / 已过期 / 已作废，作废优先于过期', () => {
  const now = Date.parse('2026-03-05T00:00:00.000Z')
  assert.equal(apiKeyState(apiKey(), now), 'active')
  assert.equal(apiKeyState(apiKey({ expiresAt: '2026-03-04T00:00:00.000Z' }), now), 'expired')
  assert.equal(apiKeyState(apiKey({ revokedAt: '2026-03-02T00:00:00.000Z' }), now), 'revoked')
  assert.equal(
    apiKeyState(
      apiKey({
        revokedAt: '2026-03-02T00:00:00.000Z',
        expiresAt: '2026-03-04T00:00:00.000Z',
      }),
      now,
    ),
    'revoked',
  )
  assert.equal(apiKeyStateTheme('active'), 'success')
  assert.equal(apiKeyStateTheme('expired'), 'warning')
  assert.equal(apiKeyStateTheme('revoked'), 'default')
})

test('只有未作废的密钥可以作废，掩码展示不泄露完整密钥', () => {
  assert.equal(canRevokeApiKey(apiKey()), true)
  assert.equal(canRevokeApiKey(apiKey({ revokedAt: '2026-03-02T00:00:00.000Z' })), false)
  assert.equal(apiKeyDisplay(apiKey()), 'bk_org_1a2b3c4d••••••••')
  assert.equal(apiKeyDisplay(apiKey({ keyPrefix: '' })), 'key-1')
  assert.equal(API_KEY_SCOPES.length, 7)
  assert.equal(AUDIT_ACTIONS.length, 14)
})

test('权限范围映射到 i18n key', () => {
  assert.equal(apiKeyScopeLabelKey('monitors:read'), 'workspace.apiKey.scope.monitorsRead')
  assert.equal(apiKeyScopeLabelKey('monitors:write'), 'workspace.apiKey.scope.monitorsWrite')
  assert.equal(apiKeyScopeLabelKey('status-pages:read'), 'workspace.apiKey.scope.statusPagesRead')
  assert.equal(apiKeyScopeLabelKey('status-pages:write'), 'workspace.apiKey.scope.statusPagesWrite')
  assert.equal(apiKeyScopeLabelKey('monitoring:read'), 'workspace.apiKey.scope.monitoringRead')
  // 每个后端枚举都应有对应文案键
  API_KEY_SCOPES.forEach((scope) => {
    assert.match(apiKeyScopeLabelKey(scope), /^workspace\.apiKey\.scope\.[a-z][A-Za-z]*$/)
  })
})

test('审计动作主题按破坏性着色', () => {
  assert.equal(auditActionTheme('CREATE'), 'success')
  assert.equal(auditActionTheme('DELETE'), 'danger')
  assert.equal(auditActionTheme('UPDATE'), 'warning')
  assert.equal(auditActionTheme('ASSIGN'), 'primary')
})

test('快照格式化：空值显示占位符', () => {
  assert.equal(formatSnapshot(null), '—')
  assert.equal(formatSnapshot(undefined), '—')
  assert.equal(formatSnapshot({}), '—')
  assert.equal(formatSnapshot({ name: 'Beacon' }), '{\n  "name": "Beacon"\n}')
})

test('快照差异：跳过时间戳、CREATE / DELETE 视为全量变化', () => {
  const update = diffSnapshots({
    id: 'log-1',
    action: 'UPDATE',
    entity: 'Project',
    entityId: 'p-1',
    actorId: 'u-1',
    organizationId: 'org-1',
    projectId: null,
    before: { name: 'Old', key: 'OLD', updatedAt: '2026-03-01T00:00:00.000Z' },
    after: { name: 'New', key: 'OLD', updatedAt: '2026-03-02T00:00:00.000Z' },
    ipAddress: null,
    userAgent: null,
    createdAt: '2026-03-02T00:00:00.000Z',
  })
  assert.deepEqual(update, [{ field: 'name', before: 'Old', after: 'New' }])

  const created = diffSnapshots({
    id: 'log-2',
    action: 'CREATE',
    entity: 'Monitor',
    entityId: 'mon-1',
    actorId: null,
    organizationId: 'org-1',
    projectId: null,
    before: null,
    after: { name: 'API', interval: 60, enabled: true },
    ipAddress: null,
    userAgent: null,
    createdAt: '2026-03-02T00:00:00.000Z',
  })
  assert.deepEqual(created, [
    { field: 'enabled', before: '—', after: 'true' },
    { field: 'interval', before: '—', after: '60' },
    { field: 'name', before: '—', after: 'API' },
  ])

  const removed = diffSnapshots({
    id: 'log-3',
    action: 'DELETE',
    entity: 'Project',
    entityId: 'p-1',
    actorId: null,
    organizationId: 'org-1',
    projectId: null,
    before: { name: 'Gone', description: null },
    after: null,
    ipAddress: null,
    userAgent: null,
    createdAt: '2026-03-02T00:00:00.000Z',
  })
  assert.deepEqual(removed, [{ field: 'name', before: 'Gone', after: '—' }])
})
