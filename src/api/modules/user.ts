import type {
  LoginParams,
  LoginResult,
  RegisterParams,
  ResetPasswordParams,
  UserInfo,
} from '../types'
import { get, post } from '@/utils/request'

/** 登录 */
export function login(data: LoginParams) {
  return post<LoginResult>('/auth/login', data)
}

/** 注册 */
export function register(data: RegisterParams) {
  return post<null>('/auth/register', data)
}

/** 找回密码：向注册账号发送重置链接 */
export function resetPassword(data: ResetPasswordParams) {
  return post<null>('/auth/password/reset', data)
}

/** 获取当前登录用户信息 */
export function getUserInfo() {
  return get<UserInfo>('/user/profile')
}

/** 退出登录 */
export function logout() {
  return post<null>('/auth/logout')
}
