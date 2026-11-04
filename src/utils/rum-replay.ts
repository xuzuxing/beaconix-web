import type { RumReplayEvent } from '@/api/types/rum'
const allowedTags = new Set(
  'html body main section article header footer nav div span p h1 h2 h3 h4 h5 h6 ul ol li table thead tbody tr th td pre code blockquote strong em b i small br hr label button input textarea select option'.split(
    ' ',
  ),
)
const blockedTags = new Set(
  'script noscript iframe object embed base meta link style svg math template'.split(' '),
)
/** Rebuilds a small inert HTML subset. No URLs, styles, forms or event attributes survive. */
export function sanitizeReplaySnapshot(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const out = document.implementation.createHTMLDocument('')
  const clone = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(out.createTextNode(node.textContent ?? ''))
      return
    }
    if (!(node instanceof Element)) return
    const tag = node.tagName.toLowerCase()
    if (blockedTags.has(tag)) return
    const next = allowedTags.has(tag)
      ? out.createElement(tag === 'html' || tag === 'body' ? 'div' : tag)
      : parent
    if (next !== parent) {
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button')
        (next as HTMLElement).setAttribute('disabled', '')
      parent.appendChild(next)
    }
    for (const child of Array.from(node.childNodes)) clone(child, next)
  }
  clone(parsed.body, out.body)
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'none'; img-src 'none'; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'"></head><body>${out.body.innerHTML}</body></html>`
}
export function parseReplayEvents(value: unknown): RumReplayEvent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return []
    const entry = item as Record<string, unknown>
    if (
      typeof entry.type !== 'string' ||
      typeof entry.at !== 'string' ||
      !entry.data ||
      typeof entry.data !== 'object' ||
      Array.isArray(entry.data)
    )
      return []
    const data = { ...(entry.data as Record<string, unknown>) }
    if (entry.type === 'input') data.value = '[REDACTED]'
    return [{ type: entry.type, at: entry.at, data }]
  })
}

/** Cursor is exclusive. Stop on an empty batch or null cursor; reject non-progress. */
export async function loadReplayTimeline(
  fetchBatch: (cursor: number) => Promise<import('@/api/types/rum').RumReplayChunks>,
): Promise<RumReplayEvent[]> {
  let cursor = -1
  const seen = new Set<number>()
  const events: RumReplayEvent[] = []
  for (let batches = 0; ; batches++) {
    if (batches >= 1000) throw new Error('Replay exceeds safety limit')
    const batch = await fetchBatch(cursor)
    for (const chunk of batch.items) {
      if (!seen.has(chunk.sequence)) {
        seen.add(chunk.sequence)
        events.push(...parseReplayEvents(chunk.events))
      }
    }
    if (!batch.items.length || batch.nextSequence === null) break
    if (batch.nextSequence <= cursor) throw new Error('Replay cursor did not advance')
    cursor = batch.nextSequence
  }
  return events.sort((x, y) => Date.parse(x.at) - Date.parse(y.at))
}
