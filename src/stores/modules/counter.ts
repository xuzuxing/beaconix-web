import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/** 示例 store：演示 setup 语法与组件中的用法，可按需删除 */
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)

  function increment() {
    count.value++
  }

  function reset() {
    count.value = 0
  }

  return { count, doubleCount, increment, reset }
})
