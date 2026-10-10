import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getUserInfo, login as loginApi, logout as logoutApi } from '@/api'
import type { LoginParams, UserInfo } from '@/api/types'

/** 用户状态：登录态、用户信息，持久化 token 以便刷新后免登录 */
export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref('')
    const userInfo = ref<UserInfo | null>(null)

    const isLogin = computed(() => Boolean(token.value))
    const nickname = computed(() => userInfo.value?.name ?? '')

    function setToken(value: string) {
      token.value = value
    }

    function setUserInfo(value: UserInfo | null) {
      userInfo.value = value
    }

    async function loadUserInfo() {
      userInfo.value = await getUserInfo()
      return userInfo.value
    }

    async function login(params: LoginParams) {
      const result = await loginApi(params)
      setToken(result.token)
      await loadUserInfo()
      return result.token
    }

    async function logout() {
      try {
        await logoutApi()
      } finally {
        reset()
      }
    }

    function reset() {
      token.value = ''
      userInfo.value = null
    }

    return {
      token,
      userInfo,
      isLogin,
      nickname,
      setToken,
      setUserInfo,
      loadUserInfo,
      login,
      logout,
      reset,
    }
  },
  {
    persist: {
      key: 'beacon-web:user',
      pick: ['token', 'userInfo'],
    },
  },
)
