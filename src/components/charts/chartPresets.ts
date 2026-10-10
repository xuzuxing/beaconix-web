import { withAlpha, type ChartTheme } from './chartTheme'
import type { ChartOption } from './echarts'

/**
 * 图表通用片段：坐标轴、提示框、图例与面积渐变。
 * 各图表只写差异部分，统一在这里保证观感与主题跟随。
 */

/** 统一的绘图区边距（containLabel 保证刻度不被裁切） */
export const chartGrid = { left: 0, right: 0, top: 34, bottom: 0, containLabel: true }

/** 提示框：跟随主题底色与边框 */
export function chartTooltip(theme: ChartTheme, trigger: 'axis' | 'item' = 'axis') {
  return {
    trigger,
    backgroundColor: theme.container,
    borderColor: theme.border,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: theme.text, fontSize: 12 },
    axisPointer: {
      type: 'line' as const,
      lineStyle: { color: theme.axisLine, type: 'dashed' as const },
    },
  }
}

/** 图例：小圆点 + 次级文本色 */
export function chartLegend(theme: ChartTheme, data?: string[]) {
  return {
    data,
    top: 0,
    right: 0,
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 12,
    textStyle: { color: theme.textSecondary, fontSize: 12 },
  }
}

/** 类目轴（时间轴 / 分桶标签） */
export function categoryAxis(
  theme: ChartTheme,
  data: string[],
  boundaryGap = false,
  labelOptions: { hideOverlap?: boolean; interval?: number } = {},
) {
  return {
    type: 'category' as const,
    boundaryGap,
    data,
    axisLine: { lineStyle: { color: theme.axisLine } },
    axisTick: { show: false },
    axisLabel: {
      color: theme.textTertiary,
      fontSize: 10,
      hideOverlap: labelOptions.hideOverlap ?? true,
      interval: labelOptions.interval,
      margin: 10,
    },
  }
}

/** 数值轴 */
export function valueAxis(
  theme: ChartTheme,
  options: { name?: string; min?: number; max?: number; formatter?: string } = {},
) {
  return {
    type: 'value' as const,
    name: options.name,
    min: options.min,
    max: options.max,
    nameTextStyle: { color: theme.textTertiary, fontSize: 10, align: 'left' as const },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: theme.splitLine } },
    axisLabel: {
      color: theme.textTertiary,
      fontSize: 10,
      formatter: options.formatter,
    },
  }
}

/** 折线/面积的下沉渐变，避免大面积实色压住网格线 */
export function areaGradient(color: string, fromOpacity = 0.22, toOpacity = 0.01) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: withAlpha(color, fromOpacity) },
      { offset: 1, color: withAlpha(color, toOpacity) },
    ],
  }
}

/** 折线/面积的样式包装：折线系列直接把它交给 areaStyle */
export function areaStyle(color: string, fromOpacity = 0.22, toOpacity = 0.01) {
  return { color: areaGradient(color, fromOpacity, toOpacity) }
}

/** 图表的基础配置：各图表用 spread 合并差异部分 */
export function chartBase(theme: ChartTheme, option: ChartOption): ChartOption {
  return {
    backgroundColor: 'transparent',
    animationDuration: 400,
    textStyle: { color: theme.text, fontSize: 12 },
    ...option,
  }
}
