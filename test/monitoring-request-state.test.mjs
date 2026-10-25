import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MonitoringRequestState } from '../src/utils/monitoring-request-state.ts'

test('conditional requests are isolated by project and parameters', async () => {
  const state = new MonitoringRequestState()
  const body = { checks: 10 }
  await state.load('p1:1h:UTC', async () => ({
    status: 200,
    etag: 'W/"1"',
    body,
  }))
  const again = await state.load('p1:1h:UTC', async (etag) => {
    assert.equal(etag, 'W/"1"')
    return { status: 304 }
  })
  assert.equal(again, body)
  await state.load('p2:1h:UTC', async (etag) => {
    assert.equal(etag, undefined)
    return { status: 200, body: { checks: 20 } }
  })
})
test('304 without a retained body retries unconditionally', async () => {
  const state = new MonitoringRequestState()
  let calls = 0
  const result = await state.load('missing', async (etag) => {
    assert.equal(etag, undefined)
    return ++calls === 1 ? { status: 304 } : { status: 200, body: 42 }
  })
  assert.equal(result, 42)
})
test('project switches invalidate in-flight response ownership and errors do not fabricate data', async () => {
  const state = new MonitoringRequestState()
  const first = state.begin()
  const second = state.begin()
  assert.equal(state.current(first), false)
  assert.equal(state.current(second), true)
  await assert.rejects(
    state.load('failed', async () => {
      throw new Error('offline')
    }),
    /offline/,
  )
})
