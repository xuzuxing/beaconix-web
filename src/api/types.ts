/** 后端统一响应结构 */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页查询参数 */
export interface PageQuery {
  page: number
  pageSize: number
}

/** 分页响应结构 */
export interface PageResult<T> {
  list: T[]
  total: number
}

/** 登录参数 */
export interface LoginParams {
  username: string
  password: string
}

/** 登录结果 */
export interface LoginResult {
  token: string
}

/** 用户信息 */
export interface UserInfo {
  id: string
  name: string
  avatar?: string
  email?: string
}

/** 注册参数 */
export interface RegisterParams {
  username: string
  password: string
}

/** 找回密码参数 */
export interface ResetPasswordParams {
  /** 注册时使用的账号（邮箱 / 手机号） */
  username: string
}
