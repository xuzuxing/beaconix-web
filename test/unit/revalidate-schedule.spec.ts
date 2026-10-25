import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRevalidateScheduler } from '@/utils/revalidate-schedule'

describe('revalidate scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs immediately when idle and coalesces a burst into a single trailing run', () => {
    let clock = 0
    const run = vi.fn()
    const scheduler = createRevalidateScheduler(run, 3_000, () => clock)

    scheduler.trigger()
    expect(run).toHaveBeenCalledTimes(1)

    // 切回窗口时 focus / visibilitychange / SSE 重连信号常常同时到达
    scheduler.trigger()
    scheduler.trigger()
    scheduler.trigger()
    expect(run).toHaveBeenCalledTimes(1)

    clock = 3_000
    vi.advanceTimersByTime(3_000)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('leaves no trailing timer behind after a leading run', () => {
    const clock = 0
    const run = vi.fn()
    const scheduler = createRevalidateScheduler(run, 3_000, () => clock)

    scheduler.trigger()
    vi.advanceTimersByTime(60_000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('runs again immediately once the interval has elapsed', () => {
    let clock = 0
    const run = vi.fn()
    const scheduler = createRevalidateScheduler(run, 3_000, () => clock)

    scheduler.trigger()
    clock = 5_000
    scheduler.trigger()
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('drops a pending trailing run on cancel', () => {
    let clock = 0
    const run = vi.fn()
    const scheduler = createRevalidateScheduler(run, 3_000, () => clock)

    scheduler.trigger()
    clock = 100
    scheduler.trigger()
    scheduler.cancel()
    vi.advanceTimersByTime(60_000)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
