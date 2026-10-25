/**
 * 把高频的重验信号合并成有节流的调用。
 *
 * 权限重验会被前台 focus、可见性变化、网络恢复、定时器、多标签页信号与 SSE 重连
 * 等大量事件触发；每两次触发都可能对 `/my-permissions` 各发一次强制刷新请求。
 * 这些事件常常在同一瞬间叠加（切回窗口会同时触发 focus 与 visibilitychange，
 * SSE 断开又会在重连时补一次信号），未合并时会形成请求风暴并触发后端限流。
 *
 * 语义：
 * - 距上次执行已超过 intervalMs：立即执行（leading）。
 * - 窗口内的重复触发：合并为一次窗口结束时的补跑（trailing），不会无限排队。
 */
export function createRevalidateScheduler(
  run: () => void,
  intervalMs: number,
  now: () => number = Date.now,
) {
  let lastRun = Number.NEGATIVE_INFINITY
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false

  function trigger() {
    const elapsed = now() - lastRun
    if (timer === undefined && elapsed >= intervalMs) {
      lastRun = now()
      run()
      return
    }
    pending = true
    if (timer !== undefined) return
    timer = setTimeout(
      () => {
        timer = undefined
        if (!pending) return
        pending = false
        lastRun = now()
        run()
      },
      Math.max(0, intervalMs - elapsed),
    )
  }

  function cancel() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = false
  }

  return { trigger, cancel }
}
