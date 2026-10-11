<script setup lang="ts">
import { onActivated, onDeactivated, ref } from 'vue'

/**
 * 主布局标题栏的注入区容器（默认注入最右侧的动作区）。
 *
 * 主布局的内容区默认对页面做 keep-alive 缓存（见 AppContent.vue），
 * 而被缓存的组件停用时，<Teleport> 的内容并不会从目标容器移除，
 * 页面直接写 Teleport 会让上一个页面留下的按钮一直累加在标题栏上。
 * 这里在页面停用时卸载 Teleport，重新激活时再挂载，行为与不缓存时一致。
 *
 * 未参与 keep-alive 的页面（meta.keepAlive === false）不会触发这两个钩子，
 * 组件卸载时由 Vue 直接移除注入内容。
 */
defineOptions({ name: 'HeaderActions' })

withDefaults(
  defineProps<{
    /** 目标容器 id，默认是标题栏最右侧的动作区 */
    to?: string
  }>(),
  { to: '#layout-header-actions' },
)

const visible = ref(true)
onActivated(() => {
  visible.value = true
})
onDeactivated(() => {
  visible.value = false
})
</script>

<template>
  <Teleport v-if="visible" defer :to="to">
    <slot />
  </Teleport>
</template>
