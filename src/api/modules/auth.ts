import type {
  AuthResponse,
  ChangePasswordParams,
  EnableTwoFactorParams,
  ForgotPasswordParams,
  LoginParams,
  LoginResult,
  MessageResponse,
  RecoveryCodes,
  RegisterParams,
  ResendVerificationParams,
  ResetPasswordParams,
  SecondFactorConfirmParams,
  SetupTwoFactorParams,
  TwoFactorChallenge,
  TwoFactorSetup,
  TwoFactorStatus,
  UpdateProfileParams,
  User,
  VerifyEmailParams,
  VerifyTwoFactorLoginParams,
} from '../types'
import type { AuthTokens } from '@/utils/request'
import { get, patch, post } from '@/utils/request'

/** 注册：成功后需用邮件里的验证码激活账号，激活后才能登录 */
export function register(data: RegisterParams) {
  return post<MessageResponse>('/auth/register', data)
}

/** 用邮箱验证码激活账号，成功即返回令牌 */
export function verifyEmail(data: VerifyEmailParams) {
  return post<AuthResponse>('/auth/verify-email', data)
}

/** 重新发送邮箱验证码 */
export function resendVerification(data: ResendVerificationParams) {
  return post<MessageResponse>('/auth/resend-verification', data)
}

/** 请求密码重置验证码 */
export function forgotPassword(data: ForgotPasswordParams) {
  return post<MessageResponse>('/auth/forgot-password', data)
}

/** 用验证码重置密码（会使该账号所有会话失效） */
export function resetPassword(data: ResetPasswordParams) {
  return post<MessageResponse>('/auth/reset-password', data)
}

/**
 * 邮箱 + 密码登录。
 * 未启用两步验证时直接返回令牌；启用时返回 2FA 挑战，需再调 verifyTwoFactorLogin。
 */
export function login(data: LoginParams) {
  return post<LoginResult>('/auth/login', data)
}

/** 运行时区分登录返回的是 2FA 挑战还是令牌 */
export function isTwoFactorChallenge(result: LoginResult): result is TwoFactorChallenge {
  return 'twoFactorRequired' in result && result.twoFactorRequired === true
}

/** 提交两步验证验证码（TOTP 或恢复码），成功后返回令牌 */
export function verifyTwoFactorLogin(data: VerifyTwoFactorLoginParams) {
  return post<AuthResponse>('/auth/2fa/verify-login', data)
}

/** 两步验证状态 */
export function getTwoFactorStatus() {
  return get<TwoFactorStatus>('/auth/2fa/status')
}

/** 开始绑定两步验证：校验密码后返回二维码与一次性 setupToken */
export function setupTwoFactor(data: SetupTwoFactorParams) {
  return post<TwoFactorSetup>('/auth/2fa/setup', data)
}

/** 提交动态验证码完成绑定，返回一次性恢复码 */
export function enableTwoFactor(data: EnableTwoFactorParams) {
  return post<RecoveryCodes>('/auth/2fa/enable', data)
}

/** 重置恢复码（旧码全部失效，返回新码） */
export function regenerateRecoveryCodes(data: SecondFactorConfirmParams) {
  return post<RecoveryCodes>('/auth/2fa/recovery-codes', data)
}

/** 关闭两步验证（会使该账号所有会话失效） */
export function disableTwoFactor(data: SecondFactorConfirmParams) {
  return post<void>('/auth/2fa/disable', data)
}

/** 轮换刷新令牌 */
export function refreshTokens(refreshToken: string) {
  return post<AuthTokens>('/auth/refresh', { refreshToken })
}

/** 注销：吊销当前 refresh token */
export function logout(refreshToken: string) {
  return post<void>('/auth/logout', { refreshToken })
}

/** 当前用户资料 */
export function getProfile() {
  return get<User>('/auth/me')
}

/** 更新当前用户资料 */
export function updateProfile(data: UpdateProfileParams) {
  return patch<User>('/auth/me', data)
}

/** 修改密码 */
export function changePassword(data: ChangePasswordParams) {
  return patch<void>('/auth/me/password', data)
}
