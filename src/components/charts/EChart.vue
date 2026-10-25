<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type { ChartOption, EChartsType } from './echarts'
import { echarts } from './echarts'

/**
 * 通用图表容器：负责初始化实例、尺寸自适应与 option 更新。
 * 配色不在这里处理，由调用方把 chartTheme 的色值写进 option。
 */
defineOptions({ name: 'EChart' })

const props = withDefaults(
  defineProps<{
    /** ECharts 配置项 */
    option: ChartOption
    /** 容器高度，默认撑满父级（父级需有确定高度） */
    height?: string
  }>(),
  { height: '100%' },
)

const containerRef = ref<HTMLDivElement>()
const chart = shallowRef<EChartsType>()

function render() {
  // notMerge：切换时间范围时序列数量可能变化，避免残留旧序列
  chart.value?.setOption(props.option, { notMerge: true })
}

onMounted(() => {
  if (!containerRef.value) {
    return
  }
  chart.value = echarts.init(containerRef.value, undefined, {
    renderer: 'canvas',
  })
  render()
})

watch(() => props.option, render, { deep: true })

// 侧栏折叠、窗口缩放、卡片换行都会改变容器尺寸
useResizeObserver(containerRef, () => chart.value?.resize())

onBeforeUnmount(() => {
  chart.value?.dispose()
  chart.value = undefined
})
</script>

<template>
  <div
    ref="containerRef"
    class="echart"
    :style="{ height }"
  ></div>
</template>

<style scoped lang="less">
.echart {
  width: 100%;
}
</style>
