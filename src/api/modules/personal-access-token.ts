import type {
  CreatePersonalAccessTokenParams,
  PersonalAccessToken,
} from '../types/personal-access-token'
import { get, post } from '@/utils/request'

/**
 * 当前用户的个人访问令牌。
 * 明文令牌只在创建响应里返回一次；列表与吊销接口返回的都是掩码后的元信息。
 */

/** 当前用户的令牌列表 */
export function listPersonalAccessTokens() {
  return get<PersonalAccessToken[]>('/users/me/personal-access-tokens')
}

/** 创建令牌（仅本次响应返回完整令牌） */
export function createPersonalAccessToken(data: CreatePersonalAccessTokenParams) {
  return post<PersonalAccessToken>('/users/me/personal-access-tokens', data)
}

/** 吊销令牌 */
export function revokePersonalAccessToken(id: string) {
  return post<PersonalAccessToken>(
    `/users/me/personal-access-tokens/${encodeURIComponent(id)}/revoke`,
  )
}
