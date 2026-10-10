import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getProfile, isTwoFactorChallenge, login as loginApi, logout as logoutApi } from '@/api'
import type { AuthResponse, LoginParams, LoginResult, User } from '@/api/types'
import type { AuthTokens } from '@/utils/request'

/**
 * 用户状态：登录态（access + refresh 令牌）与当前用户资料。
 * 令牌持久化，刷新页面后仍保持登录；access token 过期由请求层自动续期。
 */
export const useUserStore = defineStore(
  'user',
  () => {
    const accessToken = ref('')
    const refreshToken = ref('')
    const user = ref<User | null>(null)

    const isLogin = computed(() => Boolean(accessToken.value))
    const nickname = computed(() => user.value?.name ?? '')
    /** 平台超级管理员（可访问 /admin/* 接口） */
    const isSuperAdmin = computed(() => user.value?.globalRole === 'SUPER_ADMIN')

    /** 请求层续期成功后回写令牌对 */
    function setTokens(tokens: AuthTokens) {
      accessToken.value = tokens.accessToken
      refreshToken.value = tokens.refreshToken
    }

    function setUser(value: User | null) {
      user.value = value
    }

    /** 登录 / 邮箱验证成功后写入令牌与用户 */
    function applyAuth(result: AuthResponse) {
      setTokens(result)
      setUser(result.user)
    }

    /** 拉取当前用户资料（路由守卫在缺少 user 时调用） */
    async function loadUser() {
      user.value = await getProfile()
      return user.value
    }

    /**
     * 登录。未启用两步验证时直接写入登录态；
     * 启用时返回 2FA 挑战，由页面提交验证码后再调 applyAuth。
     */
    async function login(params: LoginParams): Promise<LoginResult> {
      const result = await loginApi(params)
      if (!isTwoFactorChallenge(result)) {
        applyAuth(result)
      }
      return result
    }

    async function logout() {
      const token = refreshToken.value
      try {
        if (token) {
          await logoutApi(token)
        }
      } catch {
        // 注销接口失败也要清掉本地状态
      } finally {
        reset()
      }
    }

    function reset() {
      accessToken.value = ''
      refreshToken.value = ''
      user.value = null
    }

    return {
      accessToken,
      refreshToken,
      user,
      isLogin,
      nickname,
      isSuperAdmin,
      setTokens,
      setUser,
      applyAuth,
      loadUser,
      login,
      logout,
      reset,
    }
  },
  {
    persist: {
      key: 'beacon-vue3:user',
      pick: ['accessToken', 'refreshToken', 'user'],
    },
  },
)
