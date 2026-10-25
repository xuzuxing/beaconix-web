import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MONITOR_TYPE_OPTIONS,
  monitorConfigDefaults,
  monitorConfigDraft,
  monitorConfigHasCredentials,
  monitorConfigPayload,
  monitorTargetPlaceholderKey,
  parseAssertionValue,
} from '../src/utils/monitor-config.ts'

test('协议选项覆盖后端 11 种枚举', () => {
  assert.deepEqual(
    MONITOR_TYPE_OPTIONS.map((option) => option.value),
    [
      'HTTP',
      'TCP',
      'PING',
      'DNS',
      'MYSQL',
      'POSTGRESQL',
      'REDIS',
      'MONGODB',
      'DOCKER',
      'GRPC',
      'WEBSOCKET',
    ],
  )
})

test('target 占位按协议的目标形态选择', () => {
  assert.equal(monitorTargetPlaceholderKey('HTTP'), 'workspace.monitor.targetPlaceholder.http')
  assert.equal(
    monitorTargetPlaceholderKey('WEBSOCKET'),
    'workspace.monitor.targetPlaceholder.websocket',
  )
  assert.equal(monitorTargetPlaceholderKey('MYSQL'), 'workspace.monitor.targetPlaceholder.hostPort')
  assert.equal(monitorTargetPlaceholderKey('DNS'), 'workspace.monitor.targetPlaceholder.domain')
  assert.equal(monitorTargetPlaceholderKey('PING'), 'workspace.monitor.targetPlaceholder.hostname')
  assert.equal(monitorTargetPlaceholderKey('DOCKER'), 'workspace.monitor.targetPlaceholder.docker')
})

test('只有携带凭据的协议需要提示重新填写', () => {
  assert.equal(monitorConfigHasCredentials('MYSQL'), true)
  assert.equal(monitorConfigHasCredentials('WEBSOCKET'), true)
  assert.equal(monitorConfigHasCredentials('DOCKER'), true)
  assert.equal(monitorConfigHasCredentials('HTTP'), false)
  assert.equal(monitorConfigHasCredentials('TCP'), false)
  assert.equal(monitorConfigHasCredentials('DNS'), false)
})

test('默认配置覆盖每种协议', () => {
  assert.deepEqual(monitorConfigDefaults('TCP'), {})
  assert.deepEqual(monitorConfigDefaults('REDIS'), {
    username: '',
    password: '',
    db: 0,
    tls: true,
    tlsCa: '',
  })
  assert.deepEqual(monitorConfigDefaults('MONGODB'), {
    username: '',
    password: '',
    database: '',
    authSource: 'admin',
    tls: true,
    tlsCa: '',
  })
})

test('草稿只合并已知字段，未知字段与默认值保持不动', () => {
  const draft = monitorConfigDraft('REDIS', { db: 3, unknown: 1 })
  assert.deepEqual(draft, {
    username: '',
    password: '',
    db: 3,
    tls: true,
    tlsCa: '',
  })
  assert.equal('unknown' in draft, false)
})

test('JSON 断言的值按字面量解析', () => {
  assert.equal(parseAssertionValue('1'), 1)
  assert.equal(parseAssertionValue('1.5'), 1.5)
  assert.equal(parseAssertionValue('-2'), -2)
  assert.equal(parseAssertionValue('true'), true)
  assert.equal(parseAssertionValue('false'), false)
  assert.equal(parseAssertionValue('null'), null)
  assert.equal(parseAssertionValue('OK'), 'OK')
  assert.equal(parseAssertionValue('1a'), '1a')
  assert.equal(parseAssertionValue(''), '')
})

test('HTTP：关键字与断言均可选，读取上限只在有断言时提交', () => {
  assert.deepEqual(monitorConfigPayload('HTTP', { keyword: '', jsonAssertions: [] }), {})
  assert.deepEqual(monitorConfigPayload('HTTP', { keyword: 'ok', jsonAssertions: [] }), {
    keyword: 'ok',
    keywordMode: 'contains',
  })
  assert.deepEqual(
    monitorConfigPayload('HTTP', {
      keyword: 'ok',
      keywordMode: 'notContains',
      jsonAssertions: [{ path: '/data/status', operator: 'eq', value: 200 }],
      maxBodyBytes: 4096,
    }),
    {
      keyword: 'ok',
      keywordMode: 'notContains',
      jsonAssertions: [{ path: '/data/status', operator: 'eq', value: 200 }],
      maxBodyBytes: 4096,
    },
  )
  // exists / notExists 不带 value；空指针保留（代表根节点）
  assert.deepEqual(
    monitorConfigPayload('HTTP', {
      jsonAssertions: [{ path: '', operator: 'exists', value: 1 }],
    }),
    { jsonAssertions: [{ path: '', operator: 'exists' }] },
  )
  // 关键字同样属于响应体断言，因此读取上限可以提交
  assert.deepEqual(monitorConfigPayload('HTTP', { keyword: 'ok', maxBodyBytes: 4096 }), {
    keyword: 'ok',
    keywordMode: 'contains',
    maxBodyBytes: 4096,
  })
})

test('DNS：默认记录类型，期望值去空后提交', () => {
  assert.deepEqual(monitorConfigPayload('DNS', { expectedValues: [] }), {
    recordType: 'A',
  })
  assert.deepEqual(
    monitorConfigPayload('DNS', {
      recordType: 'AAAA',
      expectedValues: [' 1.1.1.1 ', ''],
    }),
    { recordType: 'AAAA', expectedValues: ['1.1.1.1'] },
  )
})

test('数据库与容器协议：保留 tls / db / authSource 默认值，空的可选字段不提交', () => {
  assert.deepEqual(monitorConfigPayload('MYSQL', { username: 'u', database: 'd' }), {
    username: 'u',
    database: 'd',
    tls: true,
  })
  assert.deepEqual(
    monitorConfigPayload('POSTGRESQL', {
      username: 'u',
      database: 'd',
      tls: false,
      password: '',
    }),
    { username: 'u', database: 'd', tls: false },
  )
  assert.deepEqual(monitorConfigPayload('REDIS', { db: 0 }), {
    db: 0,
    tls: true,
  })
  assert.deepEqual(monitorConfigPayload('MONGODB', {}), {
    authSource: 'admin',
    tls: true,
  })
  assert.deepEqual(monitorConfigPayload('DOCKER', { containerId: 'abc' }), {
    containerId: 'abc',
  })
  assert.deepEqual(monitorConfigPayload('GRPC', { service: '' }), { tls: true })
  assert.deepEqual(monitorConfigPayload('WEBSOCKET', { token: 't' }), {
    token: 't',
  })
})

test('TCP / PING 不产生配置', () => {
  assert.deepEqual(monitorConfigPayload('TCP', { keyword: 'ignored' }), {})
  assert.deepEqual(monitorConfigPayload('PING', {}), {})
})
