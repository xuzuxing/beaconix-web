export interface ConditionalResponse<T> {
  status: number
  etag?: string
  body?: T
}
export class MonitoringRequestState {
  private entries = new Map<string, { etag?: string; body: unknown }>()
  private generation = 0
  begin() {
    return ++this.generation
  }
  current(token: number) {
    return this.generation === token
  }
  clear() {
    this.entries.clear()
    this.begin()
  }
  async load<T>(key: string, send: (etag?: string) => Promise<ConditionalResponse<T>>): Promise<T> {
    const context = accessContext()
    const token = this.generation
    const contextualKey = `${JSON.stringify(context)}:${key}`
    const current = () => token === this.generation && isCurrentContext(context)
    const old = this.entries.get(contextualKey)
    let response = await send(old?.etag)
    if (!current()) throw new StaleAccessError()
    if (response.status === 304) {
      if (old) return old.body as T
      response = await send()
      if (!current()) throw new StaleAccessError()
    }
    if (response.status !== 200 || response.body === undefined)
      throw new Error('Invalid monitoring response')
    this.entries.set(contextualKey, { etag: response.etag, body: response.body })
    if (this.entries.size > 100) this.entries.delete(this.entries.keys().next().value!)
    return response.body
  }
}
import { accessContext, isCurrentContext, StaleAccessError } from './access-context'
