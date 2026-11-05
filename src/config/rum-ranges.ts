/**
 * 概览类页面共用的时间范围：应用概览与错误概览保持同一套窗口与分桶，
 * 避免两个页面同一范围却给出不同粒度。
 */
export type RumRange = '1h' | '24h' | '7d' | '30d'

export const RUM_RANGES: RumRange[] = ['1h', '24h', '7d', '30d']

export const RUM_RANGE_WINDOWS: Record<
  RumRange,
  { hours: number; bucketMinutes: number }
> = {
  '1h': { hours: 1, bucketMinutes: 5 },
  '24h': { hours: 24, bucketMinutes: 60 },
  '7d': { hours: 168, bucketMinutes: 360 },
  '30d': { hours: 720, bucketMinutes: 1440 },
}

/** 把范围换算成后端需要的 from/to/bucketMinutes */
export function rumRangeWindow(range: RumRange) {
  const config = RUM_RANGE_WINDOWS[range]
  const to = new Date()
  const from = new Date(to.getTime() - config.hours * 3_600_000)
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    bucketMinutes: config.bucketMinutes,
  }
}
