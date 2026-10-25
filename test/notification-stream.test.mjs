import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { calls, reset, responses } from './fixtures/notification-api.mjs'

const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/utils/request')
      return {
        url: new URL('./fixtures/notification-api.mjs', import.meta.url).href,
        shortCircuit: true,
      }
    return nextResolve(specifier, context)
  },
})
const { consumeNotificationStream, getUserNotificationById } =
  await import('../src/api/modules/notification-center.ts')
hook.deregister()

test('single-notification API encodes stable ids and returns projected detail without paging', async () => {
  reset()
  const item = {
    id: 'older/notification',
    userId: 'u1',
    type: 'INVITATION_RECEIVED',
    meta: {
      invitationStatus: 'EXPIRED',
      actionable: false,
      organizationId: 'org-1',
    },
  }
  responses.set('GET /notifications/older%2Fnotification', item)
  assert.deepEqual(await getUserNotificationById(item.id), item)
  assert.deepEqual(calls, [
    {
      method: 'GET',
      path: '/notifications/older%2Fnotification',
      params: undefined,
    },
  ])
})

test('JWT SSE uses an authorization header, parses split CRLF frames, and ignores heartbeats', async () => {
  const originalFetch = globalThis.fetch
  const item = {
    id: 'n1',
    userId: 'u1',
    type: 'MONITOR_ALERT',
    title: 'Alert',
    isRead: false,
    createdAt: '2026-10-11T00:00:00Z',
  }
  const frames = `: heartbeat\r\n\r\ndata: ${JSON.stringify(item)}\r\n\r\ndata: bad-json\n\n`
  let url, options
  globalThis.fetch = async (target, config) => {
    url = target
    options = config
    return new Response(
      new ReadableStream({
        start(controller) {
          for (const part of [frames.slice(0, 19), frames.slice(19, 75), frames.slice(75)])
            controller.enqueue(new TextEncoder().encode(part))
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  }
  try {
    const received = []
    const controller = new AbortController()
    await consumeNotificationStream('test-credential', controller.signal, (value) =>
      received.push(value),
    )
    assert.equal(url, '/api/notifications/stream')
    assert.ok(!url.includes('test-credential'))
    assert.equal(options.headers.Authorization, 'Bearer test-credential')
    assert.equal(options.signal, controller.signal)
    assert.deepEqual(received, [item])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('failed streams reject for the store retry loop without treating error bodies as events', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('Unauthorized', { status: 401 })
  try {
    await assert.rejects(
      consumeNotificationStream('test-credential', new AbortController().signal, () =>
        assert.fail(),
      ),
      /unavailable/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
