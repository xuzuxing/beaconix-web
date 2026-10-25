import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PAT_DEFAULT_TTL_DAYS,
  PAT_SCOPES,
  canRevokePat,
  patDefaultExpiry,
  patScopeLabelKey,
  patState,
  patStateTheme,
  validatePatCreate,
} from '../src/utils/personal-access-token-presenter.ts'

const token = (overrides = {}) => ({
  id: 'pat-1',
  userId: 'u1',
  name: 'My laptop',
  scopes: ['monitors:read'],
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const NOW = Date.parse('2026-06-01T00:00:00.000Z')

test('令牌状态：吊销优先于过期', () => {
  assert.equal(patState(token(), NOW), 'active')
  assert.equal(patState(token({ revokedAt: '2026-02-01T00:00:00.000Z' }), NOW), 'revoked')
  assert.equal(
    patState(
      token({
        revokedAt: '2026-02-01T00:00:00.000Z',
        expiresAt: '2026-03-01T00:00:00.000Z',
      }),
      NOW,
    ),
    'revoked',
  )
})

test('令牌状态：过期按 expiresAt 判断', () => {
  assert.equal(patState(token({ expiresAt: '2026-07-01T00:00:00.000Z' }), NOW), 'active')
  assert.equal(patState(token({ expiresAt: '2026-05-01T00:00:00.000Z' }), NOW), 'expired')
})

test('状态主题与可吊销性', () => {
  assert.equal(patStateTheme('active'), 'success')
  assert.equal(patStateTheme('expired'), 'warning')
  assert.equal(patStateTheme('revoked'), 'default')
  assert.equal(canRevokePat(token(), NOW), true)
  assert.equal(canRevokePat(token({ revokedAt: '2026-02-01T00:00:00.000Z' }), NOW), false)
  // 已过期但仍未吊销，仍可吊销
  assert.equal(canRevokePat(token({ expiresAt: '2026-05-01T00:00:00.000Z' }), NOW), true)
})

test('默认有效期为 30 天', () => {
  assert.equal(PAT_DEFAULT_TTL_DAYS, 30)
  const from = Date.parse('2026-01-01T00:00:00.000Z')
  assert.equal(patDefaultExpiry(from), '2026-01-31T00:00:00.000Z')
})

test('权限范围覆盖契约枚举', () => {
  assert.deepEqual(PAT_SCOPES, [
    'monitors:read',
    'monitors:write',
    'probes:read',
    'probes:write',
    'status-pages:read',
    'status-pages:write',
    'monitoring:read',
  ])
})

test('权限范围映射到 i18n key', () => {
  assert.equal(patScopeLabelKey('monitors:read'), 'workspace.pat.scope.monitorsRead')
  assert.equal(patScopeLabelKey('status-pages:write'), 'workspace.pat.scope.statusPagesWrite')
  assert.equal(patScopeLabelKey('monitoring:read'), 'workspace.pat.scope.monitoringRead')
})

test('创建表单：名称必填', () => {
  assert.equal(
    validatePatCreate(
      {
        name: '   ',
        scopes: ['monitors:read'],
        expiry: 'default',
        expiresAt: '',
      },
      NOW,
    ),
    'nameRequired',
  )
})

test('创建表单：至少选择一项权限范围', () => {
  assert.equal(
    validatePatCreate({ name: 'CI', scopes: [], expiry: 'default', expiresAt: '' }, NOW),
    'scopesRequired',
  )
})

test('创建表单：自定义过期时间需晚于当前', () => {
  assert.equal(
    validatePatCreate(
      {
        name: 'CI',
        scopes: ['monitors:read'],
        expiry: 'custom',
        expiresAt: '',
      },
      NOW,
    ),
    'expiresInvalid',
  )
  assert.equal(
    validatePatCreate(
      {
        name: 'CI',
        scopes: ['monitors:read'],
        expiry: 'custom',
        expiresAt: '2026-05-01T00:00:00.000Z',
      },
      NOW,
    ),
    'expiresInvalid',
  )
  assert.equal(
    validatePatCreate(
      {
        name: 'CI',
        scopes: ['monitors:read'],
        expiry: 'custom',
        expiresAt: '2026-09-01T00:00:00.000Z',
      },
      NOW,
    ),
    '',
  )
})

test('创建表单：默认过期方式无需 expiresAt', () => {
  assert.equal(
    validatePatCreate(
      { name: 'CI', scopes: ['probes:read'], expiry: 'default', expiresAt: '' },
      NOW,
    ),
    '',
  )
})
