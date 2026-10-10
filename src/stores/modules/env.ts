import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { EnvItem } from '@/config/env'
import { envList } from '@/config/env'

/**
 * 当前环境：「选择环境」页与顶栏环境选择器共用同一份状态，
 * 因此在选择环境页切换环境后，顶栏会同步跟随。
 * currentId 持久化，刷新后仍停留在上次选择的环境。
 */
export const useEnvStore = defineStore(
  'env',
  () => {
    /** 当前环境 ID */
    const currentId = ref<string>(envList[0]?.id ?? '')

    /** 当前环境对象 */
    const current = computed<EnvItem>(
      () => envList.find((env) => env.id === currentId.value) ?? envList[0]!,
    )

    /** 切换当前环境 */
    function setCurrent(id: string) {
      currentId.value = id
    }

    return { currentId, current, setCurrent }
  },
  {
    persist: {
      key: 'beacon-vue3:env',
      pick: ['currentId'],
    },
  },
)
