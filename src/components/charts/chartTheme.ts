import { computed, ref, watch } from 'vue'

import { useAppStore } from '@/stores'

/**
 * 图表配色：echarts 画在 canvas 上，读不到 CSS 变量，
 * 因此这里在主题切换后从 :root 上把 TDesign 令牌解析成具体色值，
 * 供各图表的 option 使用（暗色切换时自动重算）。
 */
export interface ChartTheme {
  /** 主文本色（图表标题、轴标签） */
  text: string
  /** 次级文本色 */
  textSecondary: string
  /** 三级文本色（刻度、提示） */
  textTertiary: string
  /** 轴线的颜色 */
  axisLine: string
  /** 网格分隔线（浅） */
  splitLine: string
  /** 卡片底色，用于 tooltip 背景 */
  container: string
  /** 卡片边框色 */
  border: string
  /** 依次分配的多色序列 */
  series: string[]
  brand: string
  success: string
  warning: string
  error: string
  /** 面积图/面积渐变的透明度（暗色下略高，避免发灰） */
  areaOpacity: number
}

/**
 * 给令牌色值套上透明度：从 CSS 变量取到的可能是 #rgb / #rrggbb / rgb() / rgba()，
 * 面积填充、热力图色带与提示背景都要按透明度生成变体。
 */
export function withAlpha(color: string, alpha: number): string {
  const value = color.trim()

  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const full = hex.length === 3 ? hex.replace(/./g, (char) => char + char) : hex.slice(0, 6)
    const red = Number.parseInt(full.slice(0, 2), 16)
    const green = Number.parseInt(full.slice(2, 4), 16)
    const blue = Number.parseInt(full.slice(4, 6), 16)
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  }

  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/)
  const channels = rgbMatch?.[1]?.split(',').map((part) => Number.parseFloat(part)) ?? []
  if (channels.length >= 3) {
    const [red, green, blue] = channels as [number, number, number]
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  }

  // 无法解析（如主题变量未就绪）时原样返回，避免图表报错
  return value
}

function readToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function resolveChartTheme(): ChartTheme {
  const brand = readToken('--td-brand-color', '#0052d9')
  const success = readToken('--td-success-color', '#2ba471')
  const warning = readToken('--td-warning-color', '#e37318')
  const error = readToken('--td-error-color', '#d54941')

  return {
    text: readToken('--td-text-color-primary', '#000000e6'),
    textSecondary: readToken('--td-text-color-secondary', '#00000099'),
    textTertiary: readToken('--td-text-color-placeholder', '#00000080'),
    axisLine: readToken('--td-border-level-2-color', '#d6dbe3'),
    splitLine: readToken('--td-border-level-1-color', '#e6e9ef'),
    container: readToken('--td-bg-color-container', '#ffffff'),
    border: readToken('--td-border-level-1-color', '#e6e9ef'),
    brand,
    success,
    warning,
    error,
    series: [
      brand,
      success,
      warning,
      error,
      readToken('--td-brand-color-4', '#8eabff'),
      readToken('--td-brand-color-9', '#003a99'),
      readToken('--td-brand-color-5', '#618dff'),
    ],
    areaOpacity: 0.16,
  }
}

/** 响应主题切换的图表配色（返回 computed，随明暗模式变化） */
export function useChartTheme() {
  const appStore = useAppStore()
  const theme = ref(resolveChartTheme())

  // 主题属性写在 <html theme-mode> 上，等浏览器完成样式重算后再读令牌
  watch(
    () => appStore.isDark,
    () => requestAnimationFrame(() => (theme.value = resolveChartTheme())),
    { immediate: true },
  )

  return computed(() => theme.value)
}
