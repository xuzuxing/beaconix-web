import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { MessagePlugin } from 'tdesign-vue-next'

import type { ApiResult } from '@/api/types'
import { REQUEST_TIMEOUT, SUCCESS_CODE } from '@/config'

/** 登录失效的业务状态码 */
const UNAUTHORIZED_CODE = 401

type TokenGetter = () => string | undefined
type UnauthorizedHandler = () => void

let getToken: TokenGetter = () => undefined
let onUnauthorized: UnauthorizedHandler = () => undefined

/**
 * 注入 token 来源（一般为 user store）。
 * 通过注入而非直接 import store，避免 store → api → request → store 的循环依赖。
 */
export function setupRequestToken(getter: TokenGetter) {
  getToken = getter
}

/** 注入登录失效后的处理逻辑（清空登录态、跳转等） */
export function setupRequestUnauthorized(handler: UnauthorizedHandler) {
  onUnauthorized = handler
}

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
})

service.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** HTTP 状态码对应的兜底文案 */
function getErrorMessage(error: AxiosError): string {
  if (error.code === 'ECONNABORTED') {
    return '请求超时，请稍后重试'
  }

  switch (error.response?.status) {
    case 400:
      return '请求参数有误'
    case 401:
      return '登录状态已失效，请重新登录'
    case 403:
      return '没有访问权限'
    case 404:
      return '请求的资源不存在'
    case 500:
      return '服务器内部错误'
    case 502:
      return '网关错误'
    case 503:
      return '服务暂不可用'
    case 504:
      return '网关超时'
    default:
      return error.message || '网络异常，请稍后重试'
  }
}

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const { responseType } = response.config
    // 文件流交给调用方处理，不做业务解包
    if (responseType === 'blob' || responseType === 'arraybuffer') {
      return response
    }

    const result = response.data as ApiResult<unknown> | undefined
    // 非统一结构的响应（如第三方接口）原样返回
    if (!result || typeof result !== 'object' || !('code' in result)) {
      return response.data as unknown as AxiosResponse
    }

    if (result.code === SUCCESS_CODE) {
      return result.data as unknown as AxiosResponse
    }

    if (result.code === UNAUTHORIZED_CODE) {
      onUnauthorized()
    }

    const message = result.message || '请求失败'
    MessagePlugin.error(message)
    return Promise.reject(new Error(message))
  },
  (error: AxiosError) => {
    const message = getErrorMessage(error)
    if (error.response?.status === UNAUTHORIZED_CODE) {
      onUnauthorized()
    }
    MessagePlugin.error(message)
    return Promise.reject(error)
  },
)

/** 通用请求方法，返回业务数据（响应拦截器已解包 data 字段） */
export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  // 拦截器已把 AxiosResponse 替换为业务数据，故此处断言为业务类型
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
