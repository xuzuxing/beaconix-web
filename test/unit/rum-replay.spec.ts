import { describe, expect, it } from 'vitest'
import { loadReplayTimeline, parseReplayEvents, sanitizeReplaySnapshot } from '@/utils/rum-replay'

describe('untrusted replay data', () => {
  it('rebuilds a network-free, inert snapshot', () => {
    const html = sanitizeReplaySnapshot(
      '<main onclick="alert(1)"><script>alert(1)</script><img src="https://evil.test/a"><iframe srcdoc="bad"></iframe><a href="javascript:alert(1)">hello</a><input value="secret" onfocus="alert(1)"><style>@import url(https://evil.test/x)</style></main>',
    )
    expect(html).toContain("default-src 'none'")
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('evil.test')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('secret')
    expect(html).toContain('hello')
    expect(html).toContain('disabled')
  })
  it('rejects malformed events and redacts input even if the server did not', () => {
    expect(
      parseReplayEvents([
        null,
        { type: 'input', at: '2026-01-01', data: { value: 'sensitive', target: '#a' } },
        { type: 4 },
      ]),
    ).toEqual([{ type: 'input', at: '2026-01-01', data: { value: '[REDACTED]', target: '#a' } }])
  })
  it('uses the returned exclusive cursor and deduplicates chunks', async () => {
    const cursors: number[] = []
    const events = await loadReplayTimeline(async (cursor) => {
      cursors.push(cursor)
      const item = {
        id: '1',
        sequence: 2,
        events: [{ type: 'click', at: '2026-01-01', data: {} }],
        eventCount: 1,
        sizeBytes: 1,
        occurredAt: '',
      }
      return cursor === -1
        ? { items: [item], nextSequence: 2 }
        : { items: [item], nextSequence: null }
    })
    expect(cursors).toEqual([-1, 2])
    expect(events).toHaveLength(1)
  })
  it('rejects a cursor that does not advance', async () => {
    await expect(
      loadReplayTimeline(async () => ({
        items: [{ id: '1', sequence: 0, events: [], eventCount: 0, sizeBytes: 0, occurredAt: '' }],
        nextSequence: 0,
      })),
    ).rejects.toThrow('cursor did not advance')
  })
})
