import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { MessagePlugin } from 'tdesign-vue-next'

import { REQUEST_TIMEOUT } from '@/config'

/**
 * 后端统一响应包装：TransformInterceptor 把成功响应包成 { data, meta }。
 * 请求层在内层解包出 data，业务代码只面对真实数据。
 */
export interface ApiEnvelope<T> {
  data: T
  meta?: {
    timestamp?: string
  }
}

/** 认证令牌对：/auth/login 与 /auth/refresh 的返回体 */
export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface RequestAuthHooks {
  /** 读取当前 access token */
  getAccessToken: () => string | undefined
  /** 读取当前 refresh token */
  getRefreshToken: () => string | undefined
  /** 刷新成功后回写新的令牌对 */
  setTokens: (tokens: AuthTokens) => void
  /** 登录失效且无法刷新时的处理（清状态、跳登录） */
  onUnauthorized: () => void
}

const hooks: RequestAuthHooks = {
  getAccessToken: () => undefined,
  getRefreshToken: () => undefined,
  setTokens: () => undefined,
  onUnauthorized: () => undefined,
}

/**
 * 由 main.ts 注入 store 侧实现。
 * 通过注入而非直接 import store，避免 store → api → request → store 的循环依赖。
 */
export function setupRequestAuth(next: Partial<RequestAuthHooks>) {
  Object.assign(hooks, next)
}

/**
 * 这些接口的 401 属于业务结果（密码错误、验证码失效等），
 * 不应触发 token 刷新，也不应把用户踢回登录页。
 */
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/2fa/',
  '/auth/wechat/',
]

function isAuthEndpoint(url?: string) {
  return Boolean(url) && AUTH_ENDPOINTS.some((endpoint) => url!.includes(endpoint))
}

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
})

service.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = hooks.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** 解包 { data, meta }；文件流等非包装响应原样返回 */
function unwrap(response: AxiosResponse) {
  const { responseType } = response.config
  if (responseType === 'blob' || responseType === 'arraybuffer') {
    return response
  }

  const body = response.data
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as ApiEnvelope<unknown>).data
  }
  return body
}

/** 从后端错误体里取可读文案（GlobalExceptionFilter 的 message 可能是数组） */
function readErrorMessage(body: unknown): string | undefined {
  if (typeof body === 'string' && body.trim()) {
    return body.trim()
  }
  if (!body || typeof body !== 'object') {
    return undefined
  }

  const record = body as Record<string, unknown>
  const raw = record.message ?? record.error
  if (Array.isArray(raw)) {
    const messages = raw.filter((item): item is string => typeof item === 'string')
    return messages.length ? messages.join('；') : undefined
  }
  return typeof raw === 'string' && raw.trim() ? raw : undefined
}

/** 无错误体时的兜底文案 */
function fallbackMessage(status?: number): string {
  switch (status) {
    case 400:
      return '请求参数有误'
    case 401:
      return '登录状态已失效，请重新登录'
    case 403:
      return '没有访问权限'
    case 404:
      return '请求的资源不存在'
    case 429:
      return '操作过于频繁，请稍后再试'
    case 500:
      return '服务器内部错误'
    case 502:
      return '网关错误'
    case 503:
      return '服务暂不可用'
    case 504:
      return '网关超时'
    default:
      return '网络异常，请稍后重试'
  }
}

// ---------- access token 自动续期 ----------
let refreshing: Promise<string> | null = null

async function requestNewAccessToken(): Promise<string> {
  const refreshToken = hooks.getRefreshToken()
  if (!refreshToken) {
    throw new Error('missing refresh token')
  }

  // 用裸 axios，避免再次经过本实例的拦截器
  const response = await axios.post<ApiEnvelope<AuthTokens>>(
    `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
    { refreshToken },
    { timeout: REQUEST_TIMEOUT },
  )
  const tokens = response.data.data
  hooks.setTokens(tokens)
  return tokens.accessToken
}

/** 并发 401 只发起一次刷新，其余请求共享同一个 Promise */
function refreshAccessToken(): Promise<string> {
  refreshing ??= requestNewAccessToken().finally(() => {
    refreshing = null
  })
  return refreshing
}

service.interceptors.response.use(
  (response: AxiosResponse) => unwrap(response) as unknown as AxiosResponse,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { __retried?: boolean }) | undefined
    const status = error.response?.status
    const skipRefresh = isAuthEndpoint(config?.url)

    // access token 过期：刷新一次并重放原请求
    if (status === 401 && config && !config.__retried && !skipRefresh && hooks.getRefreshToken()) {
      config.__retried = true
      try {
        const token = await refreshAccessToken()
        config.headers.Authorization = `Bearer ${token}`
        return (await service.request(config)) as unknown as AxiosResponse
      } catch {
        hooks.onUnauthorized()
        return Promise.reject(error)
      }
    }

    if (status === 401 && !skipRefresh) {
      hooks.onUnauthorized()
    }

    const message = readErrorMessage(error.response?.data) ?? fallbackMessage(status)
    MessagePlugin.error(message)
    return Promise.reject(new Error(message))
  },
)

/** 通用请求方法，返回业务数据（响应拦截器已解包 data 字段） */
export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return service.request(config) as unknown as Promise<T>
}

export function get<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request<T>({ url, method: 'get', params, ...config })
}

export function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request<T>({ url, method: 'post', data, ...config })
}

export function patch<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request<T>({ url, method: 'patch', data, ...config })
}

export function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request<T>({ url, method: 'put', data, ...config })
}

export function del<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request<T>({ url, method: 'delete', params, ...config })
}

/** 文件上传，Content-Type 交给浏览器按 FormData 自动设置 */
export function upload<T = unknown>(
  url: string,
  formData: FormData,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request<T>({
    url,
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config,
  })
}

export { service }
export default request
