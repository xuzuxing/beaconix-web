import { BarChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { LegacyGridContainLabel } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'

import type { BarSeriesOption, HeatmapSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts'
import type {
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from 'echarts/components'
import type { ComposeOption, EChartsType } from 'echarts/core'

/**
 * 概览页图表用到的 echarts 模块，按需注册（只打包用到的图表与组件）。
 * 新增图表类型时在这里补注册，避免全量引入 echarts。
 */
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  MarkLineComponent,
  TitleComponent,
  // 网格按容器内边距布局（echarts 6 起需显式注册）
  LegacyGridContainLabel,
  CanvasRenderer,
])

/** 本项目可用的图表配置类型（由已注册模块组合而成） */
export type ChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | HeatmapSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | VisualMapComponentOption
  | MarkLineComponentOption
  | TitleComponentOption
>

export type { EChartsType }

export { echarts }
